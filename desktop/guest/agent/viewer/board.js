'use strict';
// Draws the board projection. Text only: createElement + textContent, no links, forms or inputs.
(() => {
  const COLUMNS = ['backlog', 'ready', 'in_progress', 'blocked', 'done'];
  const root = document.getElementById('rf-board');

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = String(text);
    return e;
  };

  const hhmm = (at) => {
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return '--:--';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // The library injects a "Bot's view" bar into every page; it must not show on the shared page.
  const dropBar = () => { document.getElementById('vibeconf-status-bar')?.remove(); };
  dropBar();
  new MutationObserver(dropBar).observe(document.documentElement, { childList: true, subtree: true });

  function render(data, opts = {}) {
    root.replaceChildren();
    const stale = Boolean(opts.stale);
    if (opts.view === 'log') {
      root.append(el('div', stale ? 'rf-banner rf-stale' : 'rf-banner',
        `RFactory (AI) · Investigation · read-only · ${data.repo} @ ${data.sha.slice(0, 7)} · as of ${hhmm(data.at)}${stale ? ' · stale' : ''}`));
      root.append(el('pre', 'rf-log', data.lines.join('\n')));
      return;
    }
    root.append(el('div', stale ? 'rf-banner rf-stale' : 'rf-banner',
      `RFactory (AI) · CFactory board · read-only · as of ${hhmm(data.at)}${stale ? ' · stale' : ''}`));
    root.append(el('div', 'rf-project', data.project));
    const cols = el('div', 'rf-columns');
    for (const name of COLUMNS) {
      const info = data.columns?.[name] || { total: 0, shown: 0, omitted: 0 };
      const col = el('section', 'rf-column');
      col.append(el('h2', '', `${name.replace('_', ' ')} (${info.total})`));
      for (const c of (data.cards || []).filter((x) => x.column === name)) {
        const card = el('div', 'rf-card');
        card.append(el('div', 'rf-key', c.key), el('div', 'rf-title', c.title));
        const s = c.stages || {};
        card.append(el('div', 'rf-meta',
          `P${c.priority ?? '-'} · ${c.tier ?? '-'} · plan ${s.plan ?? 'none'} · code ${s.code ?? 'none'} · test ${s.test ?? 'none'}`));
        col.append(card);
      }
      if (info.omitted > 0) col.append(el('div', 'rf-more', `+${info.omitted} more`));
      cols.append(col);
    }
    root.append(cols);
  }

  window.rfBoard = { render };
})();
