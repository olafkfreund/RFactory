'use strict';
const { TextDecoder } = require('node:util');
const BODY_LIMIT = 2 * 1024 * 1024;
const FILE_LIMIT = 1024 * 1024;
// controls, format characters and the line/paragraph separators, besides what a URL would reinterpret
const BAD_PATH = /[\\%?#]|[\p{C}\p{Zl}\p{Zp}]/u;
const NAME = /^(?!\.{1,2}$)[\w.-]+$/;

function validPath(path) {
  return typeof path === 'string' && path.length > 0 && path.length <= 300 && !BAD_PATH.test(path) &&
    path.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}
// the normalised URL must still be inside the bound repository (and under `under`, when given)
function repoUrl(owner, repo, suffix = '', under = '') {
  if (!NAME.test(owner) || !NAME.test(repo)) throw new Error('github-binding');
  const root = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const url = new URL(`https://api.github.com${root}${suffix ? `/${suffix}` : ''}`);
  if (under ? !url.pathname.startsWith(`${root}/${under}`) : url.pathname !== root && !url.pathname.startsWith(`${root}/`)) {
    throw new Error('github-path');
  }
  return url;
}
function validNumber(number) { return Number.isSafeInteger(number) && number > 0; }

async function boundedJson(response, prefix = 'github') {
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new Error(prefix + '-http-' + response.status);
  }
  if (!response.body) return {};
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > BODY_LIMIT) throw new Error(prefix + '-body-too-large');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function createGithubRead({ token, fetch: fetcher = globalThis.fetch }) {
  async function request(ctx, suffix, query = {}, under = '') {
    const { owner, repo } = ctx.project.github;
    const url = repoUrl(owner, repo, suffix, under);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    const response = await fetcher(url, { redirect: 'error', signal: ctx.signal, headers: {
      Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
    } });
    return { data: await boundedJson(response), link: response.headers.get('link') || '' };
  }
  const get = async (...args) => (await request(...args)).data;
  // GitHub lists oldest first: the newest 30 are on the last page, topped up from the one before it
  async function newest(ctx, suffix) {
    const first = await request(ctx, suffix, { per_page: 30 });
    // only the page number is taken from the header; the URL is built here
    const last = Number(/[?&]page=(\d+)[^<>]*>;\s*rel="last"/.exec(first.link)?.[1]);
    if (!(last > 1)) return first.data;
    const page = (n) => get(ctx, suffix, { per_page: 30, page: n });
    const tail = await page(last);
    if (tail.length >= 30) return tail;
    return [...(last === 2 ? first.data : await page(last - 1)), ...tail];
  }
  async function commit(ctx) {
    if (ctx.commit) return ctx.commit;
    if (!ctx.commitPromise) ctx.commitPromise = (async () => {
      const repo = await get(ctx, '');
      const head = await get(ctx, `commits/${encodeURIComponent(repo.default_branch)}`);
      if (!/^[a-f0-9]{40}$/.test(head.sha)) throw new Error('github-head');
      return (ctx.commit = head.sha);
    })();
    return ctx.commitPromise;
  }
  return {
    async getIssue(ctx, number) {
      if (!validNumber(number)) throw new Error('invalid-number');
      await commit(ctx);
      const issue = await get(ctx, `issues/${number}`);
      const pr = issue.pull_request ? await get(ctx, `pulls/${number}`) : null;
      return { title: issue.title, state: issue.state, body: issue.body, labels: issue.labels?.map((x) => x.name),
        ...(pr ? { head: pr.head?.ref, base: pr.base?.ref } : {}) };
    },
    async issueComments(ctx, number) {
      if (!validNumber(number)) throw new Error('invalid-number');
      await commit(ctx);
      const issue = await get(ctx, `issues/${number}`);
      const comments = await newest(ctx, `issues/${number}/comments`);
      const reviews = issue.pull_request ? await newest(ctx, `pulls/${number}/reviews`) : [];
      return [...comments, ...reviews].sort((a, b) => String(b.created_at || b.submitted_at).localeCompare(String(a.created_at || a.submitted_at))).slice(0, 30)
        .map((x) => ({ author: x.user?.login, at: x.created_at || x.submitted_at, text: x.body }));
    },
    async prDiff(ctx, number) {
      if (!validNumber(number)) throw new Error('invalid-number');
      await commit(ctx);
      const files = await get(ctx, `pulls/${number}/files`, { per_page: 50 });
      return files.slice(0, 50).map(({ filename, status, patch }) => ({ filename, status, patch }));
    },
    async readFile(ctx, path) {
      if (!validPath(path)) throw new Error('invalid-path');
      const sha = await commit(ctx);
      const file = await get(ctx, `contents/${path.split('/').map(encodeURIComponent).join('/')}`, { ref: sha }, 'contents/');
      if (file.type !== 'file' || file.size > FILE_LIMIT || !Number.isSafeInteger(file.size) || file.size < 0) throw new Error('invalid-file');
      const bytes = Buffer.from(file.content || '', 'base64');
      if (bytes.byteLength > FILE_LIMIT) throw new Error('invalid-file');
      try { return { path, size: file.size, content: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }; }
      catch { return { binary: true, size: file.size }; }
    },
  };
}
module.exports = { createGithubRead, validPath, validNumber, boundedJson, repoUrl };
