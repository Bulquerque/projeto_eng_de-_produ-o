import assert from 'node:assert/strict';
import { buildScenarioFromForm } from '../../assets/js/phase3/scenario-builder.js';
import { runScenario } from '../../assets/js/phase3/scenario-simulator.js';

const baselineBundle = {
  model: { scenario_id: 'synthetic_baseline', active_cds: ['CD A', 'CD B'] },
  flows: [],
  core_data: { distance_matrix: [] },
  costs: {
    costs: {
      transfer_cost: 1_000,
      distribution_cost: 2_000,
      storage_cost: 3_000,
      inventory_cost: 4_000,
      tax_impact: 5_000,
      total_logistics_cost: 10_000,
      total_with_tax: 15_000,
    },
  },
};
const scenario = buildScenarioFromForm({
  companyId: 'empresa1',
  baselineBundle,
  formValues: {
    scenario_name: 'Baseline sintético',
    active_cds: ['CD A', 'CD B'],
    freight_multiplier: 1,
    demand_multiplier: 1,
    inventory_days: 30,
    wacc: 0.15,
    tax_mode: 'current',
  },
});

const defaultResult = runScenario({ companyId: 'empresa1', scenario, baselineBundle });
assert.equal(defaultResult.simulation_status, 'success');
assert.equal(defaultResult.calculation_method, 'canonical_baseline_reference');
assert.equal(defaultResult.costs.total_with_tax, 15_000);
assert.equal(defaultResult.diagnostics.canonical_baseline_reference, true);

const unanchoredResult = runScenario({
  companyId: 'empresa1',
  scenario,
  baselineBundle,
  baselineMode: 'physical_unanchored',
});
assert.equal(unanchoredResult.simulation_status, 'success');
assert.equal(unanchoredResult.baseline_mode, 'physical_unanchored');
assert.notEqual(unanchoredResult.calculation_method, 'canonical_baseline_reference');
assert.notEqual(unanchoredResult.costs.total_with_tax, 15_000);
assert.equal(unanchoredResult.diagnostics.canonical_baseline_reference, false);
assert.equal(unanchoredResult.tax_results.official_fiscal_validation, false);

console.log('BASELINE_MODES_OK');
