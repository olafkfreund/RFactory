'use strict';

const { createHash, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const HOUR = 3600000;
const DAY = 24 * HOUR;
const hashLink = (link) => createHash('sha256').update(link).digest('hex');
const publicSlot = ({ id, project_id, starts_at, ends_at, created_by }) =>
  ({ id, project_id, starts_at, ends_at, created_by, label: 'Meeting' });

function createScheduleRegistry({ dir, validLink, clock = Date, projectMode = false }) {
  const file = path.join(dir, 'schedules.json');
  let slots;
  try { slots = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    slots = [];
  }

  const prune = (entries, now) => entries.filter((slot) => slot.ends_at >= now - DAY);
  function save(entries) {
    fs.mkdirSync(dir, { recursive: true });
    const temporary = path.join(dir, `.schedules-${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(temporary, JSON.stringify(entries), { mode: 0o600, flag: 'wx' });
      fs.renameSync(temporary, file);
    } finally { fs.rmSync(temporary, { force: true }); }
    slots = entries;
  }
  const current = prune(slots, clock.now());
  if (current.length !== slots.length) save(current);

  function add({ link, projectId = null, starts_at, ends_at, createdBy }) {
    const now = clock.now();
    if (typeof link !== 'string' || !validLink(link) || !Number.isSafeInteger(starts_at) ||
      !Number.isSafeInteger(ends_at) || starts_at >= ends_at || ends_at - starts_at > HOUR ||
      ends_at <= now || (projectMode && !projectId)) return null;
    const slot = { id: randomUUID(), link_hash: hashLink(link), project_id: projectId,
      starts_at, ends_at, created_by: createdBy.toLowerCase(), created_at: now };
    save([...prune(slots, now), slot]);
    return publicSlot(slot);
  }

  function match({ linkHash, projectId = null, now = clock.now() }) {
    return slots.find((slot) => slot.link_hash === linkHash && slot.project_id === projectId &&
      now >= slot.starts_at - 300000 && now <= slot.ends_at) ?? null;
  }

  function list({ projectId, now = clock.now() } = {}) {
    return slots.filter((slot) => slot.ends_at >= now && (!projectMode || slot.project_id === projectId))
      .sort((a, b) => a.starts_at - b.starts_at).map(publicSlot);
  }

  function remove(id, { projectId } = {}) {
    const isTarget = (slot) => slot.id === id && (projectId === undefined || slot.project_id === projectId);
    const found = slots.some(isTarget);
    const remaining = prune(slots.filter((slot) => !isTarget(slot)), clock.now());
    if (remaining.length !== slots.length) save(remaining);
    return found;
  }

  return { add, match, list, remove };
}

module.exports = { createScheduleRegistry, hashLink };
