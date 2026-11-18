'use strict';
// Fixture pages for handover.sh and share.sh. Run it on a host the guest may reach (an approved private
// preview, or a public one on the allowlist):  node fixture.js <portA> <portB>
//   A (allowed origin) serves the trap pages and /hits; B (not allowed) counts every request it gets.
//   GET A/mark?v=<text> sets a long-lived cookie with that text (profiles.sh looks for it on the host disk).
//   GET A/login is a login form (#user, #pass, #go) that reports only the LENGTHS of what was typed, never the values (secrets.sh).
//   GET A/hits -> {"a": <requests A got besides /hits and /reset>, "b": <requests B received>, "sw": "none"|"registered"|"unavailable", "retitled": bool,
//   "login": {"user": <length>, "pass": <length>, "submitted": bool}}; GET A/reset clears them.
const http = require('node:http');

const [portA, portB] = process.argv.slice(2).map(Number);
if (!portA || !portB) { console.error('usage: node fixture.js <portA> <portB>'); process.exit(2); }

const state = { a: 0, b: 0, sw: 'none', retitled: false, login: { user: 0, pass: 0, submitted: false } };
const html = (res, body) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(`<!doctype html><title>fixture</title>${body}`); };

// the guest reaches B at the address in its own Host header, so the pages build B's URL from it
const otherOrigin = (req) => `http://${(req.headers.host || '').replace(/:\d+$/, '')}:${portB}`;

http.createServer((req, res) => {
  const b = otherOrigin(req);
  const path = req.url.split('?')[0];
  if (path !== '/hits' && path !== '/reset') state.a++;
  switch (path) {
    case '/hits': res.end(JSON.stringify(state)); break;
    case '/reset': state.a = 0; state.b = 0; state.sw = 'none'; state.retitled = false; state.login = { user: 0, pass: 0, submitted: false }; res.end('{}'); break;
    case '/redirect': res.writeHead(302, { location: `${b}/landing` }); res.end(); break;
    case '/meta': html(res, `<meta http-equiv="refresh" content="0;url=${b}/landing">`); break;
    case '/js': html(res, `<script>location = '${b}/landing'</script>`); break;
    case '/popup': html(res, `<script>window.open('${b}/landing')</script>`); break;
    case '/form': html(res, `<form method="post" action="${b}/landing"><input name="x" value="1"></form><script>document.forms[0].submit()</script>`); break;
    case '/click': html(res, `<a id="go" href="${b}/landing">go</a>`); break;
    case '/sw': html(res, `<script>
      if (!navigator.serviceWorker) fetch('/sw-state?s=unavailable');
      else navigator.serviceWorker.register('/sw.js').then(() => fetch('/sw-state?s=registered'), () => fetch('/sw-state?s=unavailable'));
    </script>`); break;
    case '/sw.js': res.writeHead(200, { 'content-type': 'text/javascript' }); res.end('self.onfetch = () => {};'); break;
    case '/sw-state': state.sw = new URL(req.url, 'http://x').searchParams.get('s'); res.end('{}'); break;
    case '/slow': setTimeout(() => html(res, 'slow'), 20000); break; // a long action for the revoke check
    case '/mark': res.writeHead(200, { 'content-type': 'text/html', 'set-cookie': `rfmark=${new URL(req.url, 'http://x').searchParams.get('v') || 'none'}; Max-Age=86400; Path=/` }); res.end('marked'); break; // plaintext marker for profiles.sh
    case '/retitle': html(res, `<script>setTimeout(() => { document.title = 'changed'; fetch('/retitled'); }, 1000)</script>shared page`); break;
    case '/retitled': state.retitled = true; res.end('{}'); break;
    case '/away': html(res, `<script>setTimeout(() => { location.href = '/landing-a'; }, 3000)</script>shared page`); break; // a share page that navigates
    case '/login': html(res, `<input id="user"><input id="pass" type="password"><button id="go" type="button">go</button><script>
      const n = (e) => e.value.length, tell = () => fetch('/login-state?u=' + n(user) + '&p=' + n(pass));
      user.oninput = pass.oninput = tell; go.onclick = () => fetch('/login-submitted');
    </script>`); break;
    // liveview: a visible, focused input; a key that reached the guest would show in login.user
    case '/focus': html(res, `<h1>rfactory live view</h1><input id="user" autofocus><script>user.oninput = () => fetch('/login-state?u=' + user.value.length + '&p=0')</script>`); break;
    case '/login-state': { const q = new URL(req.url, 'http://x').searchParams; state.login.user = Number(q.get('u')) || 0; state.login.pass = Number(q.get('p')) || 0; res.end('{}'); break; }
    case '/login-submitted': state.login.submitted = true; res.end('{}'); break;
    default: html(res, 'ok');
  }
}).listen(portA, process.env.FIXTURE_HOST); // FIXTURE_HOST: bind one address (k14: the rfverify bridge), not every interface

http.createServer((req, res) => { state.b++; res.writeHead(200, { 'content-type': 'text/html' }); res.end('landing'); }).listen(portB, process.env.FIXTURE_HOST);
