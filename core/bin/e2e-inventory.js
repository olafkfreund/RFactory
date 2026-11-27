#!/usr/bin/env node
'use strict';

const { createHash } = require('node:crypto');

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

function build({ cfactory, github, scopes, factories, holds }) {
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
      const matches = targets(line);
      const token = `${matches[0]?.key}:${line.kind ?? ''}`;
      if (matches.length !== 1 || seen.has(token)) invalid('invalid-holds');
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
    if (archive && !set.github) invalid('invalid-holds');
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

module.exports = { build, hashOf, compare, compareAfter };
