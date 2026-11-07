import assert from 'node:assert/strict';
import { evaluateScenarioQuality } from '../../assets/js/phase3/scenario-quality-check.js';
import { evaluateConstraints } from '../../assets/js/phase4/constraint-engine.js';

const baselineBundle = { costs: { costs: { total_with_tax: 100 } } };
const summarize = (flows, overrides = {}) =>
  evaluateScenarioQuality({
    scenarioResult: {
      scenario_id: 'synthetic',
      simulation_status: 'success',
      total_with_tax: 100,
      costs: { total_logistics_cost: 90, tax_impact: 10 },
      flows,
      flow_summary: { total_flows: flows.length, reallocated_flows: 0, uncovered_flows: 0 },
      ...overrides,
    },
    baselineBundle,
  });

const byDestinationWeight = summarize([
  { flow_type: 'cd_to_destination', cd: 'A', annual_weight_kg: 75 },
  { flow_type: 'cd_to_destination', cd: 'B', annual_weight_kg: 25 },
  { flow_type: 'factory_to_cd', cd: 'A', annual_weight_kg: 10000 },
]);
assert.equal(byDestinationWeight.quality_score, 100);
assert.equal(byDestinationWeight.risk_level, 'low');
assert.equal(byDestinationWeight.quality_metrics.max_cd_volume_share, 0.75);
assert.equal(byDestinationWeight.concentration_measure_basis, 'cd_to_destination_weight_kg');

const revenueFallback = summarize([
  { flow_type: 'cd_to_destination', cd: 'A', annual_revenue: 800, annual_weight_kg: 10 },
  { flow_type: 'cd_to_destination_proxy', cd: 'B', annual_revenue: 200 },
  { flow_type: 'factory_to_cd', cd: 'A', annual_weight_kg: 10000 },
]);
assert.equal(revenueFallback.quality_metrics.max_cd_volume_share, 0.8);
assert.equal(revenueFallback.concentration_measure_basis, 'cd_to_destination_revenue');

const inferredDestination = summarize([
  { cd: 'A', destination: 'Loja 1', annual_weight_kg: 70 },
  { cd: 'B', destination: 'Loja 2', annual_weight_kg: 30 },
]);
assert.equal(inferredDestination.quality_metrics.max_cd_volume_share, 0.7);
assert.equal(inferredDestination.concentration_measure_basis, 'cd_to_destination_weight_kg');

const factoryOnly = summarize([
  { flow_type: 'factory_to_cd', cd: 'A', annual_weight_kg: 80 },
  { flow_type: 'factory_to_cd', cd: 'B', annual_weight_kg: 20 },
]);
assert.equal(factoryOnly.quality_metrics.max_cd_volume_share, 0.8);
assert.equal(factoryOnly.concentration_measure_basis, 'factory_to_cd_weight_kg');

for (const flows of [
  [
    { flow_type: 'cd_to_destination', cd: 'A', annual_weight_kg: 10, annual_revenue: 100 },
    { flow_type: 'cd_to_destination', cd: 'B' },
    { flow_type: 'factory_to_cd', cd: 'A', annual_weight_kg: 10000 },
  ],
  [{ flow_type: 'factory_to_cd', cd: 'A' }],
  [{ flow_type: 'supplier_to_cd', cd: 'A', annual_weight_kg: 10 }],
]) {
  const unavailable = summarize(flows);
  assert.equal(unavailable.quality_score, null);
  assert.equal(unavailable.risk_level, null);
  assert.equal(unavailable.quality_metrics, null);
  assert.equal(unavailable.concentration_measure_basis, null);
  const optimizerConstraint = evaluateConstraints({
    scenarioResult: { scenario_id: 'synthetic', simulation_status: 'success' },
    quality: unavailable,
    scenario: { scenario_id: 'synthetic', changes: { active_cds: ['A'] } },
    constraints: { min_active_cds: 1, max_cd_volume_share: 1, max_risk_level: 'high' },
  });
  assert.equal(optimizerConstraint.passes_constraints, false);
  assert.ok(
    optimizerConstraint.violations.some((message) => /Concentração.*indisponível/.test(message))
  );
}

for (const invalidResult of [
  { simulation_status: undefined },
  { simulation_status: 'error' },
  { total_with_tax: '' },
  { total_with_tax: null },
  { costs: { total_logistics_cost: null, tax_impact: 10 } },
  { costs: { total_logistics_cost: 90, tax_impact: '' } },
]) {
  const unavailable = summarize(
    [{ flow_type: 'cd_to_destination', cd: 'A', annual_weight_kg: 10 }],
    invalidResult
  );
  assert.equal(unavailable.quality_score, null);
  assert.equal(unavailable.risk_level, null);
}

const fiscalLimitedButCalculable = evaluateScenarioQuality({
  scenarioResult: {
    scenario_id: 'fiscal-limited',
    simulation_status: 'success',
    calculation_status: 'success_with_tax_limits',
    total_with_tax: 100,
    costs: { total_logistics_cost: 90, tax_impact: 10 },
    tax_results: { tax_coverage: { coverage_limited: true } },
    flows: [
      { flow_type: 'cd_to_destination', cd: 'A', annual_weight_kg: 50 },
      { flow_type: 'cd_to_destination', cd: 'B', annual_weight_kg: 50 },
    ],
    flow_summary: { total_flows: 2, reallocated_flows: 0, uncovered_flows: 0 },
  },
  baselineBundle,
});
assert.equal(fiscalLimitedButCalculable.quality_score, 100);
assert.equal(fiscalLimitedButCalculable.risk_level, 'low');

console.log('SCENARIO_QUALITY_CONCENTRATION_OK');
