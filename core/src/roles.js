'use strict';

function loadRoles(env) {
  function parse(name) {
    const emails = (env[name] || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
    if (emails.some((email) => !/^[^\s@]+@[^\s@]+$/.test(email))) throw new Error('roles-invalid-email');
    return new Set(emails);
  }

  const members = parse('RFACTORY_ALLOWED_EMAILS');
  const approverSet = parse('RFACTORY_APPROVERS');
  const admins = parse('RFACTORY_ADMINS');
  if ([...approverSet, ...admins].some((email) => !members.has(email))) throw new Error('roles-not-members');

  const lists = { member: members, approver: approverSet, admin: admins };
  function has(email, role) {
    if (!Object.hasOwn(lists, role)) throw new Error('roles-unknown-role');
    return typeof email === 'string' && lists[role].has(email.trim().toLowerCase());
  }

  function rolesOf(email) {
    return Object.freeze(['member', 'approver', 'admin'].filter((role) => has(email, role)));
  }

  return Object.freeze({ has, rolesOf, approvers: Object.freeze([...approverSet]) });
}

module.exports = { loadRoles };
