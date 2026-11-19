'use strict';
// Joins a call through the runner's call stream, as web/vm-call.js does for POST /api/call: the link is the first line,
// the call worker's lines (state, heard, ...) go to stdout. Used by lib.sh join_call; stops when the stream closes.
//   node callstream.js <desktop_id> <link>      env: RUNNER_URL VERIFY_CERT VERIFY_KEY VERIFY_CA
// The guest channel appears a few seconds after boot, so a refused stream is retried (120 x 1 s, like vm-call.js).
async function join({ client, id, link, out, tries = 120, retryMs = 1000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  let sock;
  for (let n = 0; !sock; n++) {
    try { sock = await client.openCall(id); } catch (error) { if (n + 1 >= tries) throw error; await sleep(retryMs); }
  }
  sock.pipe(out, { end: false });
  sock.write(`${link}\n`);
  await new Promise((resolve) => { sock.on('close', resolve); sock.on('error', resolve); });
}

if (require.main === module) {
  const [id, link] = process.argv.slice(2);
  const { RUNNER_URL, VERIFY_CERT, VERIFY_KEY, VERIFY_CA } = process.env;
  if (!id || !link || !RUNNER_URL || !VERIFY_CERT || !VERIFY_KEY || !VERIFY_CA) { console.error('usage: callstream.js <desktop_id> <link> (env RUNNER_URL VERIFY_CERT VERIFY_KEY VERIFY_CA)'); process.exit(2); }
  const { createRunnerClient } = require('../runner/client');
  const client = createRunnerClient({ url: RUNNER_URL, cert: VERIFY_CERT, key: VERIFY_KEY, ca: VERIFY_CA });
  join({ client, id, link, out: process.stdout }).then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1); });
}

module.exports = { join };
