import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calculateInventoryCost,
  getCompanyModelDefaults,
  normalizeScenarioModelDefaults,
} from '../../assets/js/core/model-configuration.js';
import { buildScenarioFromForm } from '../../assets/js/phase3/scenario-builder.js';
import { runScenario } from '../../assets/js/phase3/scenario-simulator.js';
import { runMonteCarloSimulation } from '../../assets/js/phase3/monte-carlo-engine.js';

const bundle = JSON.parse(
  readFileSync(new URL('../../data-demo/empresa_mock/baseline.json', import.meta.url), 'utf8')
);
bundle.model.company_id = 'empresa1';
bundle.costs.assumptions_used = { wacc: 0.23 };
const defaults = getCompanyModelDefaults('empresa1', bundle);
assert.equal(defaults.reference_wacc, 0.23);
assert.equal(defaults.wacc_source, 'bundle_assumptions_used');

const defaultScenario = buildScenarioFromForm({
  companyId: 'empresa1',
  baselineBundle: bundle,
  formValues: { active_cds: bundle.model.active_cds },
});
assert.equal(defaultScenario.changes.wacc, 0.23);
const explicitScenario = buildScenarioFromForm({
  companyId: 'empresa1',
  baselineBundle: bundle,
  formValues: { active_cds: bundle.model.active_cds, wacc: 0.17 },
});
assert.equal(explicitScenario.changes.wacc, 0.17);
assert.equal(
  calculateInventoryCost({
    companyId: 'empresa1',
    baselineBundle: bundle,
    baseInventoryCost: 1200,
  }),
  1200
);

const normalized = normalizeScenarioModelDefaults(
  'empresa1',
  {
    scenario_id: 'manual',
    changes: { inventory_days: 30 },
  },
  bundle
);
assert.equal(normalized.changes.wacc, 0.23);
const preserved = normalizeScenarioModelDefaults(
  'empresa1',
  {
    scenario_id: 'manual',
    changes: { inventory_days: 30, wacc: 0.18 },
  },
  bundle
);
assert.equal(preserved.changes.wacc, 0.18);
const migratedFixture = normalizeScenarioModelDefaults(
  'empresa1',
  {
    scenario_id: 'empresa1_sample_frete_mais_10',
    changes: { inventory_days: 45, wacc: 0.15 },
  },
  bundle
);
assert.equal(migratedFixture.changes.wacc, 0.23);
const explicitlyTaggedFixture = normalizeScenarioModelDefaults(
  'empresa1',
  {
    scenario_id: 'empresa1_sample_frete_mais_10',
    changes: { inventory_days: 45, wacc: 0.15 },
    metadata: { wacc_explicit: true },
  },
  bundle
);
assert.equal(explicitlyTaggedFixture.changes.wacc, 0.15);
const userScenarioAtOldDefault = normalizeScenarioModelDefaults(
  'empresa1',
  { scenario_id: 'manual_custom_scenario', changes: { inventory_days: 30, wacc: 0.15 } },
  bundle
);
assert.equal(userScenarioAtOldDefault.changes.wacc, 0.15);
const missingWaccScenario = buildScenarioFromForm({
  companyId: 'empresa1',
  baselineBundle: bundle,
  formValues: { active_cds: bundle.model.active_cds },
});
delete missingWaccScenario.changes.wacc;
const simulated = runScenario({
  companyId: 'empresa1',
  scenario: missingWaccScenario,
  baselineBundle: bundle,
  baselineMode: 'physical_unanchored',
});
assert.equal(simulated.scenario.changes.wacc, 0.23);
const mc = runMonteCarloSimulation({
  companyId: 'empresa1',
  selectedScenario: simulated.scenario,
  baselineBundle: bundle,
  deterministicResult: simulated,
  iterations: 5,
  seed: 81,
});
assert.equal(mc.monte_carlo_status, 'success');
assert.ok(mc.samples[0].baseline_inputs.wacc > 0.2);
assert.ok(mc.samples[0].baseline_inputs.wacc < 0.26);

for (const malformed of [undefined, '23%', 23, 0, -0.1, 1.01]) {
  const invalidBundle = { costs: { assumptions_used: { wacc: malformed } } };
  const fallback = getCompanyModelDefaults('empresa1', invalidBundle);
  assert.equal(fallback.reference_wacc, 0.15);
  assert.equal(fallback.wacc_source, 'fallback_exploratory_default');
}
assert.equal(getCompanyModelDefaults('empresa2', bundle).reference_wacc, 0.12);
const zeroChoice = buildScenarioFromForm({
  companyId: 'empresa1',
  baselineBundle: bundle,
  formValues: { active_cds: ['CD A'], wacc: 0 },
});
assert.equal(zeroChoice.changes.wacc, 0);
console.log('WACC_FROM_BUNDLE_OK');
