'use strict';
const { mapJira } = require('../items.js');
const { boundedJson } = require('./github-read.js');

function createJiraSource({ scope, token, fetch = globalThis.fetch, timeoutMs = 55000, now = () => new Date() }) {
  const { cloud_id, project, email, flagged_field } = scope?.source ?? {};
  if (typeof cloud_id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(cloud_id) ||
      typeof project !== 'string' || !/^[A-Z][A-Z0-9_]{1,19}$/.test(project)) throw new Error('jira-binding');
  const pathname = '/ex/jira/' + cloud_id + '/rest/api/3/search/jql';
  const endpoint = new URL('https://api.atlassian.com' + pathname);
  if (endpoint.pathname !== pathname) throw new Error('jira-binding');
  endpoint.searchParams.set('jql', 'project = "' + project + '" AND (statusCategory != Done OR updated >= -14d) ORDER BY updated DESC');
  endpoint.searchParams.set('fields', ['summary', 'status', 'assignee', 'updated', 'project', ...(flagged_field ? [flagged_field] : [])].join(','));
  endpoint.searchParams.set('maxResults', '100');
  const issueKey = new RegExp('^' + project + '-\\d+$');
  const headers = { Authorization: 'Basic ' + Buffer.from(email + ':' + token).toString('base64'), Accept: 'application/json' };

  async function snapshot() {
    const controller = new AbortController();
    const { signal } = controller;
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('source-timeout'));
        controller.abort();
      }, timeoutMs);
    });
    const seen = new Set();
    const kept = [];
    let rows = 0, next, truncated = false;
    try {
      for (let request = 1; request <= 10; request++) {
        const url = new URL(endpoint);
        if (next) url.searchParams.set('nextPageToken', next);
        let page;
        try {
          const response = await Promise.race([fetch(url, { method: 'GET', redirect: 'error', signal, headers }), deadline]);
          page = await Promise.race([boundedJson(response, 'jira'), deadline]);
        } catch (error) {
          const code = error?.message;
          if (typeof code === 'string' && (/^jira-http-\d{3}$/.test(code) || code === 'jira-body-too-large')) throw new Error(code);
          if (signal.aborted) throw new Error('source-timeout');
          if (error instanceof SyntaxError) throw new Error('jira-bad-reply');
          throw new Error('jira-network');
        }
        if (!Array.isArray(page?.issues)) throw new Error('jira-bad-reply');
        next = page.nextPageToken;
        if ((next != null && (typeof next !== 'string' || !next)) ||
            (page.isLast === false && !next) || (page.isLast === true && next) || seen.has(next)) {
          throw new Error('jira-paging');
        }
        const remaining = 500 - rows;
        for (const issue of page.issues.slice(0, remaining)) {
          if (issue?.fields?.project?.key === project && typeof issue.key === 'string' && issueKey.test(issue.key)) kept.push(issue);
        }
        rows += page.issues.length;
        if (rows >= 500 || request === 10 || !next) {
          truncated = rows > 500 || !!next;
          break;
        }
        seen.add(next);
      }
      const items = mapJira(kept, scope);
      let newest_update = null;
      for (const { updated_at } of items) {
        if (updated_at && (newest_update === null || updated_at > newest_update)) newest_update = updated_at;
      }
      return { items, fetched_at: now().toISOString(), newest_update, truncated };
    } finally { clearTimeout(timer); }
  }

  return { kind: 'jira', snapshot };
}

module.exports = { createJiraSource };
