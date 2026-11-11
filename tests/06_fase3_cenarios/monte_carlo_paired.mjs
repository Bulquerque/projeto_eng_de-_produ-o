import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildScenarioFromForm } from '../../assets/js/phase3/scenario-builder.js';
import { runMonteCarloSimulation } from '../../assets/js/phase3/monte-carlo-engine.js';
import { runScenario } from '../../assets/js/phase3/scenario-simulator.js';

const baselineBundle = JSON.parse(
  readFileSync(new URL('../../data-demo/empresa_mock/baseline.json', import.meta.url), 'utf8')
);
const companyId = 'empresa_mock';
const scenario = buildScenarioFromForm({
  companyId,
  baselineBundle,
  formValues: {
    scenario_name: 'Baseline para teste pareado',
    active_cds: baselineBundle.model.active_cds,
    freight_multiplier: 1,
    demand_multiplier: 1,
    inventory_days: 45,
    wacc: 0.15,
    tax_mode: 'current',
  },
  scenarioId: baselineBundle.model.scenario_id,
});
const deterministic = runScenario({ companyId, scenario, baselineBundle });
assert.equal(deterministic.simulation_status, 'success');

const options = {
  companyId,
  selectedScenario: scenario,
  baselineBundle,
  deterministicResult: deterministic,
  iterations: 50,
  seed: 1205,
};
const first = runMonteCarloSimulation(options);
const replay = runMonteCarloSimulation(options);

assert.equal(first.monte_carlo_status, 'success');
assert.ok(first.samples.length > 0);
assert.deepEqual(
  first.samples,
  replay.samples,
  'same seed must reproduce paired draws and results'
);
assert.ok(
  first.samples.every(
    (sample) => Math.abs(sample.saving_abs) < 1e-8 && Math.abs(sample.saving_pct) < 1e-10
  ),
  'a baseline scenario paired against itself must have zero saving in every iteration'
);
assert.ok(
  first.samples.every((sample) => sample.baseline_total_with_tax === sample.total_with_tax),
  'each self-paired observation must use equal scenario and baseline totals'
);
assert.equal(first.pairing?.method, 'common_random_numbers_v1');
assert.equal(first.pairing?.status, 'paired');

const changedScenario = buildScenarioFromForm({
  companyId,
  baselineBundle,
  formValues: {
    scenario_name: 'Frete e estoque alterados',
    active_cds: baselineBundle.model.active_cds,
    freight_multiplier: 1.2,
    demand_multiplier: 1,
    inventory_days: 60,
    wacc: 0.15,
    tax_mode: 'disabled',
  },
  scenarioId: 'paired_changed_disabled',
});
const changedResult = runScenario({ companyId, scenario: changedScenario, baselineBundle });
const changed = runMonteCarloSimulation({
  ...options,
  selectedScenario: changedScenario,
  deterministicResult: changedResult,
});
assert.equal(changed.pairing?.status, 'paired');
assert.ok(
  changed.samples.every(
    (sample) =>
      Math.abs(sample.inputs.freight_multiplier / sample.baseline_inputs.freight_multiplier - 1.2) <
      1e-10
  ),
  'relative freight shocks must preserve the candidate-to-baseline level ratio'
);
assert.ok(
  changed.samples.every(
    (sample) => sample.inputs.inventory_days - sample.baseline_inputs.inventory_days === 15
  ),
  'additive inventory shocks must preserve the 15-day candidate-to-baseline difference'
);
assert.ok(
  changed.samples.every((sample) => sample.saving_abs < 0),
  'the paired calculation must preserve the higher-cost freight and inventory scenario'
);
assert.ok(
  changed.samples.every((sample) => sample.baseline_tax_mode === 'disabled'),
  'the paired baseline must retain tax_disabled mode'
);

const reform2033Scenario = {
  ...changedScenario,
  scenario_id: 'paired_reform_2033',
  changes: {
    ...changedScenario.changes,
    tax_mode: 'reform_full_2033',
    tax_regime: 'reform_full_2033',
    tax_year: 2033,
  },
};
const reform2033Result = runScenario({
  companyId,
  scenario: reform2033Scenario,
  baselineBundle,
});
const reform2033 = runMonteCarloSimulation({
  ...options,
  selectedScenario: reform2033Scenario,
  deterministicResult: reform2033Result,
});
assert.ok(
  reform2033.samples.every(
    (sample) =>
      sample.baseline_tax_regime === 'reform_full_2033' && sample.baseline_tax_year === 2033
  ),
  'the paired baseline must retain the selected 2033 tax regime and year'
);
console.log('MONTE_CARLO_PAIRED_OK');
