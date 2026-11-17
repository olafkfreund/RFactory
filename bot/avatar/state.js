function stateFactory() {
  function createState({ now, random }) {
    let speaking = false;
    let closingAt = null;
    let closingOpen = 0;
    let forcedIdle = false;
    let waitingForRise = false;
    let previousLevel = 0;
    let wasIdle = true;
    let nextBlink = now + 3000 + random() * 3000;

    function step(time, { level, speakingEvent } = {}) {
      if (speakingEvent === true) {
        speaking = true;
        closingAt = null;
        forcedIdle = false;
        waitingForRise = false;
      } else if (speakingEvent === false) {
        closingOpen = Math.max(0, Math.min(1, level));
        closingAt = time;
        speaking = false;
        waitingForRise = true;
      }

      if (speakingEvent !== false && waitingForRise && (level > previousLevel || level < 0.06)) waitingForRise = false;
      previousLevel = level;
      if (level < 0.06 && closingAt !== null) closingAt = null;
      const active = !forcedIdle && !waitingForRise && closingAt === null && (speaking || level >= 0.06);
      const open = forcedIdle ? 0 : closingAt === null
        ? (active ? Math.max(0, Math.min(1, level)) : 0)
        : closingOpen * Math.max(0, 1 - (time - closingAt) / 150);
      const nod = active ? Math.max(0, Math.min(1, level)) : 0;
      const isIdle = !active && open === 0;
      if (isIdle && !wasIdle) nextBlink = time + 3000 + random() * 3000;
      wasIdle = isIdle;
      const blink = isIdle && time >= nextBlink && time < nextBlink + 130;
      if (isIdle && time >= nextBlink + 130) nextBlink += 3000 + random() * 3000;
      if (closingAt !== null && time - closingAt >= 150) closingAt = null;
      return { open, nod, blink };
    }

    function idle() {
      speaking = false;
      closingAt = null;
      forcedIdle = true;
      wasIdle = false;
      nextBlink = Infinity;
      return { open: 0, nod: 0, blink: false };
    }

    return { step, idle };
  }

  function meshAt(anchors, d) {
    const { points, move } = anchors.mesh;
    return Object.fromEntries(Object.entries(points).map(([name, [x, y]]) =>
      [name, [x, y + (move[name] || 0) * d]]));
  }

  return { createState, meshAt };
}

module.exports = { ...stateFactory(), source: `(${stateFactory.toString()})()` };
