import assert from 'node:assert/strict';
import { runSensitivity, runSensitivityMatrix } from '../../assets/js/phase5/sensitivity-engine.js';
import { usablePhase5ChartRows } from '../../assets/js/phase5/charts.js';
import { renderPhase5Dashboard } from '../../assets/js/phase5/phase5-dashboard-view.js';
import {
  buildDataQualityAssessment,
  isNumericallyUsableScenarioResult,
} from '../../assets/js/core/analysis-quality.js';

const unknownCoverage = buildDataQualityAssessment({ taxResults: { tax_mode: 'current' } });
assert.equal(unknownCoverage.status, 'limited_fiscal_coverage');
assert.equal(unknownCoverage.decision_use, 'exploratory_only');
assert.equal(unknownCoverage.coverage.complete_fiscal_coverage_ratio, null);
const nullCoverage = buildDataQualityAssessment({
  taxResults: { tax_mode: 'current', tax_coverage: { complete_fiscal_coverage_ratio: null } },
});
assert.equal(nullCoverage.coverage.complete_fiscal_coverage_ratio, null);
assert.equal(
  buildDataQualityAssessment({ scenario: { changes: { tax_mode: 'disabled' } } }).status,
  'complete'
);

for (const missing of [null, undefined, '', '  ', false]) {
  assert.equal(
    isNumericallyUsableScenarioResult({
      simulation_status: 'success',
      total_with_tax: missing,
      costs: { total_logistics_cost: 100, tax_impact: 0 },
    }),
    false
  );
}
assert.equal(
  isNumericallyUsableScenarioResult({
    simulation_status: 'success',
    total_with_tax: 100,
    costs: { total_logistics_cost: 90, tax_impact: 10 },
    errors: [{ message: 'erro' }],
  }),
  false
);

const baselineBundle = {
  model: { company_id: 'empresa1', scenario_id: 'synthetic-base', active_cds: ['CD-SYN'] },
  costs: { costs: { total_with_tax: 1000 } },
  flows: [],
};
const selectedScenario = {
  scenario_id: 'synthetic-scenario',
  scenario_name: 'Sintético',
  changes: { wacc: 0.15 },
};

const sensitivity = runSensitivity({
  companyId: 'empresa1',
  selectedScenario,
  baselineBundle,
  sensitivityConfig: { variable: 'wacc', values: [-1] },
});
const invalidSensitivity = sensitivity.sensitivity_results[0];
assert.equal(invalidSensitivity.status, 'blocked');
assert.equal(invalidSensitivity.total_with_tax, null);
assert.equal(invalidSensitivity.saving_abs, null);
assert.equal(invalidSensitivity.saving_pct, null);
assert.ok(invalidSensitivity.errors.length > 0);
assert.equal(sensitivity.sensitivity_slope, null);
assert.equal(sensitivity.most_sensitive_variable, null);
assert.equal(sensitivity.analyzed_variable, 'wacc');

const matrix = runSensitivityMatrix({
  companyId: 'empresa1',
  selectedScenario,
  baselineBundle,
  matrixConfig: {
    xVariable: 'wacc',
    yVariable: 'inventory_days',
    xValues: [-1],
    yValues: [-1],
  },
});
const invalidCell = matrix.matrix_results[0];
assert.equal(invalidCell.status, 'blocked');
assert.equal(invalidCell.total_with_tax, null);
assert.equal(invalidCell.saving_abs, null);
assert.equal(invalidCell.saving_pct, null);

const mixedRows = [
  { value: 0.8, status: 'blocked', total_with_tax: null, saving_pct: null },
  { value: 0.9, status: 'success', simulation_status: 'error', total_with_tax: 1, saving_pct: 100 },
  { value: 1, status: 'success', total_with_tax: 900, saving_pct: 4 },
];
assert.deepEqual(usablePhase5ChartRows(mixedRows), [mixedRows[2]]);

const ids = [
  'phase5CompanyLabel',
  'phase5OverviewCards',
  'finalSituationTable',
  'taxPeriodsPanel',
  'stressPanel',
  'sensitivityPanel',
  'sensitivityMatrixPanel',
  'recommendationPanel',
  'executiveReportPanel',
  'workbookParityPanel',
  'auditTrailPanel',
  'exportCenterPanel',
];
const elements = new Map(ids.map((id) => [id, { innerHTML: '', textContent: '' }]));
globalThis.document = {
  getElementById(id) {
    return elements.get(id);
  },
  querySelectorAll() {
    return [];
  },
};
const stress = {
  case_name: 'Caso sintético inválido',
  status: 'blocked',
  total_with_tax: null,
  saving_vs_baseline: null,
  saving_pct: null,
  scenario_still_better_than_baseline: null,
  data_quality_status: 'technical_error',
};
const dashboardState = {
  companyId: 'empresa1',
  bundle: { model: { scenario_id: 'base' } },
  selection: { selected_scenario: null },
  robustness: {},
  recommendation: {},
  stress: { stress_results: [stress] },
  sensitivity: { sensitivity_results: [invalidSensitivity] },
  sensitivityMatrix: {
    x_variable: 'wacc',
    y_variable: 'inventory_days',
    x_values: [-1],
    y_values: [-1],
    matrix_results: [invalidCell],
  },
  workbookParity: null,
  audit: {},
  exportPackage: { files: [] },
};
renderPhase5Dashboard(dashboardState, () => ({ saving_abs: null, saving_pct: null }), {
  renderStressChart() {},
  renderSensitivityChart() {},
  renderRobustnessChart() {},
});
assert.match(elements.get('stressPanel').innerHTML, /indisponível/);
assert.match(elements.get('stressPanel').innerHTML, /Melhor que base\?<\/th><th>Qualidade/);
assert.match(elements.get('sensitivityPanel').innerHTML, /indisponível/);
assert.match(elements.get('sensitivityMatrixPanel').innerHTML, /heatmap-unavailable/);
assert.match(elements.get('sensitivityMatrixPanel').innerHTML, /—/);
assert.doesNotMatch(elements.get('sensitivityPanel').innerHTML, /0,0%|100,0%/);
console.log('PHASE5_INVALID_SENSITIVITY_OK');
