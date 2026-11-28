'use strict';
const { connect: defaultConnect } = require('./github.js');
const { mapGithub } = require('../items.js');

function createGithubSource({ scope, bin, token, connect = defaultConnect, timeoutMs = 55000 }) {
  async function read(snapshot) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('source-timeout')), timeoutMs);
    let github;
    try {
      const work = (async () => {
        github = await connect({ bin, token, signal: controller.signal });
        if (controller.signal.aborted) {
          await github.close().catch(() => {});
          throw new Error('source-timeout');
        }
        if (!snapshot) return;
        const raw = await github.fetchScope(scope);
        const items = mapGithub(raw, scope.mapping);
        const newest_update = items.map((item) => item.updated_at).filter(Boolean).sort().at(-1) || null;
        return { items, fetched_at: raw.fetched_at, newest_update, truncated: raw.truncated };
      })();
      const deadline = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('source-timeout')), { once: true }));
      return await Promise.race([work, deadline]);
    } catch (error) {
      if (controller.signal.aborted) throw new Error('source-timeout');
      throw error;
    } finally {
      clearTimeout(timer);
      if (github) await github.close().catch(() => {});
    }
  }
  return { kind: 'github', start: () => read(false), snapshot: () => read(true) };
}

module.exports = { createGithubSource };
