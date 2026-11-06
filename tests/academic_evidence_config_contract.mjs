import assert from 'node:assert/strict';
import {
  calculateInventoryCost,
  getCompanyModelDefaults,
  normalizeScenarioModelDefaults,
} from '../assets/js/core/model-configuration.js';
import { buildScenarioSummary } from '../assets/js/core/scenario-summary.js';
import { runTaxCalculation } from '../assets/js/core/tax/tax-orchestrator.js';
import {
  applyAcademicReallocationRule,
  buildMonteCarloExecutionEvidence,
  buildOptimizerCompletenessEvidence,
  buildOptimizerBestEvidence,
  buildScenarioExecutionEvidence,
  buildScenarioQualityEvidence,
  buildScenarioSavingEvidence,
  buildAcademicScenarioEvidence,
  compareInventoryCosts,
  projectAcademicScenarioResult,
  projectMonteCarloExecutionEvidence,
  normalizeEvidenceNumber,
  prepareAcademicReallocation,
} from '../scripts/academic-evidence-config.mjs';

assert.deepEqual(
  {
    inventory_days: getCompanyModelDefaults('empresa1').inventory_days,
    reference_wacc: getCompanyModelDefaults('empresa1').reference_wacc,
  },
  { inventory_days: 30, reference_wacc: 0.15 }
);
assert.deepEqual(
  {
    inventory_days: getCompanyModelDefaults('empresa2').inventory_days,
    reference_wacc: getCompanyModelDefaults('empresa2').reference_wacc,
  },
  { inventory_days: 45, reference_wacc: 0.12 }
);
assert.equal(calculateInventoryCost({ companyId: 'empresa1', baseInventoryCost: 100 }), 100);
assert.equal(
  calculateInventoryCost({ companyId: 'empresa1', baseInventoryCost: 100, inventoryDays: 45 }),
  150
);
assert.equal(calculateInventoryCost({ companyId: 'empresa2', baseInventoryCost: 100 }), 100);
assert.equal(
  calculateInventoryCost({ companyId: 'empresa2', baseInventoryCost: 100, wacc: 0.15 }),
  125
);
assert.deepEqual(
  normalizeScenarioModelDefaults('empresa1', {
    scenario_id: 'empresa1_sample_estoque_menos_10_dias',
    changes: { inventory_days: 35 },
  }).changes.inventory_days,
  20
);
assert.equal(
  normalizeScenarioModelDefaults('empresa1', {
    scenario_id: 'empresa1_sample_frete_mais_10',
    changes: { inventory_days: 45, wacc: 0.15 },
  }).changes.inventory_days,
  30
);
assert.equal(
  normalizeScenarioModelDefaults('empresa2', {
    scenario_id: 'empresa2_sample_frete_mais_10',
    changes: { inventory_days: 45, wacc: 0.15 },
  }).changes.wacc,
  0.12
);
assert.deepEqual(
  normalizeScenarioModelDefaults('empresa1', {
    scenario_id: 'other_scenario',
    changes: { inventory_days: 35 },
  }).changes.inventory_days,
  35
);
assert.equal(
  buildScenarioSummary({
    scenario: { company_id: 'empresa2', changes: {} },
    result: { total_with_tax: 100 },
    baselineTotal: 100,
  }).inventory_days,
  45
);
assert.equal(
  buildScenarioSummary({
    scenario: { company_id: 'empresa1', changes: {} },
    result: { total_with_tax: 100 },
    baselineTotal: 100,
  }).inventory_days,
  30
);
assert.equal(
  runTaxCalculation({
    scenario: { company_id: 'empresa2', changes: { tax_mode: 'reform_2027', tax_year: 2027 } },
    rebuiltFlows: [],
    baseTaxBlock: { total_tax_impact: 100 },
    taxMode: 'reform_2027',
  }).decision_use,
  'exploratory_only'
);

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

const privateFlowSentinel = 'PRIVATE_FLOW_SENTINEL_9f4c';
const projectedScenario = projectAcademicScenarioResult({
  result: {
    scenario_id: 'fixture-scenario',
    scenario_name: 'fixture scenario',
    company_id: 'empresa2',
    scenario: {
      changes: {
        active_cds: ['PRIVATE_LOCATION_SENTINEL'],
        freight_multiplier: 1.1,
        demand_multiplier: 1,
        inventory_days: 45,
        wacc: 0.12,
        tax_mode: 'current',
      },
    },
    costs: {
      transfer_cost: 10,
      distribution_cost: 20,
      storage_cost: 30,
      inventory_cost: 40,
      tax_impact: 50,
      total_logistics_cost: 100,
      total_with_tax: 150,
      calculation_method: 'physical_cif_table',
      flow_cost_detail: [{ flow_id: privateFlowSentinel, distribution_cost: 999 }],
      tax_details: {
        flow_breakdown: [{ flow_id: privateFlowSentinel, tax_amount: 777 }],
      },
      diagnostics: {
        flow_count: 2,
        fallback_counts: { missing_weight: 1, [privateFlowSentinel]: 1 },
        fallback_denominators: { distribution: 2 },
        fallback_rates: { missing_weight: 0.5 },
        private_rows: [{ flow_id: privateFlowSentinel }],
      },
    },
    total_with_tax: 150,
    flows: [{ flow_id: privateFlowSentinel }],
    warnings: [`private warning ${privateFlowSentinel}`],
    errors: [`private error ${privateFlowSentinel}`],
    validation: { valid: true, rows: [{ flow_id: privateFlowSentinel }] },
    data_quality: {
      status: 'limited_fiscal_coverage',
      decision_use: 'exploratory_only',
      coverage_limited: true,
      coverage: {
        eligible_flow_count: 2,
        uncovered_flow_count: 1,
        complete_fiscal_coverage_ratio: 0.5,
        private_rows: [{ flow_id: privateFlowSentinel }],
      },
    },
  },
  reallocationAudit: {
    source_reallocation_rule: 'nearest_available_cd',
    effective_reallocation_rule: 'nearest_available_cd',
  },
  baselineResult: { simulation_status: 'success', total_with_tax: 200 },
  quality: { quality_score: 82, risk_level: 'medium', private_rows: [privateFlowSentinel] },
});
const projectedScenarioJson = JSON.stringify(projectedScenario);
assert.ok(!projectedScenarioJson.includes(privateFlowSentinel));
assert.ok(!projectedScenarioJson.includes('PRIVATE_LOCATION_SENTINEL'));
assert.ok(!projectedScenarioJson.includes('fixture-scenario'));
assert.equal(projectedScenario.scenario_id, null);
assert.equal(
  projectAcademicScenarioResult({
    result: { scenario_id: privateFlowSentinel },
    scenarioId: privateFlowSentinel,
  }).scenario_id,
  null
);
assert.equal(
  projectAcademicScenarioResult({ result: {}, scenarioId: 'sample_001' }).scenario_id,
  'sample_001'
);
assert.equal(projectedScenario.costs.transfer_cost, 10);
assert.equal(projectedScenario.costs.total_with_tax, 150);
assert.equal(projectedScenario.diagnostics.fallback_counts.missing_weight, 1);
assert.equal(projectedScenario.diagnostics.fallback_rates.missing_weight, 0.5);
assert.equal(projectedScenario.active_cds_count, 1);
assert.equal(projectedScenario.quality.quality_score, 82);

const privateTaxModeSentinel = 'PRIVATE_TAX_MODE_SENTINEL_41ac';
const projectedPrivateTaxMode = projectAcademicScenarioResult({
  result: {
    company_id: 'empresa1',
    scenario: { changes: { tax_mode: privateTaxModeSentinel } },
  },
});
assert.equal(projectedPrivateTaxMode.tax_mode, null);
assert.ok(!JSON.stringify(projectedPrivateTaxMode).includes(privateTaxModeSentinel));
assert.equal(
  projectAcademicScenarioResult({
    result: { company_id: 'empresa1', scenario: { changes: { tax_mode: 'reform_2027' } } },
  }).tax_mode,
  'reform_2027'
);

const privateMonteCarloMetadataSentinel = 'PRIVATE_MC_METADATA_SENTINEL_45de';
const projectedPrivateMonteCarlo = projectMonteCarloExecutionEvidence({
  monte_carlo_status: 'success',
  summary: {
    risk_band: privateMonteCarloMetadataSentinel,
    risk_band_policy: privateMonteCarloMetadataSentinel,
    decision_use: privateMonteCarloMetadataSentinel,
    analysis_type: privateMonteCarloMetadataSentinel,
    uncertainty_source: privateMonteCarloMetadataSentinel,
    probability_interpretation: privateMonteCarloMetadataSentinel,
    scatter_driver: privateMonteCarloMetadataSentinel,
    most_sensitive_driver: privateMonteCarloMetadataSentinel,
  },
});
assert.ok(!JSON.stringify(projectedPrivateMonteCarlo).includes(privateMonteCarloMetadataSentinel));
for (const field of [
  'risk_band',
  'risk_band_policy',
  'decision_use',
  'analysis_type',
  'uncertainty_source',
  'probability_interpretation',
  'scatter_driver',
  'most_sensitive_driver',
])
  assert.equal(projectedPrivateMonteCarlo.summary[field], null, `${field} is enum-projected`);
const projectedKnownMonteCarloEnums = projectMonteCarloExecutionEvidence({
  monte_carlo_status: 'success',
  summary: {
    risk_band: 'medium',
    risk_band_policy: {
      id: 'project_monte_carlo_risk_v1',
      source: privateMonteCarloMetadataSentinel,
    },
    decision_use: 'exploratory_only',
    analysis_type: 'exploratory_uncertainty_analysis',
    uncertainty_source: 'parametric_assumptions',
    probability_interpretation: 'condicional_as_premissas_parametricas',
    scatter_driver: 'freight_multiplier',
    most_sensitive_driver: 'inventory_days',
  },
});
assert.equal(projectedKnownMonteCarloEnums.summary.risk_band, 'medium');
assert.equal(projectedKnownMonteCarloEnums.summary.risk_band_policy, 'project_monte_carlo_risk_v1');
assert.ok(
  !JSON.stringify(projectedKnownMonteCarloEnums).includes(privateMonteCarloMetadataSentinel)
);
const projectedPrivateMonteCarloMetadata = buildAcademicScenarioEvidence({
  monteCarlo: {
    config: {
      profile: privateMonteCarloMetadataSentinel,
      scatter_driver: privateMonteCarloMetadataSentinel,
      historical_provenance_status: privateMonteCarloMetadataSentinel,
    },
    data_quality_status: privateMonteCarloMetadataSentinel,
  },
});
assert.ok(
  !JSON.stringify(projectedPrivateMonteCarloMetadata).includes(privateMonteCarloMetadataSentinel)
);

const bestEvidence = buildOptimizerBestEvidence(
  {
    scenario_id: 'example',
    final_score: 72,
    scenario: {
      scenario_name: 'private branch',
      changes: { active_cds: ['PRIVATE_LOCATION_SENTINEL'] },
    },
    result: { simulation_status: 'success', total_with_tax: 80 },
  },
  { simulation_status: 'success', total_with_tax: 100 }
);
assert.equal(bestEvidence.score, 72);
assert.equal(bestEvidence.scenario_id, 'candidate_rank_0001');
assert.equal(bestEvidence.simulation_status, 'success');
assert.equal(bestEvidence.saving_pct, 20);
assert.equal(bestEvidence.active_cd_count, 1);
assert.ok(!JSON.stringify(bestEvidence).includes('PRIVATE_LOCATION_SENTINEL'));
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
    exactness_reason: 'PRIVATE_SEARCH_LOG_SENTINEL',
    space_limited: true,
    candidate_space_size: 9000,
    simulated_candidates: 5000,
    coverage_ratio: 5000 / 9000,
  },
});
assert.equal(limitedSearch.exact_search_space, false);
assert.equal(limitedSearch.search_complete, false);
assert.equal(limitedSearch.exactness_reason, undefined);
assert.equal(
  limitedSearch.completeness_reason,
  'O espaço declarado não foi enumerado integralmente.'
);
assert.ok(!JSON.stringify(limitedSearch).includes('PRIVATE_SEARCH_LOG_SENTINEL'));
assert.equal(limitedSearch.candidate_space_size, 9000);
assert.equal(limitedSearch.simulated_candidates, 5000);

const enumeratedWithFailures = buildOptimizerCompletenessEvidence({
  search_log: {
    exact_search_space: true,
    exactness_reason: 'PRIVATE_EXACTNESS_SENTINEL',
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
assert.equal(
  buildOptimizerCompletenessEvidence({
    search_log: {
      exact_search_space: true,
      invalid_candidates: false,
      simulated_candidates: true,
      valid_candidates: true,
      candidate_space_size: true,
      space_limited: false,
    },
  }).search_complete,
  false
);
assert.equal(
  buildOptimizerCompletenessEvidence({
    search_log: {
      exact_search_space: true,
      invalid_candidates: [],
      simulated_candidates: [4],
      valid_candidates: [4],
      candidate_space_size: [4],
      space_limited: false,
    },
  }).search_complete,
  false
);
assert.equal(
  buildOptimizerCompletenessEvidence({
    search_log: {
      exact_search_space: true,
      invalid_candidates: 0.5,
      simulated_candidates: 4,
      valid_candidates: 3.5,
      candidate_space_size: 4,
      space_limited: false,
    },
  }).search_complete,
  false
);
assert.equal(
  buildOptimizerCompletenessEvidence({
    search_log: {
      exact_search_space: true,
      invalid_candidates: 0,
      simulated_candidates: 5,
      valid_candidates: 5,
      candidate_space_size: 4,
      space_limited: false,
    },
  }).search_complete,
  false
);

assert.equal(normalizeEvidenceNumber(null), null);
assert.equal(normalizeEvidenceNumber(undefined), null);
assert.equal(normalizeEvidenceNumber(''), null);
assert.equal(normalizeEvidenceNumber(true), null);
assert.equal(normalizeEvidenceNumber(false), null);
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
