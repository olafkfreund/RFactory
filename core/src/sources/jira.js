'use strict';
const { mapJira, STATES } = require('../items.js');
const { boundedJson } = require('./github-read.js');

const validProject = (project) => typeof project === 'string' && /^[A-Z][A-Z0-9_]{1,19}$/.test(project);
const ISSUE = /^([A-Z][A-Z0-9_]{1,19})-\d+$/;

function jiraTransport({ cloud_id, email }, token, fetch, timeoutMs) {
  if (typeof cloud_id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(cloud_id)) throw new Error('jira-binding');
  const base = 'https://api.atlassian.com/ex/jira/' + cloud_id + '/rest/api/3/';
  const headers = { Authorization: 'Basic ' + Buffer.from(email + ':' + token).toString('base64'), Accept: 'application/json' };
  return async function read(signal, operation) {
    if (signal?.aborted) throw new Error('source-timeout');
    const controller = new AbortController();
    const abort = () => controller.abort();
    const deadline = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('source-timeout')), { once: true }));
    const timer = setTimeout(abort, timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    async function get(path, params) {
      if (controller.signal.aborted) throw new Error('source-timeout');
      const url = new URL(base + path);
      if (url.href !== base + path) throw new Error('jira-binding');
      url.search = new URLSearchParams(params).toString();
      try {
        const response = await fetch(url, { method: 'GET', redirect: 'error', signal: controller.signal, headers });
        return await boundedJson(response, 'jira');
      } catch (error) {
        const code = error?.message;
        if (typeof code === 'string' && (/^jira-http-\d{3}$/.test(code) || code === 'jira-body-too-large')) throw new Error(code);
        if (controller.signal.aborted) throw new Error('source-timeout');
        if (error instanceof SyntaxError) throw new Error('jira-bad-reply');
        throw new Error('jira-network');
      }
    }
    try { return await Promise.race([operation(get), deadline]); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  };
}

function currentIssues(project) {
  return `project = "${project}" AND (statusCategory != Done OR updated >= -14d) ORDER BY updated DESC`;
}

function inProject(issue, project) {
  return issue?.fields?.project?.key === project && typeof issue.key === 'string' && ISSUE.exec(issue.key)?.[1] === project;
}

async function search(get, params, visit) {
  const seen = new Set();
  let rows = 0;
  for (let request = 1; request <= 10; request++) {
    const page = await get('search/jql', params);
    if (!Array.isArray(page?.issues)) throw new Error('jira-bad-reply');
    const next = page.nextPageToken;
    if ((next != null && (typeof next !== 'string' || !next)) ||
        (page.isLast === false && !next) || (page.isLast === true && next) || seen.has(next)) throw new Error('jira-paging');
    for (const issue of page.issues.slice(0, 500 - rows)) {
      if (visit(issue)) return true;
    }
    rows += page.issues.length;
    if (rows >= 500 || request === 10 || !next) return rows > 500 || !!next;
    seen.add(next);
    params.nextPageToken = next;
  }
}

function createJiraSource({ scope, token, fetch = globalThis.fetch, timeoutMs = 55000, now = () => new Date() }) {
  const binding = scope?.source ?? {};
  const { project, flagged_field } = binding;
  if (!validProject(project)) throw new Error('jira-binding');
  const read = jiraTransport(binding, token, fetch, timeoutMs);
  async function snapshot() {
    const kept = [];
    const truncated = await read(undefined, (get) => search(get, {
      jql: currentIssues(project),
      fields: ['summary', 'status', 'assignee', 'updated', 'project', ...(flagged_field ? [flagged_field] : [])].join(','),
      maxResults: '100',
    }, (issue) => { if (inProject(issue, project)) kept.push(issue); }));
    const items = mapJira(kept, scope);
    let newest_update = null;
    for (const { updated_at } of items) {
      if (updated_at && (newest_update === null || updated_at > newest_update)) newest_update = updated_at;
    }
    return { items, fetched_at: now().toISOString(), newest_update, truncated };
  }
  return { kind: 'jira', snapshot };
}

function createJiraRead({ binding, token, fetch = globalThis.fetch, timeoutMs = 55000 }) {
  if (!Array.isArray(binding?.projects) || !binding.projects.length || !binding.projects.every(validProject) ||
      (binding.flagged_field !== undefined && !/^customfield_\d+$/.test(binding.flagged_field))) throw new Error('jira-binding');
  const projects = new Set(binding.projects);
  const scope = { source: { flagged_field: binding.flagged_field }, mapping: structuredClone(binding.mapping) };
  const fields = ['summary', 'status', 'project', ...(binding.flagged_field ? [binding.flagged_field] : [])].join(',');
  const read = jiraTransport(binding, token, fetch, timeoutMs);
  function projectIssue(issue) {
    const [item] = mapJira([issue], scope);
    return { key: item.id, title: typeof item.title === 'string' ? item.title : '', state: item.state,
      source_state: typeof item.source_state === 'string' ? item.source_state : '' };
  }
  return {
    async issue(key, { signal } = {}) {
      const project = typeof key === 'string' && ISSUE.exec(key)?.[1];
      if (!projects.has(project)) throw new Error('jira-binding');
      const result = await read(signal, (get) => get('issue/' + key, { fields }));
      return inProject(result, project) && result.key === key ? projectIssue(result) : null;
    },
    async list(project, state, { signal } = {}) {
      if (!projects.has(project) || (state !== undefined && !STATES.includes(state))) throw new Error('jira-binding');
      const items = [];
      const truncated = await read(signal, (get) => search(get, {
        jql: currentIssues(project), fields, maxResults: '100',
      }, (issue) => {
        if (!inProject(issue, project)) return false;
        const item = projectIssue(issue);
        if (state === undefined || item.state === state) items.push(item);
        return items.length === 20;
      }));
      // An incomplete scan cannot establish that there were no other matching states.
      if (truncated && items.length < 20) throw new Error('jira-search-limit');
      return items;
    },
  };
}

module.exports = { createJiraSource, createJiraRead };
