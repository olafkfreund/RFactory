'use strict';
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const RECORDED = new Set(require('../../test/fixtures/github-tools-1.14.0.json').map((t) => t.name));
const READ_TOOLS = ['list_issues', 'list_pull_requests', 'pull_request_read', 'issue_read', 'projects_list'];
const VERSION = '1.14.0';
const CAP = 1000;
const PER_PAGE = 100;

async function connect({ bin, token, logSafe = () => {}, signal, probeMs = 5000 }) {
  if (!bin) throw new Error('GITHUB_MCP_SERVER_BIN is required');
  if (signal?.aborted) throw signal.reason;
  const { stdout } = await promisify(execFile)(bin, ['--version'], { encoding: 'utf8', timeout: probeMs, signal });
  if (!stdout.includes(`Version: ${VERSION}`)) throw new Error(`github-mcp-server version is not ${VERSION}`);
  if (signal?.aborted) throw signal.reason;
  const transport = new StdioClientTransport({
    command: bin,
    args: ['stdio', '--read-only', '--toolsets', 'issues,pull_requests,repos,actions,projects'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: token, PATH: '/run/current-system/sw/bin:/usr/bin' },
    stderr: 'pipe',
  });
  transport.stderr.on('data', (d) => logSafe(String(d)));
  const client = new Client({ name: 'rfactory-core', version: '0' });
  const stop = () => { void transport.close(); };
  signal?.addEventListener('abort', stop, { once: true });
  try {
    if (signal?.aborted) throw signal.reason;
    await client.connect(transport);
    const { tools } = await client.listTools();
    const names = new Set(tools.map((t) => t.name));
    for (const t of tools) {
      if (!RECORDED.has(t.name)) throw new Error(`unrecorded tool: ${t.name}`);
      if (t.annotations?.readOnlyHint !== true) throw new Error(`tool not read-only: ${t.name}`);
    }
    for (const n of READ_TOOLS) if (!names.has(n)) throw new Error(`missing tool: ${n}`);
  } catch (e) {
    signal?.removeEventListener('abort', stop);
    await client.close().catch(() => {});
    throw e;
  }

  async function call(name, args) {
    const r = await client.callTool({ name, arguments: args });
    const text = (r.content || []).map((c) => c.text || '').join('');
    if (r.isError) throw new Error(`${name}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  }
  // Pages until `fetchPage(i, cursor)` reports no more; capped at CAP items.
  async function paged(fetchPage) {
    const out = [];
    let cursor, truncated = false;
    for (let i = 1; ; i++) {
      const { items, next, more } = await fetchPage(i, cursor);
      out.push(...items);
      if (out.length >= CAP) { truncated = more || out.length > CAP; out.length = Math.min(out.length, CAP); break; }
      if (!more) break;
      cursor = next;
    }
    return { items: out, truncated };
  }
  const arr = (v, key) => (Array.isArray(v) ? v : v?.[key] || []);

  async function fetchScope(scope) {
    const { owner, repo, project } = scope.source;
    const base = { owner, repo };
    const iss = await paged(async (i, after) => {
      const r = await call('list_issues', { ...base, perPage: PER_PAGE, ...(after && { after }) });
      const items = arr(r, 'issues').map((x) => ({ ...x, state: String(x.state).toLowerCase(), html_url: x.html_url || `https://github.com/${owner}/${repo}/issues/${x.number}` }));
      return { items, more: !!r.pageInfo?.hasNextPage, next: r.pageInfo?.endCursor };
    });
    const prs = await paged(async (page) => {
      const items = arr(await call('list_pull_requests', { ...base, state: 'all', perPage: PER_PAGE, page }), 'pull_requests')
        .map((p) => ({ ...p, closingIssuesReferences: p.closingIssuesReferences || [] }));
      return { items, more: items.length === PER_PAGE };
    });
    const checks = {};
    for (const p of prs.items.filter((p) => p.state === 'open')) {
      checks[p.number] = arr(await call('pull_request_read', { ...base, method: 'get_check_runs', pullNumber: p.number }), 'check_runs');
    }
    const projectStatus = {};
    let projTruncated = false;
    if (project) {
      const r = await paged(async (i, after) => {
        const res = await call('projects_list', { method: 'list_project_items', owner: project.owner, project_number: project.number, field_names: ['Status'], perPage: 50, ...(after && { after }) });
        return { items: arr(res, 'items'), more: !!res.pageInfo?.hasNextPage, next: res.pageInfo?.nextCursor };
      });
      projTruncated = r.truncated;
      for (const it of r.items) {
        const itemRepo = it.content?.repository?.nameWithOwner || it.content?.repository?.full_name ||
          (it.content?.url || it.content?.html_url)?.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/(?:issues|pull)\/\d+/)?.[1];
        if (itemRepo?.toLowerCase() !== `${owner}/${repo}`.toLowerCase()) continue;
        const n = it.content?.number ?? it.number;
        const st = (it.fields || []).find((f) => f.name === 'Status');
        // live 1.14.0 returns a single-select value as { id, name, color }; strings kept for older shapes
        const v = st && (st.value ?? st.text ?? st.name_value);
        if (n != null && st) projectStatus[n] = v && typeof v === 'object' ? v.name : v;
      }
    }
    return { repo: `${owner}/${repo}`, issues: iss.items, pulls: prs.items, checks, projectStatus, truncated: iss.truncated || prs.truncated || projTruncated, fetched_at: new Date().toISOString() };
  }

  async function getItem(scope, number) {
    const { owner, repo } = scope.source;
    const issue = await call('issue_read', { method: 'get', owner, repo, issue_number: number });
    if (!issue.pull_request) return { repo: `${owner}/${repo}`, issue, fetched_at: new Date().toISOString() };
    const pr = await call('pull_request_read', { method: 'get', owner, repo, pullNumber: number });
    const checks = arr(await call('pull_request_read', { method: 'get_check_runs', owner, repo, pullNumber: number }), 'check_runs');
    return { repo: `${owner}/${repo}`, issue, pr, checks, fetched_at: new Date().toISOString() };
  }

  async function itemActivity(scope, number, isPr) {
    const { owner, repo } = scope.source;
    const fetched_at = new Date().toISOString();
    if (!isPr) return { comments: await call('issue_read', { method: 'get_comments', owner, repo, issue_number: number }), fetched_at };
    return {
      comments: await call('pull_request_read', { method: 'get_comments', owner, repo, pullNumber: number }),
      reviews: await call('pull_request_read', { method: 'get_reviews', owner, repo, pullNumber: number }),
      commits: await call('pull_request_read', { method: 'get_commits', owner, repo, pullNumber: number }),
      fetched_at,
    };
  }

  return { fetchScope, getItem, itemActivity, close: async () => {
    signal?.removeEventListener('abort', stop);
    await client.close();
  } };
}

module.exports = { connect, RECORDED, READ_TOOLS };
