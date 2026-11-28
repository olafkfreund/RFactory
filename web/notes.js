'use strict';

const { randomUUID } = require('node:crypto');
const { checkNote, sentence, headline, toMarkdown, notesHash } = require('@rfactory/core/src/notes.js');

const MAX_NOTES = 50;
const KEEP = 24 * 60 * 60 * 1000;
const reply = (status, text, extra) => ({ status, text, ...extra });
const same = (a, b) => (a == null ? b == null : b != null && String(a) === String(b));

function createNotesManager({ record, redactor, roles, actions, clock = globalThis }) {
  const now = () => (typeof clock.now === 'function' ? clock.now() : Date.now());
  const iso = () => new Date(now()).toISOString();
  const listeners = new Set();
  const ended = new Map();
  let running = null;

  const lower = (email) => String(email).toLowerCase();
  const isApprover = (email) => roles.has(email, 'approver');
  const counts = (set) => Object.fromEntries(['decision', 'action', 'blocker', 'discussed']
    .map((kind) => [kind, set.notes.filter((note) => note.kind === kind).length]));
  const busy = (set) => set.proposals.some((p) => p.state === 'submitting' || p.state === 'pending');

  // The set a route names: unknown when it is another project's or past its 24 hours.
  function find(setId, projectId) {
    const set = running?.id === setId ? running : ended.get(setId);
    if (!set || !same(set.project?.id, projectId)) return null;
    if (set !== running && now() >= Date.parse(set.ended_at) + KEEP) return null;
    return set;
  }

  function view(set) {
    return structuredClone({
      id: set.id, generation: set.generation, project: set.project, writable: set.writable,
      intake: set.intake, started_at: set.started_at, ended_at: set.ended_at, state: set.state,
      running: set === running, notes: set.notes, approved_by: set.approved_by, hash: set.hash,
      proposals: set.proposals.map(({ id, note_id, what, action, card_key, title, state }) => ({ id, note_id, what, action, card_key, title, state })),
    });
  }

  function emit(set) {
    if (set !== running) return;
    const event = { ...redactor.logSafe({ type: 'notes', set: view(set) }), generation: set.generation };
    for (const fn of listeners) { try { fn(event); } catch { /* A closed subscriber cannot interrupt a note. */ } }
  }

  const line = (set, state, by, hash) => record.append({ kind: 'notes', id: set.id, state, by,
    project_id: set.project?.id ?? null, destination: 'page', hash, counts: counts(set) });

  async function sweep(set) {
    if (set.state === 'open') {
      set.state = 'expired';
      ended.delete(set.id);
      try { await line(set, 'expired', null, null); } catch { console.error('notes record failed'); }
    } else if (set.state === 'approving') {
      set.timer = clock.setTimeout(() => { sweep(set); }, 1000);
      set.timer.unref?.();
    } else ended.delete(set.id);
  }

  function startCall(generation, { project = null, writable = false } = {}) {
    endCall();
    running = { id: randomUUID(), generation, project: project ? { id: project.id, name: project.name } : null,
      writable: writable === true, intake: true, started_at: iso(), ended_at: null, state: 'open',
      notes: [], proposals: [], approved_by: null, frozen: null, hash: null };
  }

  function closeIntake() { if (running) running.intake = false; }

  function endCall() {
    const set = running;
    if (!set) return;
    running = null;
    set.intake = false;
    set.ended_at = iso();
    if (!set.notes.length) return;
    ended.set(set.id, set);
    set.timer = clock.setTimeout(() => { sweep(set); }, KEEP);
    set.timer.unref?.();
  }

  function note(raw, { snapshotKeys, speaker, generation } = {}) {
    const set = running;
    if (!set || set.generation !== generation || !set.intake) return { dropped: true };
    if (set.notes.length >= MAX_NOTES) return { text: 'I already have fifty notes for this call.' };
    const checked = checkNote(raw, { snapshotKeys: snapshotKeys || new Set(), redactor });
    if (!checked.ok) return { text: "Sorry, I couldn't note that." };
    set.notes.push({ ...checked.note, id: randomUUID(), at: iso(),
      noted_by: redactor.toModel(String(speaker || 'Unknown')).slice(0, 80) });
    emit(set);
    return { text: sentence(checked.note) };
  }

  const count = () => running?.notes.length ?? 0;
  const spoken = () => headline(running?.notes ?? []);

  function list(email, projectId) {
    const approver = isApprover(email);
    const sets = [running, ...ended.values()].filter(Boolean)
      .filter((set) => find(set.id, projectId) === set)
      .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
      .map((set) => {
        const out = view(set);
        if (approver && set !== running && set.state === 'open' && !busy(set)) {
          out.markdown = toMarkdown(set, { approver: lower(email), redactor });
          out.hash = notesHash({ text: out.markdown, setId: set.id, projectId: set.project?.id });
          out.destination = 'page';
        }
        return out;
      });
    return { sets, can_approve: approver };
  }

  // The checks every change shares; a string means the refusal to return.
  function guard(setId, noteId, email, projectId, { states = ['open'] } = {}) {
    if (!isApprover(email)) return reply(403, 'Forbidden.');
    const set = find(setId, projectId);
    const found = noteId === undefined ? null : set?.notes.find((n) => n.id === noteId);
    if (!set || (noteId !== undefined && !found)) return reply(404, 'Not found.');
    if (!states.includes(set.state)) return reply(409, 'These notes can no longer be changed.');
    return { set, found };
  }

  async function edit(setId, noteId, email, fields, projectId) {
    const g = guard(setId, noteId, email, projectId);
    if (!g.set) return g;
    const f = fields && typeof fields === 'object' ? fields : {};
    const checked = checkNote({ kind: f.kind, text: f.text, owner: f.owner, due: f.due }, { snapshotKeys: new Set(), redactor });
    if (!checked.ok) return reply(400, "That note can't be saved.");
    const { id, noted_by, at, cards, unknown_cards, close_evidence } = g.found;
    const next = { ...checked.note, cards, unknown_cards, id, noted_by, at, edited_by: lower(email),
      ...(close_evidence ? { close_evidence } : {}) };
    g.set.notes[g.set.notes.indexOf(g.found)] = next;
    emit(g.set);
    return reply(200, 'Saved.');
  }

  async function remove(setId, noteId, email, projectId) {
    const g = guard(setId, noteId, email, projectId);
    if (!g.set) return g;
    g.set.notes.splice(g.set.notes.indexOf(g.found), 1);
    emit(g.set);
    return reply(200, 'Removed.');
  }

  async function propose(setId, noteId, email, { what, confirm } = {}, projectId) {
    const g = guard(setId, noteId, email, projectId);
    if (!g.set) return g;
    const { set, found } = g;
    if (set !== running || !set.intake || !actions || !set.writable) return reply(409, 'Cards cannot be proposed now.');
    if (!['card', 'owner', 'close'].includes(what)) return reply(400, 'Unknown proposal.');
    if (set.proposals.some((p) => p.note_id === found.id && p.what === what && ['submitting', 'pending'].includes(p.state))) {
      return reply(409, 'That is already proposed.');
    }
    let action; let card_key; let title;
    if (what === 'card') {
      if (found.kind !== 'action') return reply(409, 'Only an action item can become a card.');
      title = found.text.slice(0, 200);
      action = { action: 'create_card', args: { title, status: 'backlog' } };
    } else if (what === 'owner') {
      card_key = set.proposals.find((p) => p.note_id === found.id && p.what === 'card' && p.card_key)?.card_key;
      if (!found.owner || !card_key) return reply(409, 'There is no card or owner for this note yet.');
      action = { action: 'update_card', args: { card_key, assignee: found.owner } };
    } else {
      if (found.cards.length !== 1) return reply(409, 'A close needs exactly one card on the board.');
      [card_key] = found.cards;
      action = { action: 'move_card', args: { card_key, status: 'done' } };
    }
    // Claim before the first await so a second press finds it.
    const claim = { note_id: found.id, what, action: action.action, card_key, title, state: 'submitting' };
    set.proposals.push(claim);
    const release = () => { const i = set.proposals.indexOf(claim); if (i >= 0) set.proposals.splice(i, 1); };
    let result;
    try {
      result = await actions.submit(action, lower(email), { generation: set.generation,
        snapshotKeys: new Set(card_key ? [card_key] : []), evidence: what === 'close', confirm, quiet: what === 'card' });
    } catch {
      release();
      return reply(500, "Sorry, I couldn't propose that.");
    }
    if (result?.status === 202) {
      claim.id = result.action?.id;
      claim.state = 'pending';
      emit(set);
      return reply(202, result.text);
    }
    release();
    if (result?.contradicted) {
      // looked up again: an edit during the wait replaced the note object
      const current = set.notes.find((n) => n.id === found.id);
      if (current) current.close_evidence = { ...result.evidence, evidence_hash: result.evidence_hash, read_at: iso() };
      emit(set);
      return reply(409, result.text, { contradicted: true });
    }
    emit(set);
    return reply(result?.status || 500, result?.text || "Sorry, I couldn't propose that.");
  }

  async function approve(setId, email, hash, projectId) {
    const g = guard(setId, undefined, email, projectId);
    if (!g.set) return g;
    const { set } = g;
    if (set === running) return reply(409, 'The call is still running.');
    if (busy(set)) return reply(409, 'A card proposal is still waiting.');
    const approver = lower(email);
    const text = toMarkdown(set, { approver, redactor });
    if (hash !== notesHash({ text, setId: set.id, projectId: set.project?.id })) return reply(409, 'The notes changed; review them again.');
    set.state = 'approving'; // no await between the checks and this claim
    try { await line(set, 'approved', approver, hash); } catch {
      set.state = 'open';
      return reply(500, 'The approval could not be recorded.');
    }
    set.frozen = text; set.hash = hash; set.approved_by = approver; set.state = 'approved';
    return reply(200, 'Approved.');
  }

  async function discard(setId, email, projectId) {
    const g = guard(setId, undefined, email, projectId, { states: ['open', 'approved'] });
    if (!g.set) return g;
    const { set } = g;
    if (set === running) return reply(409, 'The call is still running.');
    const hash = set.state === 'approved' ? set.hash : null;
    set.state = 'discarded';
    ended.delete(set.id);
    if (set.timer) clock.clearTimeout(set.timer);
    try { await line(set, 'discarded', lower(email), hash); } catch {
      console.error('notes record failed');
      return reply(200, 'Discarded, but the record could not be written.');
    }
    return reply(200, 'Discarded.');
  }

  async function download(setId, projectId) {
    const set = find(setId, projectId);
    if (!set || set.state !== 'approved') return { status: 404, text: 'Not found.' };
    return { status: 200, body: set.frozen, filename: `standup-${set.started_at.slice(0, 10)}.md` };
  }

  // A card proposal's result also arrives after the call has ended.
  actions?.subscribe((event) => {
    if (event?.type !== 'action-updated' || !event.action?.id) return;
    for (const set of [running, ...ended.values()]) {
      const proposal = set?.proposals.find((p) => p.id === event.action.id);
      if (!proposal) continue;
      proposal.state = event.action.state;
      if (event.action.card?.card_key) proposal.card_key = event.action.card.card_key;
      emit(set);
    }
  });

  return { startCall, closeIntake, endCall, note, count, headline: spoken, list, edit, remove, propose, approve,
    discard, download, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
}

module.exports = { createNotesManager };
