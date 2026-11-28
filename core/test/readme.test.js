'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const recoveryRunbook = '`docs/secrets-management.md` in the `factory-gitops` repository';

function missingPaths(markdown) {
  const links = [...markdown.matchAll(/\]\(([^)]+)\)/g)].map(([, target]) => target);
  const paths = [...markdown.replace(recoveryRunbook, '').matchAll(
    /`(?:node )?((?:[\w.-]+\/)+[\w.-]*|README\.md|LICENSE|NOTICE\.md)`/g,
  )].map(([, target]) => target);
  return [...new Set([...links, ...paths])]
    .filter((target) => !/^(?:https?:\/\/|#)/i.test(target))
    .map((target) => target.split('#')[0])
    .filter((target) => !fs.existsSync(path.join(root, target)));
}

function forbiddenContent(markdown) {
  const forbidden = /\b(?:zoom|slack|p620|k3d-factory|deploy\/rfactory|factory-cli-creds|factory-gitops|pod\.sh\s+up)\b|-n\s+factory\b|(?:meet\.google\.com|teams\.(?:microsoft|live)\.com)\/|\brfk_[a-z0-9]{32,}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi;
  return markdown.replace(recoveryRunbook, '')
    .replace(/^    "email": "rfactory-reader@example\.com",$/m, '')
    .match(forbidden) ?? [];
}

test('README describes the in-call proposal and post-call approval and download windows', () => {
  assert.match(readme, /^\| Standup notes \|[^|]*Approvers can propose tasks only during a writable call\.[^|]*After the call ends, approvers can approve the notes and members can download the approved notes as Markdown\./m);
});

test('README distinguishes the Jira admin-token check from the unverified read-only setup', () => {
  assert.match(readme, /^\| Jira and Confluence \|[^\n]*local RFactory server using an admin token \(#59\)\. The dedicated read-only account setup is still unverified\./m);
});

test('README deployment names its scope file and the Claude recovery runbook', () => {
  const deployment = readme.split('## Deployment\n')[1].split('\n## ')[0];
  assert.match(deployment, /deployment's scope in `scope\.cluster\.json`/);
  assert.ok(deployment.includes(`follow ${recoveryRunbook}, then restart RFactory.`));
});

test('README uses the Factory name for the spoken standup and hearing descriptions', () => {
  assert.match(readme, /In a call Factory speaks/);
  assert.match(readme, /During a call, Factory hears/);
});

test('README links and inline repository paths resolve', () => {
  assert.deepEqual(missingPaths(readme), []);
  assert.deepEqual(missingPaths('[broken](docs/missing-link.md) and `deploy/missing-path.sh`'),
    ['docs/missing-link.md', 'deploy/missing-path.sh']);
});

test('README public-content smoke check flags platform names, layout, meeting links and credentials', () => {
  const examples = ['zoom', 'SLACK', '-n factory', 'deploy/rfactory', 'factory-gitops',
    'meet.google.com/', 'teams.microsoft.com/', 'teams.live.com/', 'rfk_' + 'a'.repeat(32), 'member@example.test'];
  assert.deepEqual(forbiddenContent(examples.join('\n')), examples);
  assert.equal(forbiddenContent(readme).length, 0, 'README contains forbidden public content');
});
