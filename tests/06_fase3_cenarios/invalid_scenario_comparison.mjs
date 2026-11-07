import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareScenarios, componentDelta } from '../../assets/js/phase3/scenario-comparator.js';
import { evaluateScenarioQuality } from '../../assets/js/phase3/scenario-quality-check.js';
import { buildLibraryComparisonRows } from '../../assets/js/phase3/scenario-arena/library-comparison.js';
import { buildScenarioFromForm } from '../../assets/js/phase3/scenario-builder.js';

const bundle = {
  model: { company_id: 'empresa1', active_cds: ['A'] },
  costs: { costs: { total_with_tax: 100 } },
};
const failed = {
  scenario_id: 'failed',
  company_id: 'empresa1',
  simulation_status: 'error',
  total_with_tax: 0,
  costs: { total_with_tax: 0 },
  errors: [{ message: 'Fluxo descoberto' }],
  flows: [],
};
const invalid = {
  ...failed,
  scenario_id: 'invalid',
  simulation_status: 'invalid',
  total_with_tax: null,
};
const comparison = compareScenarios({
  companyId: 'empresa1',
  baselineBundle: bundle,
  scenarioResults: [failed, invalid],
});
assert.deepEqual(
  comparison.comparison.map((row) => row.scenario_id),
  ['baseline']
);
assert.equal(comparison.best_by_total_cost, 'baseline');
assert.equal(comparison.warnings.length, 2);
assert.equal(componentDelta(bundle, failed), null);
const invalidBaseline = compareScenarios({
  companyId: 'empresa1',
  baselineBundle: bundle,
  baselineResult: invalid,
  scenarioResults: [],
});
assert.equal(invalidBaseline.best_by_total_cost, null);
assert.deepEqual(invalidBaseline.comparison, []);
assert.equal(invalidBaseline.errors.length, 1);
assert.throws(
  () =>
    compareScenarios({
      companyId: 'empresa1',
      baselineBundle: bundle,
      scenarioResults: [{ ...failed, company_id: 'empresa2' }],
    }),
  /empresas diferentes/
);
const libraryRows = buildLibraryComparisonRows({
  companyId: 'empresa1',
  library: { baselineBundle: bundle, scenarios: [] },
  currentResult: failed,
});
assert.deepEqual(
  libraryRows.map((row) => row.scenario_id),
  ['baseline']
);
const demoBundle = JSON.parse(
  readFileSync(new URL('../../data-demo/empresa_mock/baseline.json', import.meta.url))
);
const validScenarios = Array.from({ length: 9 }, (_, index) =>
  buildScenarioFromForm({
    companyId: 'empresa_mock',
    baselineBundle: demoBundle,
    formValues: {
      scenario_name: `Válido ${index}`,
      active_cds: demoBundle.model.active_cds,
      tax_mode: 'disabled',
    },
  })
);
const populatedRows = buildLibraryComparisonRows({
  companyId: 'empresa_mock',
  library: {
    baselineBundle: demoBundle,
    scenarios: [{ scenario_id: 'invalid' }, ...validScenarios],
  },
});
assert.equal(populatedRows.length, 9, 'baseline and eight valid scenarios must be shown');
assert.equal(populatedRows.at(-1).scenario_name, 'Válido 7');
for (const result of [failed, invalid]) {
  const quality = evaluateScenarioQuality({ scenarioResult: result, baselineBundle: bundle });
  assert.equal(quality.quality_score, null);
  assert.equal(quality.risk_level, null);
}
console.log('INVALID_SCENARIO_COMPARISON_OK');
