'use strict';
// Every node is built with createElement and textContent; nothing is parsed as markup.
const SECTIONS = ['done', 'in_progress', 'blocked', 'left'];

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function renderItem(doc, item) {
  const li = el(doc, 'li');
  const label = `${item.id}: ${item.title}`;
  if (typeof item.url === 'string' && item.url.startsWith('https://github.com/')) {
    const a = el(doc, 'a', label);
    a.setAttribute('href', item.url);
    li.appendChild(a);
  } else li.appendChild(el(doc, 'span', label));
  for (const line of item.evidence || []) li.appendChild(el(doc, 'div', line, 'evidence'));
  return li;
}

function fill(doc, id, items) {
  const ul = doc.getElementById(id).querySelector('ul');
  while (ul.firstChild) ul.removeChild(ul.firstChild);
  for (const item of items) ul.appendChild(renderItem(doc, item));
}

function render(doc, data) {
  for (const s of SECTIONS) fill(doc, s, data.items.filter((i) => i.state === s));
  fill(doc, 'unknown', data.unknown);
  doc.getElementById('age').textContent = `Fetched ${data.fetched_at}; newest update ${data.newest_update || 'none'}`;
  doc.getElementById('summary').textContent = data.summary || (data.summary_error ? `No summary (${data.summary_error})` : '');
  doc.getElementById('destination').textContent = `Summary by: ${data.destination}`;
}

async function run(doc) {
  const status = doc.getElementById('status');
  status.textContent = 'Running...';
  try {
    const response = await fetch('/api/standup', { method: 'POST' });
    const data = await response.json();
    if (!response.ok) status.textContent = `Failed: ${data.error}`;
    else { render(doc, data); status.textContent = 'Done'; }
  } catch { status.textContent = 'Failed: network'; }
}

if (typeof document !== 'undefined') {
  document.getElementById('run').addEventListener('click', () => run(document));
}
if (typeof module !== 'undefined') module.exports = { render, renderItem };
