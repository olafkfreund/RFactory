'use strict';

const STAGE = { plan_card: 'plan', code_card: 'code', test_card: 'test' };
const SERVICE = { plan: 'PFactory', code: 'AIFactory', test: 'TFactory' };
const WRITES = new Set(['create_card', 'update_card', 'move_card', 'reprioritise_card']);
const stageFor = (tier) => tier === 'hard' ? 'plan' : 'code';
const stateOf = (card, stage) => card?.stage_runs?.[stage]?.status;

function deriveEffects(action, args, cardBefore) {
  const tier = args.tier || cardBefore?.tier;
  const status = args.status || cardBefore?.status;
  const stage = STAGE[action] || (action === 'run_card'
    ? ['plan', 'code', 'test'].find((name) => stateOf(cardBefore, name) !== 'done')
    : stageFor(tier));
  const startsWork = WRITES.has(action)
    ? status === 'ready' && !!tier && !['dispatched', 'done'].includes(stateOf(cardBefore, stage))
    : !!stage && stateOf(cardBefore, stage) !== 'done';
  const github = WRITES.has(action);
  const key = args.card_key || '';
  const title = args.title || cardBefore?.title || '';
  const label = `${key ? `${key}, ` : ''}'${title}'`;
  const verb = { create_card: 'Create card', update_card: 'Update', move_card: 'Move',
    reprioritise_card: 'Reprioritise', run_card: 'Run', plan_card: 'Plan',
    code_card: 'Build', test_card: 'Test' }[action];
  const movement = action === 'move_card' ? ` from ${cardBefore.status} to ${args.status}` : '';
  const work = startsWork ? `This starts ${stage === 'plan' ? 'planning' : stage === 'test' ? 'testing' : 'a build'} in ${SERVICE[stage]}.` : '';
  const issue = github ? `${action === 'create_card' ? 'This opens or updates' : 'This updates'} its GitHub issue.` : '';
  return { startsWork, github, text: [`${verb} ${label}${movement}.`, work, issue].filter(Boolean).join(' ') };
}

function describe(payload, effects) {
  return `${effects.text} Approve it on the RFactory page.`;
}

module.exports = { deriveEffects, describe };
