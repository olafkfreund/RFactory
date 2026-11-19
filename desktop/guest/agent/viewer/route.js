'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ORIGIN = 'https://rfactory-viewer.invalid';
const URL_BOARD = `${ORIGIN}/board.html`;
const TYPES = { 'board.html': 'text/html; charset=utf-8', 'board.js': 'text/javascript; charset=utf-8', 'board.css': 'text/css; charset=utf-8' };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'";

// Fulfils exactly the three viewer files; every other request is aborted.
async function viewerRoute(route) {
  let name;
  try {
    const u = new URL(route.request().url());
    if (u.origin === ORIGIN && !u.search && route.request().method() === 'GET') name = u.pathname.slice(1);
  } catch { /* abort below */ }
  if (!Object.hasOwn(TYPES, name || '')) return route.abort();
  return route.fulfill({
    status: 200,
    headers: { 'content-type': TYPES[name], 'content-security-policy': CSP, 'cache-control': 'no-store' },
    body: fs.readFileSync(path.join(__dirname, name)),
  });
}

module.exports = { viewerRoute, URL_BOARD, ORIGIN };
