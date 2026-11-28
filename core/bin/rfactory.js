#!/usr/bin/env node
'use strict';
const { parseArgs } = require('node:util');
const { login, logout, readSession } = require('../src/rfactory-auth.js');
const { DEFAULT_URL, createClient, failure, sanitize, targetUrl } = require('../src/rfactory-client.js');

const SCOPED = new Set(['standup', 'review', 'actions', 'shares', 'investigations', 'join', 'leave', 'heard']);
const USAGE = [
  'Usage: rfactory <command> [--url <base-url>] [--json]',
  '  login | logout | status | projects',
  '  standup | actions | shares | investigations | leave | heard  --project <id-or-slug>',
  '  review --project <id-or-slug> [card_key]',
  '  join --project <id-or-slug> [--listen auto|platform|audio] <link>',
].join('\n');

function argumentsFor(args) {
  let parsed;
  try {
    parsed = parseArgs({ args, allowPositionals: true, options: {
      url: { type: 'string' }, project: { type: 'string' }, listen: { type: 'string' },
      json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
    } });
  } catch { throw failure(2, USAGE); }
  const { values, positionals: [command, arg, ...rest] } = parsed;
  if (values.help) return { help: true };
  const scoped = SCOPED.has(command);
  if (!scoped && !['login', 'logout', 'status', 'projects'].includes(command)) throw failure(2, USAGE);
  if (rest.length || (arg !== undefined && !['join', 'review'].includes(command)) ||
      (command === 'join' && !arg) || (command === 'review' && arg === '') ||
      (!scoped && values.project !== undefined) ||
      (values.listen !== undefined && (command !== 'join' || !['auto', 'platform', 'audio'].includes(values.listen)))) {
    throw failure(2, USAGE);
  }
  const project = values.project ?? process.env.RFACTORY_PROJECT;
  if (scoped && !project?.trim()) throw failure(2, 'A project is required. Use --project or RFACTORY_PROJECT.');
  return {
    command, arg, project, listen: values.listen, json: values.json,
    url: values.url ?? (process.env.RFACTORY_URL || DEFAULT_URL),
  };
}

const MULTILINE = new Set(['text', 'message', 'headline', 'description', 'body', 'findings', 'detail', 'request']);
function human(value, field, indent = '') {
  const prefix = field === undefined ? '' : sanitize(field) + ': ';
  if (Array.isArray(value)) {
    if (!value.length) return [indent + prefix + '[]'];
    return [
      indent + prefix.trimEnd(),
      ...value.flatMap((item) => typeof item === 'object' && item !== null
        ? [indent + '  -', ...human(item, undefined, indent + '    ')]
        : human(item, undefined, indent + '  - ')),
    ];
  }
  if (value && typeof value === 'object') {
    return [
      ...(prefix ? [indent + prefix.trimEnd()] : []),
      ...Object.entries(value).flatMap(([key, entry]) => human(entry, key, prefix ? indent + '  ' : indent)),
    ];
  }
  return [indent + prefix + sanitize(value === null ? 'none' : String(value), MULTILINE.has(field))];
}

function hideToken(value, token) {
  if (typeof value === 'string') return value.replaceAll(token, '[redacted]');
  if (Array.isArray(value)) return value.map((entry) => hideToken(entry, token));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [hideToken(key, token), hideToken(entry, token)]));
}

async function main(args) {
  const options = argumentsFor(args);
  if (options.help) { process.stdout.write(USAGE + '\n'); return; }
  const { command, json, url } = options;
  const print = (value, lines) => process.stdout.write((json ? JSON.stringify(value) : lines.join('\n')) + '\n');
  if (command === 'logout') {
    await logout();
    print({ ok: true }, ['Signed out.']);
    return;
  }
  const target = targetUrl(url);
  if (command === 'login') {
    print(await login(target.href), ['Signed in.']);
    return;
  }
  const session = await readSession();
  const run = createClient(target.href, session);
  const result = await run(command, options, (event) => {
    const { type, ...data } = hideToken(event, session.access_token);
    print({ type, ...data }, [sanitize(type), ...human(data, undefined, '  ')]);
  });
  if (command === 'heard') return;
  const safe = hideToken(result, session.access_token);
  if (command === 'status') {
    const { call, ...config } = safe;
    print(safe, [...human(config), ...(call === null ? ['Calls disabled.'] : human(call, 'call'))]);
  } else if (command === 'join' || command === 'leave') {
    print(safe, [command === 'join' ? 'Join accepted.' : 'Call ended.']);
  } else {
    print(safe, human(safe));
  }
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write((error.exitCode ? error.message : 'Unexpected RFactory CLI error.') + '\n');
  process.exitCode = error.exitCode || 1;
});
