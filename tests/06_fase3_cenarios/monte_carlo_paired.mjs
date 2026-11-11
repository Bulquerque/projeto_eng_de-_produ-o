import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildScenarioFromForm } from '../../assets/js/phase3/scenario-builder.js';
import {
  runMonteCarloSimulation,
  summarizeMonteCarloPrefix,
} from '../../assets/js/phase3/monte-carlo-engine.js';
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
const longRun = runMonteCarloSimulation({ ...options, iterations: 100 });
const prefix = summarizeMonteCarloPrefix(longRun, 50);
assert.deepEqual(
  prefix.samples,
  first.samples,
  'same seed prefix must equal a standalone 50-iteration run'
);
assert.equal(prefix.summary.iterations_valid, first.summary.iterations_valid);
assert.equal(prefix.summary.probability_saving_positive, first.summary.probability_saving_positive);
assert.equal(prefix.summary.p50_delta_cost, first.summary.p50_delta_cost);

assert.equal(first.monte_carlo_status, 'success');
assert.ok(first.samples.length > 0);
assert.deepEqual(
  first.samples,
  replay.samples,
  'same seed must reproduce paired draws and results'
);
const identicalDifferentId = runMonteCarloSimulation({
  ...options,
  selectedScenario: { ...scenario, scenario_id: 'identical_network_other_id' },
  deterministicResult: null,
});
assert.deepEqual(
  first.samples.map(({ inputs, saving_abs }) => ({ inputs, saving_abs })),
  identicalDifferentId.samples.map(({ inputs, saving_abs }) => ({ inputs, saving_abs })),
  'changing only scenario ID or execution order must not change draws or deltas'
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
assert.equal(first.pairing?.baseline_mode, 'physical_unanchored');
assert.ok(first.samples.every((sample) => sample.baseline_mode === 'physical_unanchored'));
assert.ok(
  first.samples.every((sample) => sample.candidate_baseline_mode === 'physical_unanchored')
);
assert.equal(first.deterministic_reference.baseline_mode, 'physical_unanchored');
assert.equal(first.summary.probability_tie, 1);
assert.equal(first.summary.p10_delta_cost, 0);
assert.equal(first.summary.p90_delta_cost, 0);
assert.equal(first.summary.mean_delta_cost_brl, 0);
assert.equal(prefix.summary.mean_delta_cost_brl, first.summary.mean_delta_cost_brl);
for (const sample of first.samples.slice(0, 3)) {
  const independentlyShocked = {
    ...scenario,
    changes: { ...scenario.changes, ...sample.inputs },
  };
  const recalculated = runScenario({
    companyId,
    scenario: independentlyShocked,
    baselineBundle,
    baselineMode: 'physical_unanchored',
  });
  const independentlyTotal =
    recalculated.costs.total_logistics_cost +
    Math.max(0, recalculated.costs.tax_impact * sample.tax_multiplier);
  assert.ok(Math.abs(independentlyTotal - sample.baseline_total_with_tax) < 1e-7);
}

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
  Math.abs(
    changed.summary.mean_delta_cost_brl -
      changed.samples.reduce((sum, x) => sum + x.total_with_tax - x.baseline_total_with_tax, 0) /
        changed.samples.length
  ) < 1e-7
);
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
