'use strict';
const { STATES } = require('./items.js');
const { mapCard } = require('./sources/cfactory.js');
const { validPath, validNumber } = require('./sources/github-read.js');

const CARD = /^[A-Z][A-Z0-9]+-\d+$/;
const specs = {
  find_cards: { text: 'string', state: 'string?' }, get_card: { card_key: 'string' },
  card_comments: { card_key: 'string' }, card_runs: { card_key: 'string' },
  get_issue: { number: 'integer' }, issue_comments: { number: 'integer' },
  pr_diff: { number: 'integer' }, read_file: { path: 'string' },
};
const FACTORY = Object.keys(specs).slice(0, 4);
const GITHUB = Object.keys(specs).slice(4);
const wrap = (text) => ({ untrusted: true, text: String(text ?? '') });
const refOf = (name, args) => name === 'find_cards' ? '' : args.card_key ?? args.number ?? args.path ?? '';

function validate(name, args) {
  const spec = specs[name];
  if (!spec || !args || typeof args !== 'object' || Array.isArray(args)) return false;
  if (Object.keys(args).some((key) => !Object.hasOwn(spec, key))) return false;
  for (const [key, type] of Object.entries(spec)) {
    if (type.endsWith('?') && args[key] === undefined) continue;
    if (type === 'integer' ? !validNumber(args[key]) : typeof args[key] !== 'string') return false;
  }
  if (name === 'find_cards') return args.text.length >= 1 && args.text.length <= 200 && (args.state === undefined || STATES.includes(args.state));
  if (Object.hasOwn(args, 'card_key')) return CARD.test(args.card_key);
  if (name === 'read_file') return validPath(args.path);
  return true;
}
function schema(name) {
  const properties = {};
  const required = [];
  for (const [key, type] of Object.entries(specs[name])) {
    properties[key] = type === 'integer' ? { type: 'integer', minimum: 1 } : { type: 'string' };
    if (!type.endsWith('?')) required.push(key);
  }
  if (name === 'find_cards') { properties.text.minLength = 1; properties.text.maxLength = 200; properties.state.enum = STATES; }
  if (properties.card_key) properties.card_key.pattern = CARD.source;
  if (properties.path) properties.path.maxLength = 300;
  return { type: 'object', properties, required, additionalProperties: false };
}
function cap(value, limit) {
  let truncated = false;
  function walk(item) {
    if (typeof item === 'string') {
      const bytes = Buffer.from(item);
      if (bytes.length <= limit) return item;
      truncated = true;
      return bytes.subarray(0, limit).toString('utf8').replace(/\uFFFD$/, '');
    }
    if (Array.isArray(item)) return item.map(walk);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([key, val]) => [key, walk(val)]));
    return item;
  }
  let result = walk(value);
  while (Buffer.byteLength(JSON.stringify(result)) > 40 * 1024) {
    truncated = true;
    const fields = [];
    function collect(item) {
      if (!item || typeof item !== 'object') return;
      for (const [key, val] of Object.entries(item)) {
        if (typeof val === 'string') fields.push([item, key, val]); else collect(val);
      }
    }
    collect(result);
    fields.sort((a, b) => Buffer.byteLength(b[2]) - Buffer.byteLength(a[2]));
    if (!fields.length || !fields[0][2]) return { truncated: true };
    const [obj, key, value] = fields[0];
    obj[key] = Buffer.from(value).subarray(0, Math.max(0, Buffer.byteLength(value) - 4096)).toString('utf8').replace(/\uFFFD$/, '');
  }
  return truncated ? { ...result, truncated: true } : result;
}
function createLookups({ source, github, redactor }) {
  return {
    tools(ctx) { return ctx.tools.filter((name) => specs[name] && (FACTORY.includes(name) || (github && ctx.project.github))).map((name) => ({
      name, description: `Read ${name.replaceAll('_', ' ')} in the bound project`, inputSchema: schema(name),
    })); },
    async call(ctx, name, args) {
      let ref = refOf(name, args || {});
      const entry = { tool: name, ref, ok: false };
      try {
        // a refused call logs no ref: the model's raw argument could carry question text into the record
        if (!ctx.tools.includes(name) || !validate(name, args) || (GITHUB.includes(name) && (!github || !ctx.project.github))) { entry.ref = ''; throw new Error('lookup-refused'); }
        if (ctx.signal?.aborted) throw new Error('aborted');
        let result, kind, title, evidence;
        if (name === 'find_cards') {
          const cards = await source.lookupCards(ctx.signal);
          const matches = [];
          for (const card of cards) {
            if (args.state && mapCard(card).state !== args.state) continue;
            if (!`${card.card_key} ${card.title || ''}`.toLowerCase().includes(args.text.toLowerCase())) continue;
            try { matches.push(await source.lookupCard(card.card_key, ctx.signal)); } catch (error) { if (ctx.signal?.aborted) throw error; }
            if (matches.length === 20) break;
          }
          ref = matches.map((x) => x.card_key).join(',');
          kind = 'card';
          result = matches.map((x) => ({ card_key: x.card_key, title: wrap(x.title), state: mapCard(x).state, updated_at: x.updated_at }));
        } else if (FACTORY.includes(name)) {
          const card = await source.lookupCard(args.card_key, ctx.signal);
          kind = 'card'; title = card.title; evidence = mapCard(card);
          if (name === 'get_card') result = { card_key: card.card_key, title: wrap(card.title), state: evidence.state,
            plan: wrap(card.plan || card.description), acceptance: wrap(card.acceptance || card.acceptance_criteria),
            issue: card.issue_ref ? { number: Number(card.issue_ref.match(/#(\d+)$/)?.[1]), state: card.issue_state } : null,
            pr: card.pr_ref ? { number: Number(card.pr_ref.match(/#(\d+)$/)?.[1]), state: card.pr_state } : null,
            updated_at: card.updated_at };
          if (name === 'card_comments') {
            const reply = await source.lookupComments(args.card_key, ctx.signal);
            if ((reply.card_key && reply.card_key !== args.card_key) || (card.issue_ref && reply.issue_ref !== card.issue_ref)) throw new Error('card-comments-mismatch');
            result = (reply.comments || []).filter((x) => !x.card_key || x.card_key === args.card_key)
              .sort((a, b) => String(b.at || b.created_at).localeCompare(String(a.at || a.created_at))).slice(0, 30)
              .map((x) => ({ author: wrap(x.author || x.user?.login), at: x.at || x.created_at, text: wrap(x.text || x.body) }));
          }
          if (name === 'card_runs') {
            const run = await source.lookupRun(args.card_key, ctx.signal);
            if (run.card_key && run.card_key !== args.card_key) throw new Error('card-out-of-scope');
            result = { state: run.state, result: run.result === 'passed' || run.result === 'failed' ? run.result : 'not-run',
              summary: wrap(run.summary || run.report?.findings), at: run.at || run.updated_at };
          }
        } else {
          const number = args.number;
          if (name === 'get_issue') {
            const issue = await github.getIssue(ctx, number);
            kind = issue.head === undefined ? 'issue' : 'pr'; title = issue.title;
            evidence = { id: `${ctx.project.github.owner}/${ctx.project.github.repo}#${number}`, kind: kind === 'pr' ? 'pull_request' : 'issue',
              title: issue.title, state: issue.state === 'closed' ? 'done' : 'left', source_state: issue.state, rule: 'live', basis: 'observed', assignees: [], updated_at: '', evidence: [] };
            result = { ...issue, title: wrap(issue.title), body: wrap(issue.body), labels: issue.labels?.map(wrap),
              ...(issue.head === undefined ? {} : { head: wrap(issue.head), base: wrap(issue.base) }) };
          } else if (name === 'issue_comments') { kind = 'issue'; title = `#${number}`; result = (await github.issueComments(ctx, number)).map((x) => ({ ...x, author: wrap(x.author), text: wrap(x.text) })); }
          else if (name === 'pr_diff') { kind = 'pr'; title = `#${number}`; result = (await github.prDiff(ctx, number)).map((x) => ({ ...x, filename: wrap(x.filename), patch: wrap(x.patch) })); }
          else { kind = 'file'; title = args.path; result = await github.readFile(ctx, args.path); if (result.content !== undefined) result.content = wrap(result.content); }
        }
        const safe = cap(redactor.toModel({ result }), 8 * 1024);
        Object.assign(entry, { ref, ok: true, ...(kind ? { kind } : {}), ...(title ? { title: redactor.toModel(title) } : {}), ...(evidence ? { evidence: redactor.toModel(evidence) } : {}) });
        return safe;
      } catch { return { error: 'lookup-refused' }; }
      finally { ctx.reads.push(entry); }
    },
  };
}
module.exports = { createLookups, FACTORY, GITHUB, validate };
