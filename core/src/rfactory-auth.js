'use strict';
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const { homedir } = require('node:os');
const { isAbsolute, join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { failure, relogin, targetUrl, sanitize } = require('./rfactory-client.js');

const ISSUER = 'https://keycloak.freundcloud.org.uk/realms/factory';
const CLIENT_ID = 'rfactory-cli';
const TOKEN = /^[A-Za-z0-9._~+/=-]+$/;
function sessionDir() {
  const config = process.env.XDG_CONFIG_HOME || '';
  return join(isAbsolute(config) ? config : join(homedir(), '.config'), 'rfactory');
}
const seconds = (value) => Number.isFinite(value) && value > 0 && value * 1000 <= 2 ** 31 - 1;

async function readSession() {
  let session;
  try {
    const file = await fs.open(join(sessionDir(), 'session.json'), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await file.stat();
      if (stat.isFile() && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o600) {
        session = JSON.parse(await file.readFile('utf8'));
      }
    } finally { await file.close(); }
  } catch (error) {
    if (!(error instanceof SyntaxError) && !['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)) {
      throw failure(1, 'Could not read the session file.');
    }
  }
  if (typeof session?.url !== 'string' || typeof session.access_token !== 'string' || !TOKEN.test(session.access_token)
      || !Number.isFinite(session.expires_at) || session.expires_at <= Date.now()) throw relogin();
  return session;
}

async function saveSession(session) {
  const dir = sessionDir();
  const temp = join(dir, `.session-${randomUUID()}`);
  try {
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const parent = await fs.lstat(dir);
    if (!parent.isDirectory() || parent.uid !== process.getuid()) throw failure(1, 'Invalid session directory.');
    await fs.chmod(dir, 0o700);
    await fs.writeFile(temp, JSON.stringify(session) + '\n', { mode: 0o600, flag: 'wx' });
    await fs.chmod(temp, 0o600);
    await fs.rename(temp, join(dir, 'session.json'));
  } catch {
    await fs.rm(temp, { force: true }).catch(() => {});
    throw failure(1, 'Could not save the session file.');
  }
}

async function logout() {
  try { await fs.rm(join(sessionDir(), 'session.json'), { force: true }); }
  catch { throw failure(1, 'Could not remove the session file.'); }
}

async function oidc(url, form, signal) {
  try {
    const response = await fetch(url, {
      redirect: 'manual', signal, headers: { Accept: 'application/json' },
      ...(form && { method: 'POST', body: new URLSearchParams(form) }),
    });
    if (response.status === 302 || response.status === 401 || response.status === 403) throw relogin();
    if (!response.ok && response.status !== 400) throw failure(1, 'Identity provider request failed.');
    return { ok: response.ok, body: await response.json() };
  } catch (error) {
    if (error.exitCode) throw error;
    if (signal?.aborted) throw failure(3, 'Device sign-in timed out. Run rfactory login again.');
    throw failure(1, 'Identity provider request failed.');
  }
}

async function login(url, { issuer = ISSUER, stderr = process.stderr } = {}) {
  const target = targetUrl(url);
  const authority = targetUrl(issuer);
  const discovery = await oidc(issuer.replace(/\/$/, '') + '/.well-known/openid-configuration');
  function endpoint(value) {
    try {
      const endpoint = new URL(value);
      if (endpoint.protocol === authority.protocol && endpoint.origin === authority.origin &&
          !endpoint.username && !endpoint.password) return endpoint;
    } catch { /* Malformed discovery response. */ }
    throw failure(1, 'Invalid identity provider discovery response.');
  }
  if (!discovery.ok || discovery.body?.issuer !== issuer) throw failure(1, 'Invalid identity provider discovery response.');
  const deviceEndpoint = endpoint(discovery.body.device_authorization_endpoint);
  const tokenEndpoint = endpoint(discovery.body.token_endpoint);
  const device = await oidc(deviceEndpoint, { client_id: CLIENT_ID, scope: 'openid email' });
  const { device_code, user_code, verification_uri, expires_in, interval = 5 } = device.body || {};
  if (!device.ok || typeof device_code !== 'string' || !device_code || typeof user_code !== 'string' || !user_code
      || typeof verification_uri !== 'string' || !seconds(expires_in) || !seconds(interval)) {
    throw failure(1, 'Invalid device authorization response.');
  }
  let verification;
  try {
    verification = new URL(verification_uri);
    if (verification.protocol !== authority.protocol || verification.origin !== authority.origin) throw new Error();
    if (verification.username || verification.password) throw new Error();
  } catch { throw failure(1, 'Invalid device verification URL.'); }
  const expires = Date.now() + expires_in * 1000;
  const timedOut = () => failure(3, 'Device sign-in timed out. Run rfactory login again.');
  stderr.write(`Open ${sanitize(verification.href)} and enter code ${sanitize(user_code)}.\n`);
  let wait = interval * 1000;
  for (;;) {
    await delay(Math.min(wait, Math.max(0, expires - Date.now())));
    const remaining = Math.ceil(expires - Date.now());
    if (remaining <= 0) throw timedOut();
    const result = await oidc(tokenEndpoint, {
      client_id: CLIENT_ID, device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }, AbortSignal.timeout(remaining));
    if (Date.now() >= expires) throw timedOut();
    if (!result.ok) {
      if (result.body?.error === 'slow_down') wait += 5000;
      else if (result.body?.error === 'expired_token') throw timedOut();
      else if (result.body?.error !== 'authorization_pending') throw failure(3, 'Device sign-in refused. Run rfactory login again.');
      continue;
    }
    const { access_token, expires_in: lifetime } = result.body || {};
    if (typeof access_token !== 'string' || !TOKEN.test(access_token) || !seconds(lifetime)) {
      throw failure(1, 'Invalid access token response.');
    }
    await saveSession({ url: target.href, issuer, client_id: CLIENT_ID, access_token, expires_at: Date.now() + lifetime * 1000 });
    return { ok: true };
  }
}

module.exports = { login, logout, readSession };
