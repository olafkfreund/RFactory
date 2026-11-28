'use strict';
const { STATES } = require('./items.js');
const { mapCard } = require('./sources/cfactory.js');
const { validPath, validNumber } = require('./sources/github-read.js');

const CARD = /^[A-Z][A-Z0-9]+-\d+$/;
const JIRA_PROJECT = /^[A-Z][A-Z0-9_]{1,19}$/;
const JIRA_KEY = /^[A-Z][A-Z0-9_]{1,19}-\d+$/;
const specs = {
  find_cards: { text: 'string', state: 'string?' }, get_card: { card_key: 'string' },
  card_comments: { card_key: 'string' }, card_runs: { card_key: 'string' },
  get_issue: { number: 'integer' }, issue_comments: { number: 'integer' },
  pr_diff: { number: 'integer' }, read_file: { path: 'string' },
  jira_issue: { key: 'string' }, jira_list: { project: 'string', state: 'string?' },
};
const FACTORY = Object.keys(specs).slice(0, 4);
const GITHUB = Object.keys(specs).slice(4, 8);
const JIRA = Object.keys(specs).slice(8);
const wrap = (text) => ({ untrusted: true, text: String(text ?? '') });
const clip = (text) => Array.from(String(text)).slice(0, 200).join('');
// an investigation run's outcome, from its test results; what cannot be read is not called passed
function runResult(tests) {
  if (!Array.isArray(tests) || !tests.length) return 'not-run';
  if (tests.some((t) => t?.failed > 0 || (Number.isInteger(t?.exit_code) && t.exit_code !== 0))) return 'failed';
  return tests.every((t) => t?.exit_code === 0 || (t?.parsed !== false && t?.failed === 0)) ? 'passed' : 'not-run';
}

function validate(name, args, repos = [], jiraProjects = []) {
  const spec = specs[name];
  if (!spec || !args || typeof args !== 'object' || Array.isArray(args)) return false;
  if (Object.keys(args).some((key) => !Object.hasOwn(spec, key) && !(repos.length > 1 && GITHUB.includes(name) && key === 'repo'))) return false;
  if (repos.length > 1 && GITHUB.includes(name) && !repos.includes(args.repo)) return false;
  for (const [key, type] of Object.entries(spec)) {
    if (type.endsWith('?') && args[key] === undefined) continue;
    if (type === 'integer' ? !validNumber(args[key]) : typeof args[key] !== 'string') return false;
  }
  if (name === 'find_cards') return args.text.length >= 1 && args.text.length <= 200 && (args.state === undefined || STATES.includes(args.state));
  if (Object.hasOwn(args, 'card_key')) return CARD.test(args.card_key);
  if (name === 'read_file') return validPath(args.path);
  if (name === 'jira_issue') {
    if (!JIRA_KEY.test(args.key)) return false;
    const project = args.key.slice(0, args.key.lastIndexOf('-'));
    return jiraProjects.length === 0 || jiraProjects.includes(project);
  }
  if (name === 'jira_list') {
    if (!JIRA_PROJECT.test(args.project)) return false;
    if (jiraProjects.length > 0 && !jiraProjects.includes(args.project)) return false;
    return args.state === undefined || STATES.includes(args.state);
  }
  return true;
}
function schema(name, repos = [], jiraProjects = []) {
  const properties = {};
  const required = [];
  for (const [key, type] of Object.entries(specs[name])) {
    properties[key] = type === 'integer' ? { type: 'integer', minimum: 1 } : { type: 'string' };
    if (!type.endsWith('?')) required.push(key);
  }
  if (name === 'find_cards') { properties.text.minLength = 1; properties.text.maxLength = 200; properties.state.enum = STATES; }
  if (properties.card_key) properties.card_key.pattern = CARD.source;
  if (properties.path) properties.path.maxLength = 300;
  if (repos.length > 1 && GITHUB.includes(name)) { properties.repo = { type: 'string', enum: repos }; required.push('repo'); }
  if (name === 'jira_issue') properties.key.pattern = JIRA_KEY.source;
  if (name === 'jira_list') {
    if (jiraProjects.length) properties.project.enum = jiraProjects;
    else properties.project.pattern = JIRA_PROJECT.source;
    properties.state.enum = STATES;
  }
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
  const final = () => (truncated ? { ...result, truncated: true } : result);
  while (Buffer.byteLength(JSON.stringify(final())) > 40 * 1024) {
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
  return final();
}
function createLookups({ source, github, jira = null, redactor }) {
  const clients = github instanceof Map ? github : null;
  const names = clients ? [...clients.keys()] : [];
  const bound = (ctx) => ctx.project?.github || ctx.project?.githubs?.length;
  const boundJira = (ctx) => Boolean(ctx.project?.jira?.projects?.length);
  return {
    tools(ctx) {
      const jiraProjects = ctx.project?.jira?.projects ?? [];
      return ctx.tools.filter((name) => specs[name] && (
        FACTORY.includes(name) ||
        (GITHUB.includes(name) && github && bound(ctx)) ||
        (JIRA.includes(name) && jira && boundJira(ctx))
      )).map((name) => ({
        name,
        description: `Read ${name.replaceAll('_', ' ')} in ${GITHUB.includes(name)
          ? names.length > 1 ? 'the selected GitHub repository' : `the GitHub repository ${ctx.project.github.owner}/${ctx.project.github.repo}`
          : JIRA.includes(name) ? `the bound Jira project${jiraProjects.length > 1 ? 's' : ''} (${jiraProjects.join(', ')})` : 'the bound project'}`,
        inputSchema: schema(name, names, jiraProjects),
      }));
    },
    async call(ctx, name, args) {
      // only a delivered read logs a ref: a model's argument could carry question text into the record
      const entry = { tool: name, ref: '', ok: false };
      let ref = args?.card_key ?? args?.number ?? args?.path ?? '';
      try {
        const jiraProjects = ctx.project?.jira?.projects ?? [];
        if (!ctx.tools.includes(name) || !validate(name, args, names, jiraProjects) ||
          (GITHUB.includes(name) && (!github || !bound(ctx))) ||
          (JIRA.includes(name) && (!jira || !boundJira(ctx)))) throw new Error('lookup-refused');
        if (ctx.signal?.aborted) throw new Error('aborted');
        const selected = GITHUB.includes(name) ? names.length > 1 ? args.repo : names[0] : null;
        const reader = selected ? clients.get(selected) : github;
        const gh = selected ? ctx.project.githubs.find((b) => `${b.owner}/${b.repo}`.toLowerCase() === selected) : ctx.project.github;
        const readCtx = selected ? (ctx.githubContexts ??= new Map()).get(selected) || (() => {
          const own = { project: { github: gh }, signal: ctx.signal, commit: null };
          ctx.githubContexts.set(selected, own);
          return own;
        })() : ctx;
        let result, kind, title, evidence;
        if (name === 'find_cards') {
          // lookupCards returns in-scope cards only
          const text = args.text.toLowerCase();
          const matches = (await source.lookupCards(ctx.signal)).filter((card) => (!args.state || mapCard(card).state === args.state) &&
            `${card.card_key} ${card.title || ''}`.toLowerCase().includes(text)).slice(0, 20);
          ref = matches.map((x) => x.card_key).join(',');
          kind = 'card';
          result = matches.map((x) => ({ card_key: x.card_key, title: wrap(x.title), state: mapCard(x).state, updated_at: x.updated_at }));
        } else if (FACTORY.includes(name)) {
          const card = await source.lookupCard(args.card_key, ctx.signal);
          kind = 'card'; title = card.title; evidence = mapCard(card);
          if (name === 'get_card') {
            // a project call may span repositories: a number is given only when the GitHub tools would read the repository it is in
            const bindings = ctx.project.githubs?.length ? ctx.project.githubs : ctx.project.github ? [ctx.project.github] : [];
            const numbered = (key, ref, state) => {
              const match = bindings.find((b) => ref && String(ref).toLowerCase().startsWith(`${b.owner}/${b.repo}#`.toLowerCase()));
              return ctx.project.bound && ref && !match ? {} : { [key]: ref ? { number: Number(ref.match(/#(\d+)$/)?.[1]), state,
                ...(bindings.length > 1 ? { repo: `${match.owner}/${match.repo}`.toLowerCase() } : {}) } : null };
            };
            result = { card_key: card.card_key, title: wrap(card.title), state: evidence.state,
              plan: wrap(card.plan || card.description), acceptance: wrap(card.acceptance || card.acceptance_criteria),
              ...numbered('issue', card.issue_ref, card.issue_state), ...numbered('pr', card.pr_ref, card.pr_state),
              updated_at: card.updated_at };
          }
          if (name === 'card_comments') {
            const reply = await source.lookupComments(args.card_key, ctx.signal);
            if ((reply.card_key && reply.card_key !== args.card_key) || (card.issue_ref && reply.issue_ref !== card.issue_ref)) throw new Error('card-comments-mismatch');
            result = (reply.comments || []).filter((x) => !x.card_key || x.card_key === args.card_key)
              .sort((a, b) => String(b.at || b.created_at).localeCompare(String(a.at || a.created_at))).slice(0, 30)
              .map((x) => ({ author: wrap(x.author || x.user?.login), at: x.at || x.created_at, text: wrap(x.text || x.body) }));
          }
          if (name === 'card_runs') {
            // the shapes web/investigations.js reads: the card's record names the run, the run holds the results
            const found = await source.lookupRun(args.card_key, ctx.signal);
            if (found.card_key && found.card_key !== args.card_key) throw new Error('card-out-of-scope');
            const runId = found.detail?.run_id ?? found.run_id;
            if (typeof runId !== 'string' || !runId) result = { result: 'not-run' };
            else {
              const run = await source.investigationState(args.card_key, runId, ctx.signal);
              if (!run || run.error || (run.card_key && run.card_key !== args.card_key)) throw new Error('source-error');
              const findings = run.report?.findings;
              result = { state: run.state === 'done' ? 'completed' : run.state, result: runResult(run.tests),
                summary: wrap(typeof findings === 'object' ? JSON.stringify(findings) : findings), at: run.at || run.updated_at };
            }
          }
        } else if (JIRA.includes(name)) {
          if (name === 'jira_issue') {
            const item = await jira.issue(args.key, { signal: ctx.signal });
            if (item?.key !== args.key) throw new Error('jira-not-found');
            ref = item.key; kind = 'jira'; title = item.title;
            evidence = { id: item.key, kind: 'jira', title: item.title, state: item.state, source_state: item.source_state,
              rule: 'live', basis: 'observed', assignees: [], updated_at: '', evidence: [] };
            result = { key: item.key, title: wrap(item.title), state: item.state, source_state: wrap(item.source_state) };
          } else {
            const rawItems = await jira.list(args.project, args.state, { signal: ctx.signal });
            if (!Array.isArray(rawItems)) throw new Error('jira-bad-reply');
            const items = rawItems.filter((item) => item && typeof item.key === 'string' && JIRA_KEY.test(item.key) &&
              item.key.slice(0, item.key.lastIndexOf('-')) === args.project);
            ref = items.map((x) => x.key).join(',');
            kind = 'jira';
            evidence = items.map((x) => ({ id: x.key, kind: 'jira', title: x.title, state: x.state, source_state: x.source_state,
              rule: 'live', basis: 'observed', assignees: [], updated_at: '', evidence: [] }));
            result = items.map((x) => ({ key: x.key, title: wrap(x.title), state: x.state, source_state: wrap(x.source_state) }));
          }
        } else {
          const number = args.number;
          if (name === 'get_issue') {
            const issue = await reader.getIssue(readCtx, number);
            kind = issue.head === undefined ? 'issue' : 'pr'; title = issue.title;
            evidence = { id: `${gh.owner}/${gh.repo}#${number}`, kind: kind === 'pr' ? 'pull_request' : 'issue',
              title: issue.title, state: issue.state === 'closed' ? 'done' : kind === 'pr' ? 'in_progress' : 'left', source_state: issue.state, rule: 'live', basis: 'observed', assignees: [], updated_at: '', evidence: [] };
            result = { ...issue, title: wrap(issue.title), body: wrap(issue.body), labels: issue.labels?.map(wrap),
              ...(issue.head === undefined ? {} : { head: wrap(issue.head), base: wrap(issue.base) }) };
          } else if (name === 'issue_comments') { kind = 'issue'; title = `#${number}`; result = (await reader.issueComments(readCtx, number)).map((x) => ({ ...x, author: wrap(x.author), text: wrap(x.text) })); }
          else if (name === 'pr_diff') { kind = 'pr'; title = `#${number}`; result = (await reader.prDiff(readCtx, number)).map((x) => ({ ...x, filename: wrap(x.filename), patch: wrap(x.patch) })); }
          else { kind = 'file'; title = args.path; result = await reader.readFile(readCtx, args.path); if (result.content !== undefined) result.content = wrap(result.content); }
        }
        const safe = cap(redactor.toModel({ result, ...(name === 'jira_list' && result.length === 20 ? { limited: true } : {}) }), 8 * 1024);
        const proof = evidence && redactor.toModel(evidence);
        Object.assign(entry, { ref: redactor.toModel(ref), ok: true, ...(GITHUB.includes(name) && ctx.project.bound ? { repo: `${gh.owner}/${gh.repo}` } : {}), ...(kind ? { kind } : {}),
          ...(title ? { title: clip(redactor.toModel(title)) } : {}),
          ...(proof ? { evidence: Array.isArray(proof) ? proof.map((p) => ({ ...p, title: clip(p.title) })) : { ...proof, title: clip(proof.title) } } : {}) });
        return safe;
      } catch { return { error: 'lookup-refused' }; }
      finally { ctx.reads.push(entry); }
    },
  };
}
module.exports = { createLookups, FACTORY, GITHUB, JIRA, validate };
