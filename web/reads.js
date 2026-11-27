'use strict';
const { summarise } = require('@rfactory/core/src/items.js');
const { mapCard } = require('@rfactory/core/src/sources/cfactory.js');
const { buildStandup, speakStandupHeadline } = require('@rfactory/core/src/standup.js');
const { reviewCard, reviewProject } = require('@rfactory/core/src/review.js');

const refusal = (status, code) => Object.assign(new Error(code), { refusal: status });
const CARD_KEY = /^[\w.-]{1,128}$/;

// #52: a project's repositories, joined by id; CFactory's two lists are sorted independently, so never zip them
function repositoriesOf(project, repos) {
  const joined = project.repository_ids.map((id) => {
    const repo = repos.find((r) => r.id === id);
    const where = repo?.intake_project ?? repo?.project;
    if (typeof where !== 'string' || !where) throw new Error('project-resolve-failed');
    return { id, path: where };
  });
  if (!joined.length) throw new Error('project-resolve-failed');
  return joined;
}
const describe = (project, repos) => ({ id: project.id, name: project.name, slug: project.slug, repositories: repositoriesOf(project, repos) });

// The reads the page and the agent listener share. They know nothing about who calls.
function createReads({ scope }) {
  const allowed = scope?.projects ? new Set(scope.projects.allow.map((p) => p.id)) : null; // null: everything is as before #52

  // nothing is cached: every start and read resolves the project again, and the allowlist is checked before CFactory is asked
  async function bind(source, id) {
    if (!allowed.has(id)) throw refusal(403, 'project-not-allowed');
    const project = (await source.listProjects()).find((p) => p.id === id);
    if (!project) throw refusal(404, 'project-unknown');
    const repositories = repositoriesOf(project, await source.listRepositories());
    return { projectId: project.id, name: project.name, repositories,
      writable: repositories.some((r) => r.id === scope.source.repository_id) };
  }
  const viewOf = (source, binding) => source.forRepositories(binding.repositories.map((r) => r.id), { name: binding.name });

  async function listProjects(source) {
    const [projects, repos] = await Promise.all([source.listProjects(), source.listRepositories()]);
    // one project that cannot be joined must not take the picker away from the others
    return projects.filter((p) => allowed.has(p.id)).flatMap((p) => {
      try { return [describe(p, repos)]; }
      catch { console.error(`rfactory-web: project skipped: ${p.id} repository-missing`); return []; }
    });
  }

  function standupBody(data, redactor) {
    const { cards, conflicting, freshness, fetched_at } = data;
    const items = cards.map(mapCard);
    const newest_update = items.map((i) => i.updated_at).filter(Boolean).sort().pop() || null;
    const counts = summarise(items);
    const summary = buildStandup(data);
    const headline = speakStandupHeadline(summary, redactor || { toModel: (s) => s });
    return { items, counts, unknown: items.filter((i) => i.state === 'unknown'),
      fetched_at, newest_update, summary: headline, summary_error: null, destination: 'the server',
      standup: summary, headline, freshness, conflicting };
  }

  const projectReview = (view) => view.standupData().then(({ cards, conflicting, freshness, fetched_at }) =>
    ({ ...reviewProject(cards, freshness), conflicting, fetched_at }));
  const cardReview = (view, card_key) => view.reviewData(card_key).then((result) => result.found
    ? reviewCard(result.card, result.discussion, result.freshness) : null);

  return { allowed, bind, viewOf, listProjects, standupBody, reviewProject: projectReview, reviewCard: cardReview };
}

module.exports = { createReads, refusal, repositoriesOf, describe, CARD_KEY };
