import assert from 'node:assert/strict';
import { normalizeRoute } from '../../assets/js/app/router.js';
import { ROUTE_RENDERERS } from '../../assets/js/app/route-renderers.js';
import {
  renderOptimizerResults,
  renderOptimizerTradeoffs,
} from '../../assets/js/app/pages/optimizer.js';

const resultsRoute = '#/network/optimizer/results';
const tradeoffsRoute = '#/network/optimizer/tradeoffs';
assert.equal(normalizeRoute(resultsRoute), resultsRoute);
assert.equal(normalizeRoute(tradeoffsRoute), tradeoffsRoute);
assert.equal(ROUTE_RENDERERS['/network/optimizer/results'], renderOptimizerResults);
assert.equal(ROUTE_RENDERERS['/network/optimizer/tradeoffs'], renderOptimizerTradeoffs);

const optimizer = {
  company_id: 'empresa_mock',
  optimizer_status: 'success',
  result_scope: 'exact_declared_space',
  requested_config: {
    profile_id: 'cfo',
    optimizer_config: { max_candidates: 800, seed: 17 },
    constraints: { min_active_cds: 1, max_active_cds: 3, max_risk_level: 'high' },
  },
  search_log: { simulated_candidates: 4 },
  best_scenarios: [
    {
      company_id: 'empresa_mock',
      scenario_id: 'candidate-a',
      scenario_name: 'Alternativa A',
      result: { company_id: 'empresa_mock', total_with_tax: 100 },
      final_score: 0.82,
      quality: { quality_score: 78, risk_level: 'low' },
    },
  ],
  scored_scenarios: [],
};
const state = {
  context: { company_id: 'empresa_mock' },
  data: { optimizer, scenarios: [] },
  ui: { route: resultsRoute },
};

const results = renderOptimizerResults(state);
assert.match(results, /page-optimizer-results/);
assert.match(results, /Ranking da avaliação/);
assert.match(results, /Alternativa A/);
assert.match(results, /Pontuação das melhores alternativas/);
assert.match(results, /niRankingChart/);
assert.match(results, /Eficiência financeira/);
assert.match(results, /Concluído/);
assert.match(results, /Seed da busca/);
assert.match(results, /CDs ativos<\/dt><dd>1 a 3<\/dd>/);
assert.match(results, /Risco máximo<\/dt><dd>Alto<\/dd>/);
assert.doesNotMatch(results, /evidência|cobertura|Exploratório|qualidade dos dados/i);
assert.equal(optimizer.optimizer_status, 'success');
assert.equal(optimizer.requested_config.constraints.max_risk_level, 'high');

state.ui.route = tradeoffsRoute;
const tradeoffs = renderOptimizerTradeoffs(state);
assert.match(tradeoffs, /page-optimizer-tradeoffs/);
assert.match(tradeoffs, /Custo × pontuação/);
assert.match(tradeoffs, /niDecisionOptimizerFrontierChart/);
assert.match(tradeoffs, /Alternativa A/);
assert.match(tradeoffs, /Custo total × pontuação/);
assert.doesNotMatch(tradeoffs, /evidência|cobertura|Exploratório|qualidade dos dados/i);

console.log('OPTIMIZER_TABS_OK');
