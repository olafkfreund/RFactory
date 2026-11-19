'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadRoles } = require('../src/roles.js');

test('normalises lists, removes duplicates, and freezes the result', () => {
  const roles = loadRoles({
    RFACTORY_ALLOWED_EMAILS: ' Owner@Example.com, owner@example.com,  , member@example.com ',
    RFACTORY_APPROVERS: ' OWNER@example.com, owner@example.com ',
    RFACTORY_ADMINS: ' owner@example.com ',
  });
  assert.deepEqual(roles.approvers, ['owner@example.com']);
  assert.deepEqual(roles.rolesOf(' OWNER@EXAMPLE.COM '), ['member', 'approver', 'admin']);
  assert.equal(roles.has('Member@Example.com', 'member'), true);
  assert.equal(Object.isFrozen(roles), true);
  assert.equal(Object.isFrozen(roles.approvers), true);
});

test('rejects malformed addresses and roles outside members without echoing lists', () => {
  for (const name of ['RFACTORY_ALLOWED_EMAILS', 'RFACTORY_APPROVERS', 'RFACTORY_ADMINS']) {
    assert.throws(() => loadRoles({ [name]: 'secret-bad-email' }), { message: 'roles-invalid-email' });
  }
  for (const name of ['RFACTORY_APPROVERS', 'RFACTORY_ADMINS']) {
    assert.throws(() => loadRoles({ RFACTORY_ALLOWED_EMAILS: 'member@example.com', [name]: 'other@example.com' }),
      { message: 'roles-not-members' });
  }
});

test('role matrix keeps admin and approver independent', () => {
  const roles = loadRoles({
    RFACTORY_ALLOWED_EMAILS: 'member@example.com,admin@example.com,approver@example.com,both@example.com',
    RFACTORY_ADMINS: 'admin@example.com,both@example.com',
    RFACTORY_APPROVERS: 'approver@example.com,both@example.com',
  });
  for (const [email, expected] of [
    ['outsider@example.com', [false, false, false]],
    ['member@example.com', [true, false, false]],
    ['admin@example.com', [true, false, true]],
    ['approver@example.com', [true, true, false]],
    ['both@example.com', [true, true, true]],
  ]) {
    assert.deepEqual(['member', 'approver', 'admin'].map((role) => roles.has(email, role)), expected);
  }
  assert.deepEqual(roles.rolesOf('outsider@example.com'), []);
});

test('missing emails are denied, unknown roles throw, and unset admins grant nothing', () => {
  const roles = loadRoles({ RFACTORY_ALLOWED_EMAILS: 'member@example.com' });
  assert.equal(roles.has(undefined, 'member'), false);
  assert.equal(roles.has('', 'member'), false);
  assert.equal(roles.has('member@example.com', 'admin'), false);
  assert.throws(() => roles.has('member@example.com', 'owner'), { message: 'roles-unknown-role' });
});
