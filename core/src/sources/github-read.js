'use strict';
const { TextDecoder } = require('node:util');
const BODY_LIMIT = 2 * 1024 * 1024;
const FILE_LIMIT = 1024 * 1024;
const PATH = /^(?!\/)(?!.*\/$)(?!.*(?:^|\/)\.{1,2}(?:\/|$))(?!.*(?:^|\/)\/)[^\\%?#\x00-\x1f]+$/;

function validPath(path) { return typeof path === 'string' && path.length > 0 && path.length <= 300 && PATH.test(path); }
function validNumber(number) { return Number.isSafeInteger(number) && number > 0; }

async function boundedJson(response) {
  if (!response.ok) throw new Error(`github-http-${response.status}`);
  if (!response.body) return {};
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > BODY_LIMIT) throw new Error('github-body-too-large');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function createGithubRead({ token, fetch: fetcher = globalThis.fetch }) {
  async function get(ctx, suffix, query = {}) {
    const { owner, repo } = ctx.project.github;
    if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) throw new Error('github-binding');
    const url = new URL(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${suffix}`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    return boundedJson(await fetcher(url, { redirect: 'error', signal: ctx.signal, headers: {
      Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
    } }));
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
      const comments = await get(ctx, `issues/${number}/comments`, { per_page: 30 });
      const reviews = issue.pull_request ? await get(ctx, `pulls/${number}/reviews`, { per_page: 30 }) : [];
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
      const file = await get(ctx, `contents/${path.split('/').map(encodeURIComponent).join('/')}`, { ref: sha });
      if (file.type !== 'file' || file.size > FILE_LIMIT || !Number.isSafeInteger(file.size) || file.size < 0) throw new Error('invalid-file');
      const bytes = Buffer.from(file.content || '', 'base64');
      if (bytes.byteLength > FILE_LIMIT) throw new Error('invalid-file');
      try { return { path, size: file.size, content: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }; }
      catch { return { binary: true, size: file.size }; }
    },
  };
}
module.exports = { createGithubRead, validPath, validNumber, boundedJson };
