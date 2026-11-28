'use strict';

const { randomUUID } = require('node:crypto');
const { validate, hashPayload, canonical } = require('@rfactory/core/src/actions/allowlist.js');
const { deriveEffects, describe } = require('@rfactory/core/src/actions/effects.js');
const { closeEvidence } = require('@rfactory/core/src/notes.js');

const LIMIT = 10;
const PENDING_LIMIT = 5;
const LIFETIME = 10 * 60 * 1000;
const FINAL = new Set(['done', 'done (started)', 'done, start failed', 'already done', 'failed', 'uncertain']);
const reply = (status, text, action) => ({ status, text, ...(action ? { action } : {}) });

function createActionManager({ readSource, writer, brain, record, redactor, clock = Date, scope, roles, enabled, rebind }) {
  const now = () => clock.now();
  const safe = (value) => redactor.logSafe(value);
  const listeners = new Set();
  const history = [];
  let pending = new Map();
  let generation;
  let callTarget;
  let budget = { used: 0 };
  let recovered = false;

  function emit(type, action, generation) {
    const event = { ...safe({ type, action }), generation };
    for (const fn of listeners) { try { fn(event); } catch { /* A closed subscriber cannot interrupt a write. */ } }
  }

  async function finish(entry, state, extra = {}) {
    entry.state = state;
    if (entry.timer) (clock.clearTimeout || clearTimeout)(entry.timer);
    pending.delete(entry.payload.id);
    const item = safe({ ...entry.payload, hash: entry.hash, state, ...(entry.project_id ? { project_id: entry.project_id } : {}), ...extra });
    await record.append(item);
    history.push(item);
    emit('action-updated', item, entry.generation);
    return item;
  }

  function live(entry) {
    return generation === entry.generation && now() < Date.parse(entry.payload.expires_at);
  }

  async function expire(entry) {
    if (entry.state === 'pending') await finish(entry, 'expired');
  }

  const description = (payload, effects, binding) => binding?.repositories.length > 1
    ? `${describe(payload, effects).slice(0, -1)} in ${payload.repository_path}.` : describe(payload, effects);

  async function request(text, speaker, { captionsMode = false } = {}) {
    if (!enabled || !scope.writes_enabled) return reply(403, 'Changes are turned off here.');
    if (generation === undefined) return reply(409, 'There is no call right now.');
    const callGeneration = generation;
    const target = callTarget;
    const source = target?.view || readSource;
    const repositories = target?.binding?.repositories;
    const snapshot = await source.snapshot();
    if (callGeneration !== generation) return reply(409, 'The call has ended.');
    const proposal = await brain.propose(snapshot, { deadline: now() + 55000, request: text,
      ...(repositories ? { repositories } : {}), captionsMode });
    if (callGeneration !== generation) return reply(409, 'The call has ended.');
    if (proposal.action === 'none') return { status: 200, question: true };
    return submit(proposal, speaker, { generation: callGeneration, snapshotKeys: new Set(snapshot.items.map((item) => item.id)),
      defaultRepositoryOnly: false });
  }

  async function submit(proposal, speaker, {
    generation: callGeneration, snapshotKeys, evidence = false, confirm, quiet = false, defaultRepositoryOnly = true,
  } = {}) {
    if (!enabled || !scope.writes_enabled) return reply(403, 'Changes are turned off here.');
    if (generation === undefined) return reply(409, 'There is no call right now.');
    if (callGeneration === undefined || callGeneration !== generation) return reply(409, 'The call has ended.');
    const target = callTarget;
    const source = target?.view || readSource;
    let repositories = target?.binding?.repositories;
    if (defaultRepositoryOnly) repositories = repositories?.filter((repo) => repo.id === scope.source.repository_id);
    const checked = validate(proposal, { scope, snapshotKeys, redactor, repositories });
    if (!checked.ok) return reply(400, checked.reason);
    const { action, args } = checked.payload;
    const card_key = args.card_key || null;
    let before = null;
    let repositoryId = args.repository_id;
    if (card_key) {
      const found = await source.getCard(card_key);
      if (callGeneration !== generation) return reply(409, 'The call has ended.');
      if (found.error || !found.inRepository) return reply(400, "I can't do that.");
      before = found.card;
      if (repositories && !repositories.some((repo) => repo.id === found.repositoryId)) return reply(400, "I can't do that.");
      repositoryId = found.repositoryId;
    }
    const proof = evidence ? safe(closeEvidence(before)) : null;
    if (proof?.verdict === 'contradicted' && confirm !== hashPayload(proof)) {
      return { ...reply(409, 'The stage results contradict this.'), contradicted: true,
        evidence: proof, evidence_hash: hashPayload(proof) };
    }
    for (const entry of [...pending.values()]) if (!live(entry)) await expire(entry);
    if (callGeneration !== generation) return reply(409, 'The call has ended.');
    if (pending.size >= PENDING_LIMIT) return reply(409, 'There are already five actions waiting for approval.');
    const effects = deriveEffects(action, args, before);
    const proposed_at = new Date(now()).toISOString();
    const safeArgs = structuredClone(args);
    if (safeArgs.acceptance_criteria) Object.freeze(safeArgs.acceptance_criteria);
    const payload = Object.freeze({ id: randomUUID(), action, args: Object.freeze(safeArgs),
      effects: Object.freeze(structuredClone(effects)), card_key, card_updated_at: before?.updated_at || null,
      ...(repositories ? { project_id: target.binding.projectId, repository_id: repositoryId,
        repository_path: repositories.find((repo) => repo.id === repositoryId).path } : {}),
      proposed_by: safe(String(speaker || 'Unknown')), proposed_at,
      ...(proof ? { evidence: Object.freeze({ ...proof, stages: Object.freeze(proof.stages.map((stage) => Object.freeze(stage))) }) } : {}),
      expires_at: new Date(now() + LIFETIME).toISOString() });
    const hash = hashPayload(payload);
    const entry = { payload, hash, state: 'pending', generation: callGeneration,
      ...(!repositories && target?.projectId ? { project_id: target.projectId } : {}), budget, quiet, view: source, binding: target?.binding };
    pending.set(payload.id, entry);
    try { await record.append({ ...payload, hash, state: 'proposed', ...(entry.project_id ? { project_id: entry.project_id } : {}) }); }
    catch { pending.delete(payload.id); return reply(500, 'The action could not be recorded.'); }
    if (callGeneration !== generation) { await expire(entry); return reply(409, 'The call has ended.'); }
    entry.timer = (clock.setTimeout || setTimeout)(() => { expire(entry).catch(() => {}); }, Math.max(0, Date.parse(payload.expires_at) - now()));
    entry.timer.unref?.();
    emit('action-pending', { ...payload, hash, state: 'pending', description: description(payload, effects, entry.binding),
      ...(entry.project_id ? { project_id: entry.project_id } : {}) }, callGeneration);
    return reply(202, safe(description(payload, effects, entry.binding)), safe({ ...payload, hash }));
  }

  async function approve(id, email, hash) {
    if (!recovered) return reply(503, 'Actions are recovering.');
    if (!roles.has(email, 'approver')) return reply(403, 'Forbidden.');
    const entry = pending.get(id);
    if (!entry || entry.hash !== hash || entry.state !== 'pending') return reply(409, 'This action is no longer pending.');
    if (!live(entry)) { await expire(entry); return reply(409, 'This action has expired.'); }
    const reserved = entry.payload.effects.stages.length;
    if (entry.budget.used + reserved > LIMIT) return reply(409, 'The call has reached its work limit.');
    // Claim and reserve synchronously: another approval cannot pass these checks.
    entry.state = 'executing';
    pending.delete(id);
    entry.budget.used += reserved;
    const base = { ...entry.payload, hash, approved_by: String(email).toLowerCase(),
      ...(entry.project_id ? { project_id: entry.project_id } : {}) };
    try {
      await record.append({ ...base, state: 'approved' });
      await record.append({ ...base, state: 'executing' });
    } catch {
      entry.budget.used -= reserved;
      entry.state = 'failed';
      return reply(500, 'The action could not be recorded.');
    }

    let state;
    try {
      if (!enabled || !scope.writes_enabled || !live(entry)) state = 'expired';
      let repository;
      if (!state && entry.binding) {
        try {
          const fresh = await rebind(entry.payload.project_id);
          repository = fresh.repositories.find((repo) => repo.id === entry.payload.repository_id);
          if (fresh.projectId !== entry.payload.project_id || !repository) state = 'refused';
        } catch { state = 'refused'; }
      }
      let before = null;
      if (!state && entry.payload.card_key) {
        try {
          const found = await entry.view.getCard(entry.payload.card_key);
          if (found.error || !found.inRepository || found.card.updated_at !== entry.payload.card_updated_at ||
              (entry.binding && found.repositoryId !== entry.payload.repository_id) ||
              (entry.payload.evidence && canonical(safe(closeEvidence(found.card))) !== canonical(entry.payload.evidence))) state = 'expired';
          else before = found.card;
        } catch { state = 'expired'; } // re-check could not read the card: nothing was sent, so not uncertain
      }
      if (!state) {
        const snapshotKeys = entry.payload.card_key ? new Set([entry.payload.card_key]) : new Set();
        const proposal = { action: entry.payload.action, args: { ...entry.payload.args } };
        if (proposal.action === 'create_card' && !entry.binding) delete proposal.args.repository_id;
        const checked = validate(proposal, { scope, snapshotKeys, redactor,
          repositories: entry.binding ? [repository] : undefined });
        if (!checked.ok || canonical(checked.payload.args) !== canonical(entry.payload.args) ||
            canonical(deriveEffects(entry.payload.action, entry.payload.args, before)) !== canonical(entry.payload.effects)) state = 'refused';
      }
      if (!state && !live(entry)) state = 'expired';
      if (state) {
        entry.budget.used -= reserved;
        await finish(entry, state, { approved_by: base.approved_by });
        const result = reply(state === 'uncertain' ? 200 : 409, state === 'expired' ? 'This action has expired.'
          : state === 'uncertain' ? "I'm not sure that went through; check the board." : "I can't do that.");
        emit('action-result', { generation: entry.generation, text: result.text }, entry.generation);
        return result;
      }
      let result;
      try { result = await writer.apply(entry.payload.action, entry.payload.args, before); }
      catch { result = { outcome: 'uncertain', detail: 'The result could not be confirmed.' }; }
      state = FINAL.has(result?.outcome) ? result.outcome : 'uncertain';
      if (!['done (started)', 'uncertain'].includes(state)) entry.budget.used -= reserved;
      const item = await finish(entry, state, { approved_by: base.approved_by, detail: safe(result?.detail || ''), card: safe(result?.card || null) });
      const target = entry.payload.card_key || (entry.quiet ? 'the new card' : `'${entry.payload.args.title}'`);
      const work = { plan_card: 'planning', code_card: 'build', test_card: 'test', run_card: 'work' }[entry.payload.action] || 'work';
      let sentence = state === 'uncertain' ? `I'm not sure ${target} went through; check the board.`
        : state === 'already done' ? `${target}'s ${work} already finished.`
          : state === 'done (started)' ? entry.payload.action === 'run_card'
            ? `${target} starts ${entry.payload.effects.stages.map((name) => ({ plan: 'planning', code: 'a build', test: 'tests' })[name]).join(', then ')}.`
            : `${target} changed and work started.`
            : state === 'done, start failed' ? `${target} changed, but work did not start.`
              : state === 'done' ? `${target} changed.` : `${target} failed.${entry.quiet ? '' : ` ${item.detail}`}`;
      if (entry.quiet && !entry.payload.card_key) sentence = sentence[0].toUpperCase() + sentence.slice(1);
      emit('action-result', { generation: entry.generation, text: safe(sentence) }, entry.generation);
      return reply(200, safe(sentence), item);
    } catch {
      // After dispatch or an unconfirmed record write, do not retry the action.
      return reply(500, 'The result could not be recorded.');
    }
  }

  async function reject(id, email, hash) {
    if (!recovered) return reply(503, 'Actions are recovering.');
    if (!roles.has(email, 'approver')) return reply(403, 'Forbidden.');
    const entry = pending.get(id);
    if (!entry || entry.hash !== hash || entry.state !== 'pending') return reply(409, 'This action is no longer pending.');
    if (!live(entry)) { await expire(entry); return reply(409, 'This action has expired.'); }
    await finish(entry, 'rejected', { rejected_by: String(email).toLowerCase() });
    return reply(200, 'Action rejected.');
  }

  function list(includeExpired = false) {
    return { pending: [...pending.values()].filter((entry) => includeExpired || live(entry)).map((entry) => safe({ ...entry.payload, hash: entry.hash, state: entry.state,
      description: description(entry.payload, entry.payload.effects, entry.binding),
      ...(entry.project_id ? { project_id: entry.project_id } : {}) })), history: history.map(safe) };
  }

  function startCall(nextGeneration, target) {
    const old = [...pending.values()];
    pending = new Map();
    generation = nextGeneration;
    callTarget = target;
    budget = { used: 0 };
    history.length = 0;
    return Promise.all(old.map(expire));
  }

  function endCall() {
    const old = [...pending.values()];
    pending = new Map();
    generation = undefined;
    callTarget = undefined;
    return Promise.all(old.map(expire));
  }

  async function recover() {
    for (const entry of record.unfinished()) {
      const item = safe({ ...entry, state: 'uncertain', detail: 'The result could not be confirmed.' });
      await record.append(item);
      history.push(item);
      emit('action-updated', item);
    }
    recovered = true;
  }

  return { request, submit, approve, reject, list, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    startCall, endCall, recover };
}

module.exports = { createActionManager };
