#!/usr/bin/env node
'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn: nodeSpawn } = require('node:child_process');
const { makeRedactor } = require('../src/redact.js');
const { createCfactorySource } = require('../src/sources/cfactory.js');

const names = ['aifactory', 'pfactory', 'tfactory'];
const pattern = /^(olafkfreund|freundcloud)\/e2e-\d{8}-P1-\d+$/i;
const linkPattern = /^https:\/\/github\.com\/olafkfreund\/RFactory\/issues\/60#issuecomment-\d+$/;
const keyOf = (path) => typeof path === 'string' && pattern.test(path) ? path.toLowerCase() : null;
const order = (a, b) => typeof a === 'number' && typeof b === 'number' ? a - b :
  String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
const sorted = (rows, field) => [...rows].sort((a, b) => order(field(a), field(b)));
const plain = (value) => value && typeof value === 'object' && !Array.isArray(value);
const canon = (value) => Array.isArray(value) ? value.map(canon) : plain(value)
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canon(value[key])])) : value;
const facts = (record) => {
  const { taken_at, hash, ...rest } = record;
  return rest;
};

function hashOf(record) {
  return createHash('sha256').update(JSON.stringify(canon(facts(record)))).digest('hex');
}

function build({ cfactory, github, scopes, factories, holds, approved }) {
  const invalid = (name) => { throw new Error(name); };
  if (!plain(factories)) invalid('invalid-factories');
  for (const [id, rows] of Object.entries(factories)) {
    if (!plain(rows) || Object.keys(rows).some((key) => !names.includes(key))) invalid('invalid-factories');
    for (const row of Object.values(rows)) {
      if (!plain(row) || Object.keys(row).some((key) => !['checked', 'running'].includes(key)) ||
          typeof row.checked !== 'boolean' || typeof row.running !== 'boolean') invalid('invalid-factories');
    }
  }
  const entries = cfactory.repositories;
  const projects = cfactory.projects;
  const connections = cfactory.connections;
  const cards = cfactory.cards;
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const connectionById = new Map(connections.map((c) => [c.id, c]));
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const paths = new Set();
  for (const entry of entries) {
    const path = entry.project.toLowerCase();
    if (paths.has(path) || !projectById.has(entry.aifactory_project_id ?? `repo:${entry.id}`)) invalid('inventory-ambiguous');
    paths.add(path);
  }
  const setsByKey = new Map();
  const setFor = (key) => {
    if (!setsByKey.has(key)) setsByKey.set(key, { key, github: null, entry: null, project: null, cards: [],
      factories: Object.fromEntries(names.map((name) => [name, { checked: false, running: false }])) });
    return setsByKey.get(key);
  };
  const entryProjection = (e) => ({ id: e.id, connection_id: e.connection_id, project: e.project,
    aifactory_project_id: e.aifactory_project_id, is_default: e.id === cfactory.default_repository_id, updated_at: e.updated_at });
  const projectProjection = (p) => ({ id: p.id, name: p.name, slug: p.slug, repository_ids: sorted(p.repository_ids, (id) => id) });
  for (const entry of entries) {
    const key = keyOf(entry.project);
    if (!key) continue;
    const set = setFor(key);
    set.entry = entryProjection(entry);
    const project = projectById.get(entry.aifactory_project_id ?? `repo:${entry.id}`);
    set.project = projectProjection(project);
    set.factories = Object.fromEntries(names.map((name) => [name, { checked: factories[project.id]?.[name]?.checked ?? false,
      running: factories[project.id]?.[name]?.running ?? false }]));
  }
  for (const repo of github.repos) {
    const key = keyOf(repo.full_name);
    if (!key) continue;
    const set = setFor(key);
    if (set.github) invalid('inventory-ambiguous');
    set.github = { node_id: repo.node_id, full_name: repo.full_name, visibility: repo.visibility,
      archived: repo.archived, pushed_at: repo.pushed_at, updated_at: repo.updated_at,
      branches: sorted(repo.branches.map((b) => ({ name: b.name, sha: b.sha })), (b) => b.name),
      issues: sorted(repo.issues.map((i) => ({ number: i.number, pull: i.pull, state: i.state, updated_at: i.updated_at })), (i) => i.number),
      hooks: sorted(repo.hooks.map((h) => ({ id: h.id, host: h.host })), (h) => h.id) };
  }
  const cardProjection = (card) => ({ card_key: card.card_key, repository_id: card.repository_id,
    issue_ref: card.issue_ref, status: card.status, stage_runs: card.stage_runs ? Object.keys(card.stage_runs).length : 0,
    correlation_key: typeof card.correlation_key === 'string' && card.correlation_key.length > 0, updated_at: card.updated_at });
  const keptCards = [];
  for (const card of cards) {
    const entry = entryById.get(card.repository_id);
    const key = keyOf(entry?.project ?? (card.repository_id === null
      ? card.issue_ref?.match(/^([\w.-]+\/[\w.-]+)(?:#|\/|$)/)?.[1] : null));
    if (key && setsByKey.has(key)) setsByKey.get(key).cards.push(cardProjection(card));
    else keptCards.push(card.card_key);
  }
  const sets = sorted([...setsByKey.values()], (set) => set.key);
  for (const set of sets) set.cards = sorted(set.cards, (card) => card.card_key);
  const keptEntries = sorted(entries.filter((e) => !keyOf(e.project)).map(entryProjection), (e) => e.id);
  const setProjectIds = new Set(sets.map((set) => set.project?.id).filter(Boolean));
  const keptProjects = sorted(projects.filter((p) => !setProjectIds.has(p.id)).map(projectProjection), (p) => p.id);
  const known = new Set(github.known.map((path) => path.toLowerCase()));
  const kept = { entries: keptEntries, projects: keptProjects, cards: keptCards.sort(order),
    connections: sorted(connections.map((c) => ({ id: c.id, provider: c.provider, label: c.label })), (c) => c.id),
    github: sorted(keptEntries.map((e) => ({ full_name: e.project, exists: known.has(e.project.toLowerCase()) })), (e) => e.full_name) };
  if ([1, 2].some((id) => !keptEntries.some((e) => e.id === id)) ||
      !keptProjects.some((p) => p.id === '5d78d4b9-35f9-4445-92c1-78f3ff60a494') ||
      !kept.connections.some((c) => c.id === 1) || kept.github.some((g) => !g.exists) ||
      sets.some((set) => [1, 2].includes(set.entry?.id) || set.project?.id === '5d78d4b9-35f9-4445-92c1-78f3ff60a494' ||
        set.cards.some((card) => card.card_key.startsWith('FCT-')))) invalid('inventory-ambiguous');

  if (!plain(holds) || Object.keys(holds).some((key) => !['holds', 'releases', 'archive'].includes(key)) ||
      !['holds', 'releases', 'archive'].every((key) => Array.isArray(holds[key]))) invalid('invalid-holds');
  const targets = (line) => sets.filter((set) => line.repository_id !== undefined
    ? set.entry?.id === line.repository_id : set.key === line.github.toLowerCase());
  for (const list of ['holds', 'releases', 'archive']) {
    const seen = new Set();
    for (const line of holds[list]) {
      const allowed = list === 'holds' ? ['repository_id', 'github', 'reason'] :
        list === 'releases' ? ['repository_id', 'github', 'kind', 'by', 'link'] : ['repository_id', 'github', 'by', 'link'];
      if (!plain(line) || Object.keys(line).some((key) => !allowed.includes(key)) ||
          (Object.hasOwn(line, 'repository_id') ? !Number.isInteger(line.repository_id) || Object.hasOwn(line, 'github')
            : typeof line.github !== 'string') ||
          (list === 'holds' ? typeof line.reason !== 'string' || !line.reason.trim() :
            typeof line.by !== 'string' || !line.by.trim() || !linkPattern.test(line.link)) ||
          (list === 'releases' && !['named', 'unpaired', 'owner', 'not-checked'].includes(line.kind))) invalid('invalid-holds');
      const matches = (approved?.sets ?? sets).filter((set) => line.repository_id !== undefined
        ? set.entry?.id === line.repository_id : set.key === line.github.toLowerCase());
      const token = `${matches[0]?.key}:${line.kind ?? ''}`;
      if (matches.length !== 1 || seen.has(token) || (list === 'archive' && !matches[0].github)) invalid('invalid-holds');
      seen.add(token);
    }
  }
  const sortLines = (lines) => [...lines].sort((a, b) => order(a.repository_id ?? a.github.toLowerCase(), b.repository_id ?? b.github.toLowerCase()) ||
    order(a.kind ?? '', b.kind ?? ''));
  const recordedHolds = Object.fromEntries(['holds', 'releases', 'archive'].map((key) => [key, sortLines(holds[key])
    .map((line) => Object.fromEntries(Object.entries(line).map(([k, v]) => [k, k === 'github' ? v.toLowerCase() : v])))]));
  const scopeIds = new Set([...scopes.cluster, ...scopes.p620]);
  for (const set of sets) {
    const reasons = [];
    if (holds.holds.some((line) => targets(line)[0] === set)) reasons.push('named');
    if (!set.github || !set.entry || connectionById.get(set.entry.connection_id)?.provider !== 'github') reasons.push('unpaired');
    if (set.key.startsWith('freundcloud/')) reasons.push('owner');
    if (!set.project || names.some((name) => !set.factories[name].checked)) reasons.push('not-checked');
    if (scopeIds.has(set.project?.id)) reasons.push('scope');
    if (set.entry?.id === cfactory.default_repository_id) reasons.push('default');
    if (set.cards.some((card) => card.status !== 'backlog' || card.stage_runs > 0 || card.correlation_key) ||
        names.some((name) => set.factories[name].running)) reasons.push('running-work');
    set.reasons = reasons.filter((kind) => !holds.releases.some((line) => line.kind === kind && targets(line)[0] === set));
  }
  const passOne = new Map(sets.map((set) => [set.key, set.reasons.length]));
  for (const set of sets) {
    if (!set.project) continue;
    if (set.project.repository_ids.some((id) => id !== set.entry?.id &&
        (!entryById.has(id) || !keyOf(entryById.get(id).project) ||
          passOne.get(keyOf(entryById.get(id).project))))) set.reasons.push('shared-project');
  }
  for (const set of sets) {
    const archive = holds.archive.some((line) => targets(line)[0] === set);
    set.state = set.reasons.length ? 'held' : archive ? 'archive' : 'remove';
    set.actions = set.state === 'held' ? [] : [
      ...set.cards.map((card) => `delete card ${card.card_key}`),
      ...(set.entry ? [`delete entry ${set.entry.id}`] : []),
      ...(set.entry?.aifactory_project_id != null ? [`unregister aifactory project ${set.entry.aifactory_project_id}`] : []),
      ...(set.github ? [`${archive ? 'archive' : 'delete'} repository ${set.github.full_name}`] : [])];
  }
  const record = { version: 1, taken_at: new Date().toISOString(), hash: '', default_repository_id: cfactory.default_repository_id,
    scopes: { cluster: [...scopes.cluster].sort(order), p620: [...scopes.p620].sort(order) }, holds: recordedHolds, sets, kept };
  record.hash = hashOf(record);
  return record;
}

function compare(approved, fresh) {
  const changes = [];
  const walk = (old, now, path, inSet = false) => {
    if (JSON.stringify(canon(old)) === JSON.stringify(canon(now))) return;
    if (Array.isArray(old) && Array.isArray(now)) {
      const identity = ['card_key', 'number', 'id', 'name'].find((key) =>
        [...old, ...now].length && [...old, ...now].every((item) => plain(item) && item[key] !== undefined));
      if (identity) {
        const a = new Map(old.map((item) => [String(item[identity]), item]));
        const b = new Map(now.map((item) => [String(item[identity]), item]));
        for (const id of sorted([...new Set([...a.keys(), ...b.keys()])], (v) => v)) {
          if (!a.has(id)) changes.push(`new ${path} ${id}`);
          else if (!b.has(id)) changes.push(`gone ${path} ${id}`);
          else walk(a.get(id), b.get(id), `${path}.${id}`, inSet);
        }
      } else for (let i = 0; i < Math.max(old.length, now.length); i++) walk(old[i], now[i], `${path}.${i}`, inSet);
    } else if (plain(old) && plain(now)) {
      for (const key of Object.keys({ ...old, ...now }).sort()) walk(old[key], now[key], path ? `${path}.${key}` : key, inSet);
    } else changes.push(`changed ${inSet ? path.replace('.', ' ') : path}: ${JSON.stringify(old) ?? 'undefined'} -> ${JSON.stringify(now) ?? 'undefined'}`);
  };
  const a = new Map(approved.sets.map((set) => [set.key, set]));
  const b = new Map(fresh.sets.map((set) => [set.key, set]));
  for (const key of sorted([...new Set([...a.keys(), ...b.keys()])], (v) => v)) {
    if (!a.has(key)) changes.push(`new set ${key}`);
    else if (!b.has(key)) changes.push(`gone set ${key}`);
    else walk(a.get(key), b.get(key), key, true);
  }
  walk({ ...facts(approved), sets: undefined }, { ...facts(fresh), sets: undefined }, '');
  if (!changes.length && hashOf(approved) !== hashOf(fresh)) changes.push('changed record');
  return changes;
}

function compareAfter(approved, fresh) {
  const changes = [];
  const freshSets = new Map(fresh.sets.map((set) => [set.key, set]));
  const approvedKeys = new Set(approved.sets.map((set) => set.key));
  for (const set of approved.sets) {
    const now = freshSets.get(set.key);
    if (set.state === 'held') {
      if (!now) changes.push(`gone set ${set.key}`);
      else for (const field of ['github', 'entry', 'project', 'cards', 'factories']) {
        if (JSON.stringify(canon(set[field])) !== JSON.stringify(canon(now[field]))) changes.push(`changed ${set.key} ${field}`);
      }
      continue;
    }
    const allEntries = [...fresh.sets.map((s) => s.entry), ...fresh.kept.entries].filter(Boolean);
    const allProjects = [...fresh.sets.map((s) => s.project), ...fresh.kept.projects].filter(Boolean);
    const allCards = [...fresh.sets.flatMap((s) => s.cards.map((c) => c.card_key)), ...fresh.kept.cards];
    if (set.entry && allEntries.some((e) => e.id === set.entry.id)) changes.push(`changed ${set.key} entry remains`);
    if (set.project && allProjects.some((p) => p.id === set.project.id)) changes.push(`changed ${set.key} project remains`);
    for (const card of set.cards) if (allCards.includes(card.card_key)) changes.push(`changed ${set.key} card ${card.card_key} remains`);
    if (set.state === 'remove' && now) changes.push(`changed ${set.key} repository remains`);
    if (set.state === 'archive' && (!now || !now.github || now.github.full_name !== set.github.full_name ||
        now.github.node_id !== set.github.node_id || now.github.archived !== true || now.entry || now.project || now.cards.length))
      changes.push(`changed ${set.key} archive incomplete`);
  }
  for (const set of fresh.sets) if (!approvedKeys.has(set.key)) changes.push(`new set ${set.key}`);
  for (const field of ['kept', 'default_repository_id', 'scopes']) {
    if (JSON.stringify(canon(approved[field])) !== JSON.stringify(canon(fresh[field]))) changes.push(`changed ${field}`);
  }
  return changes;
}

const fail = (message) => new Error(message);
const E2E_NAME = /^e2e-\d{8}-P1-\d+$/i;
const FIXED = new Set(['github-read-failed', 'scope-read-failed', 'key-read-failed', 'holds-read-failed',
  'factories-read-failed', 'list-read-failed', 'list-hash-mismatch', 'out-exists', 'inventory-read-failed',
  'inventory-ambiguous', 'invalid-holds', 'invalid-factories']);
const USAGE = 'usage: e2e-inventory --holds <file> --out <file> [--factories <file>] | ' +
  'e2e-inventory --check <list.json> --holds <file> [--factories <file>] [--after]';

// every gh call is a GET with fixed arguments and no shell; stderr is dropped so no raw error text can leak
function readGithub(spawn) {
  const get = (endpoint) => new Promise((resolve, reject) => {
    const bad = () => reject(fail('github-read-failed'));
    let child;
    try { child = spawn('gh', ['api', '--method', 'GET', '--paginate', '--slurp', endpoint], { stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return bad(); }
    let text = '';
    let done = false;
    const end = (fn) => { if (!done) { done = true; clearTimeout(timer); fn(); } };
    const timer = setTimeout(() => end(() => { try { child.kill(); } catch {} bad(); }), 60000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { text += chunk; });
    child.on('error', () => end(bad));
    child.on('close', (code) => end(() => {
      if (code !== 0) return bad();
      try {
        const pages = JSON.parse(text);
        if (Array.isArray(pages)) resolve(pages); else bad();
      } catch { bad(); }
    }));
  });
  const list = async (endpoint) => {
    const pages = await get(endpoint);
    if (!pages.every(Array.isArray)) throw fail('github-read-failed');
    return pages.flat();
  };
  // shortcut: with --slurp a silently missing last page cannot be told from a short result; we rely on gh exiting non-zero
  // when a page request fails. Upgrade to reading the Link header (gh api -i) if a repository ever nears 100 branches or issues.
  return (async () => {
    const user = await get('/user');
    if (user.length !== 1 || user[0]?.login !== 'olafkfreund') throw fail('github-read-failed');
    const seen = new Map();
    for (const row of [...await list('/user/repos?affiliation=owner&per_page=100'), ...await list('/orgs/Freundcloud/repos?type=all&per_page=100')]) {
      if (!plain(row) || !plain(row.owner) || ![row.node_id, row.full_name, row.name, row.owner.login, row.visibility].every((v) => typeof v === 'string')
          || !/^[\w.-]+\/[\w.-]+$/.test(row.full_name) || row.full_name.split('/').some((part) => /^\.+$/.test(part))) throw fail('github-read-failed');
      if (!seen.has(row.full_name)) seen.set(row.full_name, row);
    }
    const repos = [];
    for (const row of seen.values()) {
      if (!E2E_NAME.test(row.name) || !['olafkfreund', 'freundcloud'].includes(row.owner.login.toLowerCase())) continue;
      if (row.full_name !== `${row.owner.login}/${row.name}`) throw fail('github-read-failed');
      const base = `/repos/${row.full_name}`;
      const branches = (await list(`${base}/branches?per_page=100`)).map((b) => {
        if (!plain(b) || typeof b.name !== 'string' || typeof b.commit?.sha !== 'string') throw fail('github-read-failed');
        return { name: b.name, sha: b.commit.sha };
      });
      const issues = (await list(`${base}/issues?state=all&per_page=100`)).map((i) => {
        if (!plain(i) || !Number.isInteger(i.number) || typeof i.state !== 'string') throw fail('github-read-failed');
        return { number: i.number, pull: Object.hasOwn(i, 'pull_request'), state: i.state, updated_at: i.updated_at ?? null };
      });
      const hooks = (await list(`${base}/hooks?per_page=100`)).map((h) => {
        if (!plain(h) || !Number.isInteger(h.id)) throw fail('github-read-failed');
        let host = 'invalid';
        try { host = new URL(h.config.url).host; } catch {}
        return { id: h.id, host };
      });
      repos.push({ node_id: row.node_id, full_name: row.full_name, visibility: row.visibility, archived: row.archived === true,
        pushed_at: row.pushed_at ?? null, updated_at: row.updated_at ?? null, branches, issues, hooks });
    }
    return { repos, known: [...seen.keys()] };
  })();
}

// not loadScope: that checks write flags against the environment and reads the GitHub token file
function readScopes(dir) {
  const idPattern = /^(repo:\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
  const read = (name) => {
    try {
      const scope = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      if (!plain(scope)) throw new Error('shape');
      if (!Object.hasOwn(scope, 'projects')) return { scope, ids: [] };
      const allow = scope.projects?.allow;
      if (!plain(scope.projects) || Object.keys(scope.projects).join() !== 'allow' || !Array.isArray(allow) || allow.length < 1 || allow.length > 50 ||
          !allow.every((p) => plain(p) && Object.keys(p).join() === 'id' && typeof p.id === 'string' && idPattern.test(p.id)) ||
          new Set(allow.map((p) => p.id)).size !== allow.length) throw new Error('shape');
      return { scope, ids: allow.map((p) => p.id) };
    } catch { throw fail('scope-read-failed'); }
  };
  const cluster = read('scope.cluster.json');
  const local = read('scope.json');
  return { cluster: cluster.ids, p620: local.ids, scope: local.scope };
}

// the checks of core/src/scope.js, minus everything about writes; the write key file is never opened
function readKey(scope) {
  try {
    const source = scope.source;
    if (source?.kind !== 'cfactory' || typeof source.mcp_url !== 'string' || !URL.canParse(source.mcp_url) ||
        !Number.isInteger(source.repository_id) || typeof source.key_file !== 'string' || !path.isAbsolute(source.key_file)) throw new Error('shape');
    const url = new URL(source.mcp_url);
    if (url.protocol !== 'https:' && (url.protocol !== 'http:' || url.hostname !== '127.0.0.1')) throw new Error('shape');
    if (typeof source.write_key_file === 'string') {
      let writeReal;
      try { writeReal = fs.realpathSync(source.write_key_file); } catch {} // a path that does not exist cannot be the read key
      if (writeReal !== undefined && writeReal === fs.realpathSync(source.key_file)) throw new Error('same-key');
    }
    const fd = fs.openSync(source.key_file, 'r');
    let key;
    try {
      if (fs.fstatSync(fd).mode & 0o077) throw new Error('mode');
      key = fs.readFileSync(fd, 'utf8').trim();
    } finally { fs.closeSync(fd); }
    if (!/^(acw|cfk)_[A-Za-z0-9]{16,}$/.test(key)) throw new Error('shape');
    return { key, mcpUrl: source.mcp_url, repositoryId: source.repository_id };
  } catch { throw fail('key-read-failed'); }
}

function readJson(file, message) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw fail(message); }
}

// every input value goes in a code span, so Markdown in a name cannot change the list
const code = (value) => `\`${String(value ?? '-').replace(/[`|\r\n]/g, '?')}\``;
const codes = (values) => values.length ? values.map(code).join(', ') : code('-');
function render(record) {
  const lines = [`# e2e-* inventory`, '', `hash: ${code(record.hash)}`, `taken_at: ${code(record.taken_at)}`, '',
    '| set | state | reasons | actions | entry | project | cards | branches | issues and pull requests | webhooks | factories |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
  for (const set of record.sets) {
    lines.push(`| ${[code(set.key), code(set.state), codes(set.reasons), codes(set.actions), code(set.entry?.id), code(set.project?.id),
      codes(set.cards.map((c) => `${c.card_key} ${c.status}`)),
      codes((set.github?.branches ?? []).map((b) => `${b.name} ${b.sha}`)),
      codes((set.github?.issues ?? []).map((i) => `${i.pull ? 'pull' : 'issue'} ${i.number} ${i.state}`)),
      codes((set.github?.hooks ?? []).map((h) => `${h.id} ${h.host}`)),
      codes(Object.entries(set.factories).map(([name, f]) => `${name} checked=${f.checked} running=${f.running}`))].join(' | ')} |`);
  }
  lines.push('', '## Releases and archive lines', '');
  const lineOf = (kind, l) => `- ${code(kind)} ${code(l.repository_id ?? l.github)} by ${code(l.by)} ${code(l.link)}`;
  const recorded = [...record.holds.releases.map((l) => lineOf(l.kind, l)), ...record.holds.archive.map((l) => lineOf('archive', l))];
  lines.push(...(recorded.length ? recorded : ['- none']));
  lines.push('', '## Holds', '', ...(record.holds.holds.length ? record.holds.holds.map((l) => `- ${code(l.repository_id ?? l.github)} ${code(l.reason)}`) : ['- none']));
  lines.push('', '## Kept', '',
    `- entries: ${codes(record.kept.entries.map((e) => `${e.id} ${e.project}`))}`,
    `- projects: ${codes(record.kept.projects.map((p) => `${p.id} ${p.name}`))}`,
    `- connections: ${codes(record.kept.connections.map((c) => `${c.id} ${c.provider}`))}`,
    `- repositories: ${codes(record.kept.github.map((g) => `${g.full_name} exists=${g.exists}`))}`,
    `- cards: ${codes(record.kept.cards)}`);
  lines.push('', 'After removal CFactory keeps soft-deleted card rows, their comments, card keys and audit records. ' +
    'The cluster Secret was not read (the local scope.cluster.json was). AIFactory is checked by hand.');
  return lines.join('\n');
}

function parseArgs(argv) {
  const flags = { '--holds': 1, '--out': 1, '--factories': 1, '--check': 1, '--after': 0 };
  const got = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (!Object.hasOwn(flags, name) || Object.hasOwn(got, name)) return null;
    if (flags[name]) {
      if (typeof argv[i + 1] !== 'string' || argv[i + 1].startsWith('--')) return null;
      got[name] = argv[++i];
    } else got[name] = true;
  }
  const check = Object.hasOwn(got, '--check');
  if (!got['--holds'] || (check ? Object.hasOwn(got, '--out') : !got['--out'] || got['--after'])) return null;
  return got;
}

async function main(argv, env, write, { spawn = nodeSpawn, sourceFactory = createCfactorySource } = {}) {
  let redactor = makeRedactor([]);
  const out = (s) => write(redactor.logSafe(s));
  const args = parseArgs(argv);
  if (!args) { out(USAGE); return 2; }
  let source;
  try {
    const holds = readJson(args['--holds'], 'holds-read-failed');
    const factories = args['--factories'] ? readJson(args['--factories'], 'factories-read-failed') : {};
    const approved = args['--check'] ? readJson(args['--check'], 'list-read-failed') : null;
    if (approved && !(plain(approved) && approved.version === 1 && typeof approved.hash === 'string' && hashOf(approved) === approved.hash)) throw fail('list-hash-mismatch');
    const scopes = readScopes(env.RFACTORY_CONFIG || `${env.HOME}/.config/rfactory`);
    const { key, mcpUrl, repositoryId } = readKey(scopes.scope);
    redactor = makeRedactor([key]);
    let cfactory;
    try {
      source = sourceFactory({ mcpUrl, key, repositoryId, redactor });
      await source.start();
      cfactory = await source.inventory();
    } catch { throw fail('inventory-read-failed'); }
    const github = await readGithub(spawn);
    // redaction before the hash, so the file on disk verifies
    const record = redactor.logSafe(build({ cfactory, github, scopes: { cluster: scopes.cluster, p620: scopes.p620 }, factories, holds,
      approved: args['--after'] ? approved : null }));
    record.taken_at = new Date().toISOString();
    record.hash = hashOf(record);
    if (approved) {
      const changes = args['--after'] ? compareAfter(approved, record) : compare(approved, record);
      for (const line of changes) out(line);
      return changes.length ? 1 : 0;
    }
    const markdown = render(record);
    try { fs.writeFileSync(args['--out'], `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx', mode: 0o600 }); } catch (e) {
      throw fail(e?.code === 'EEXIST' ? 'out-exists' : 'internal');
    }
    out(markdown);
    return 0;
  } catch (e) {
    out(`error: ${FIXED.has(e?.message) ? e.message : 'internal'}`);
    return 4;
  } finally {
    try { await source?.close(); } catch {}
  }
}

if (require.main === module) {
  main(process.argv.slice(2), process.env, (s) => process.stdout.write(`${s}\n`)).then((code) => { process.exitCode = code; });
}

module.exports = { main, build, hashOf, compare, compareAfter };
