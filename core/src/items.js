'use strict';
// Precedence per plan "State precedence": first match wins.
const STATES = ['done', 'in_progress', 'blocked', 'left', 'unknown'];
const FAIL = new Set(['failure', 'timed_out', 'cancelled', 'action_required']);
const CLOSES = /\b(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\s*:?\s+#(\d+)/gi;

const labelNames = (x) => (x.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
const logins = (x) => (x.assignees || []).map((a) => (typeof a === 'string' ? a : a.login));
// shortcut: GitHub check runs carry no "required" flag; a run counts as required unless marked required:false.
const failing = (runs) => (runs || []).filter((r) => r.required !== false && FAIL.has(r.conclusion));

function mapGithub(raw, mapping = {}) {
  const board = (mapping && mapping.board) || {};
  const pulls = raw.pulls || [];
  const byNum = new Map();
  for (const i of raw.issues || []) byNum.set(i.number, { ...i, isPr: !!i.pull_request });
  // a PR listed in both feeds becomes one item; the pulls entry wins
  for (const p of pulls) byNum.set(p.number, { ...byNum.get(p.number), ...p, isPr: true });

  const links = new Map(); // issue number -> [{ pr, via }]
  const link = (n, pr, via) => {
    const l = links.get(n) || [];
    if (!l.some((x) => x.pr === pr)) l.push({ pr, via });
    links.set(n, l);
  };
  for (const p of pulls) {
    for (const n of p.closingIssuesReferences || []) link(n, p, 'closingIssuesReferences');
    for (const m of (p.body || '').matchAll(CLOSES)) link(Number(m[1]), p, `body "${m[0]}"`);
  }

  const items = [];
  for (const [n, x] of byNum) {
    const evidence = [];
    const prs = x.isPr ? [{ pr: x, via: 'self' }] : links.get(n) || [];
    for (const { pr, via } of prs) if (via !== 'self') evidence.push(`linked PR #${pr.number} via ${via}`);
    const openPr = prs.map((l) => l.pr).find((p) => p.state === 'open' && !p.merged && !p.merged_at);
    const fails = prs.flatMap(({ pr }) => failing(raw.checks && raw.checks[pr.number]).map((r) => `check failing on #${pr.number}: ${r.name}`));
    evidence.push(...fails);
    const merged = !!(x.merged || x.merged_at);
    const hasBoard = raw.projectStatus && Object.hasOwn(raw.projectStatus, n);

    let state, rule, basis, source = x.state;
    if (hasBoard) {
      const s = raw.projectStatus[n];
      source = s;
      [state, rule] = Object.hasOwn(board, s) && STATES.includes(board[s]) ? [board[s], '1'] : ['unknown', '1-unmapped'];
      basis = 'observed';
    } else if (x.state === 'closed' && x.isPr && !merged) {
      [state, rule, basis] = ['unknown', 'closed-unmerged', 'observed']; // not in the plan's table; never counted as done
    } else if (x.state === 'closed' || merged) {
      [state, rule, basis] = ['done', '2', 'observed'];
    } else if (labelNames(x).includes('blocked')) {
      [state, rule, basis] = ['blocked', '3a', 'observed'];
    } else if (openPr && prs.some(({ pr }) => pr.state === 'open' && !pr.merged && !pr.merged_at && failing(raw.checks && raw.checks[pr.number]).length)) {
      [state, rule, basis] = ['blocked', '3b', 'inferred'];
    } else if (openPr) {
      [state, rule, basis] = ['in_progress', '4', 'inferred'];
    } else {
      [state, rule, basis] = ['left', '5', 'observed'];
    }

    items.push({
      id: `${raw.repo || ''}#${n}`, kind: x.isPr ? 'pull_request' : 'issue', title: x.title, url: x.html_url || x.url,
      state, source_state: source, rule, basis, assignees: logins(x), updated_at: x.updated_at, evidence,
    });
  }
  return items;
}

function mapJira(issues, scope) {
  const mapping = scope?.mapping?.status ?? {};
  const flagField = scope?.source?.flagged_field;
  return issues.map((issue) => {
    const fields = issue?.fields;
    const name = fields?.status?.name;
    const category = fields?.status?.statusCategory?.key;
    const flag = flagField && fields?.[flagField];
    let state, rule;
    if (typeof name !== 'string' || !name) {
      [state, rule] = ['unknown', 'J0'];
    } else if (Object.hasOwn(mapping, name) && STATES.includes(mapping[name])) {
      [state, rule] = [mapping[name], 'J1'];
    } else if (category === 'done') {
      [state, rule] = ['done', 'J2'];
    } else if ((category === 'new' || category === 'indeterminate') && Array.isArray(flag) && flag.length) {
      [state, rule] = ['blocked', 'J3'];
    } else if (category === 'indeterminate') {
      [state, rule] = ['in_progress', 'J4'];
    } else if (category === 'new') {
      [state, rule] = ['left', 'J5'];
    } else {
      [state, rule] = ['unknown', 'J6'];
    }
    const displayName = fields?.assignee?.displayName;
    const updated = typeof fields?.updated === 'string' ? Date.parse(fields.updated) : NaN;
    return { id: issue?.key, kind: 'issue', title: fields?.summary, url: '', state, source_state: name, rule, basis: 'observed',
      assignees: typeof displayName === 'string' && displayName ? [displayName] : [],
      updated_at: Number.isNaN(updated) ? null : new Date(updated).toISOString(), evidence: [] };
  });
}

function summarise(items) {
  const c = Object.fromEntries(STATES.map((s) => [s, 0]));
  for (const i of items) c[i.state]++;
  return c;
}

module.exports = { mapGithub, mapJira, summarise, STATES };
