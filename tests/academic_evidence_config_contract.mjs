import assert from 'node:assert/strict';
import {
  applyAcademicReallocationRule,
  buildMonteCarloExecutionEvidence,
  buildOptimizerCompletenessEvidence,
  buildOptimizerBestEvidence,
  buildScenarioExecutionEvidence,
  buildScenarioQualityEvidence,
  buildScenarioSavingEvidence,
  compareInventoryCosts,
  normalizeEvidenceNumber,
  prepareAcademicReallocation,
} from '../scripts/academic-evidence-config.mjs';

assert.equal(buildScenarioQualityEvidence({ simulation_status: 'error' }, {}), null);
const qualityEvidence = buildScenarioQualityEvidence(
  {
    simulation_status: 'success',
    scenario_id: 'example',
    flows: [
      { flow_type: 'cd_to_destination', cd: 'A', annual_revenue: 50 },
      { flow_type: 'cd_to_destination', cd: 'B', annual_revenue: 50 },
    ],
    total_with_tax: 100,
    costs: { total_logistics_cost: 100, tax_impact: 0 },
  },
  { costs: { costs: { total_with_tax: 100 } } }
);
assert.equal(qualityEvidence.quality_score, 100);
assert.equal(qualityEvidence.risk_level, 'low');
assert.equal(
  buildScenarioQualityEvidence({ simulation_status: 'success', flows: [] }, {}).risk_level,
  null
);
assert.equal(
  buildScenarioQualityEvidence(
    {
      simulation_status: 'success',
      flows: [{ cd: 'A', annual_revenue: 50 }],
      total_with_tax: null,
    },
    { costs: { costs: { total_with_tax: 100 } } }
  ).risk_level,
  null
);

const bestEvidence = buildOptimizerBestEvidence(
  {
    scenario_id: 'example',
    final_score: 72,
    result: { simulation_status: 'success', total_with_tax: 80 },
  },
  { simulation_status: 'success', total_with_tax: 100 }
);
assert.equal(bestEvidence.score, 72);
assert.equal(bestEvidence.simulation_status, 'success');
assert.equal(bestEvidence.saving_pct, 20);
assert.equal(
  buildScenarioSavingEvidence(
    { simulation_status: 'success', total_with_tax: 80 },
    { simulation_status: 'success', total_with_tax: 100 }
  ),
  20
);
assert.equal(
  buildScenarioSavingEvidence(
    { simulation_status: 'success', total_with_tax: 80 },
    { simulation_status: 'success', total_with_tax: 0 }
  ),
  null
);
assert.equal(
  buildOptimizerBestEvidence(
    { result: { simulation_status: 'error', total_with_tax: 0 } },
    { simulation_status: 'success', total_with_tax: 100 }
  ).saving_pct,
  null
);

const retailSource = {
  scenario_id: 'retail-sample',
  changes: { reallocation_rule: 'nearest_available_cd' },
};
const retail = prepareAcademicReallocation(retailSource, 'empresa1');
assert.equal(retail.scenario.changes.reallocation_rule, 'lowest_freight_available_cd');
assert.equal(retail.source_reallocation_rule, 'nearest_available_cd');
assert.equal(retail.effective_reallocation_rule, 'lowest_freight_available_cd');
assert.equal(retailSource.changes.reallocation_rule, 'nearest_available_cd');
assert.equal(
  applyAcademicReallocationRule(retailSource).changes.reallocation_rule,
  'lowest_freight_available_cd'
);

const industrySource = { scenario_id: 'industry-sample', changes: {} };
const industry = prepareAcademicReallocation(industrySource, 'empresa2');
assert.equal(industry.scenario.changes.reallocation_rule, 'nearest_available_cd');
assert.equal(industry.source_reallocation_rule, null);
assert.equal(industry.effective_reallocation_rule, 'nearest_available_cd');
const industryWithRetailRule = prepareAcademicReallocation(
  {
    scenario_id: 'industry-explicit-retail-rule',
    changes: { reallocation_rule: 'lowest_freight_available_cd' },
  },
  'empresa2'
);
assert.equal(industryWithRetailRule.source_reallocation_rule, 'lowest_freight_available_cd');
assert.equal(industryWithRetailRule.effective_reallocation_rule, 'lowest_freight_available_cd');

const scenarioEvidence = buildScenarioExecutionEvidence({
  simulation_status: 'error',
  calculation_status: 'invalid',
  data_quality: { status: 'limited_fiscal_coverage', coverage: { eligible_flow_count: 2 } },
  errors: [{ code: 'UNCOVERED_FLOWS' }],
  warnings: [{ code: 'FLOWS_REALLOCATED' }],
  validation: { valid: false },
});
assert.deepEqual(scenarioEvidence, {
  simulation_status: 'error',
  calculation_status: 'invalid',
  data_quality: { status: 'limited_fiscal_coverage', coverage: { eligible_flow_count: 2 } },
  errors: [{ code: 'UNCOVERED_FLOWS' }],
  warnings: [{ code: 'FLOWS_REALLOCATED' }],
  validation: { valid: false },
});

const monteCarloEvidence = buildMonteCarloExecutionEvidence({
  monte_carlo_status: 'blocked',
  errors: ['deterministic failed'],
  warnings: ['fiscal coverage limited'],
  summary: null,
});
assert.deepEqual(monteCarloEvidence, {
  monte_carlo_status: 'blocked',
  errors: ['deterministic failed'],
  warnings: ['fiscal coverage limited'],
  summary: null,
});

const limitedSearch = buildOptimizerCompletenessEvidence({
  optimizer_status: 'success_with_limited_space',
  result_scope: 'conditional_declared_catalog',
  search_log: {
    exact_search_space: false,
    exactness_reason: 'limited catalog',
    space_limited: true,
    candidate_space_size: 9000,
    simulated_candidates: 5000,
    coverage_ratio: 5000 / 9000,
  },
});
assert.equal(limitedSearch.exact_search_space, false);
assert.equal(limitedSearch.search_complete, false);
assert.equal(limitedSearch.exactness_reason, 'limited catalog');
assert.equal(limitedSearch.candidate_space_size, 9000);
assert.equal(limitedSearch.simulated_candidates, 5000);

const enumeratedWithFailures = buildOptimizerCompletenessEvidence({
  search_log: {
    exact_search_space: true,
    exactness_reason: 'all declared candidates enumerated',
    space_limited: false,
    candidate_space_size: 12,
    simulated_candidates: 12,
    valid_candidates: 10,
    invalid_candidates: 2,
    coverage_ratio: 1,
  },
});
assert.equal(enumeratedWithFailures.exact_search_space, true);
assert.equal(enumeratedWithFailures.search_complete, false);
assert.equal(enumeratedWithFailures.invalid_candidates, 2);
const missingCounts = buildOptimizerCompletenessEvidence({
  search_log: {
    exact_search_space: true,
    invalid_candidates: null,
    simulated_candidates: null,
    valid_candidates: null,
    candidate_space_size: null,
    space_limited: false,
  },
});
assert.equal(missingCounts.search_complete, false);
assert.match(missingCounts.completeness_reason, /contagens suficientes/);
assert.equal(
  buildOptimizerCompletenessEvidence({
    search_log: {
      exact_search_space: true,
      invalid_candidates: 0,
      simulated_candidates: 4,
      valid_candidates: 4,
      candidate_space_size: 4,
      space_limited: false,
    },
  }).search_complete,
  true
);

assert.equal(normalizeEvidenceNumber(null), null);
assert.equal(normalizeEvidenceNumber(undefined), null);
assert.equal(normalizeEvidenceNumber(''), null);
assert.equal(normalizeEvidenceNumber(0), 0);
assert.deepEqual(
  compareInventoryCosts(
    { simulation_status: 'success', costs: { inventory_cost: 100 } },
    { simulation_status: 'success', costs: { inventory_cost: 100 } }
  ),
  { equal_inventory_cost: true, comparison_status: 'compared' }
);
assert.deepEqual(
  compareInventoryCosts(
    { simulation_status: 'error', costs: { inventory_cost: 100 } },
    { simulation_status: 'success', costs: { inventory_cost: 100 } }
  ),
  { equal_inventory_cost: null, comparison_status: 'not_comparable' }
);
assert.deepEqual(
  compareInventoryCosts(
    { simulation_status: 'success', costs: { inventory_cost: null } },
    { simulation_status: 'success', costs: { inventory_cost: 0 } }
  ),
  { equal_inventory_cost: null, comparison_status: 'not_comparable' }
);

console.log('ACADEMIC_EVIDENCE_CONFIG_CONTRACT_OK');
