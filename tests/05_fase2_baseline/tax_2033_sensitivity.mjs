import assert from 'node:assert/strict';
import { calculateReformTax } from '../../assets/js/core/tax/reform-tax-engine.js';
import {
  getTaxReformConfig,
  setTaxReformConfig,
  DEFAULT_TAX_REFORM_CONFIG,
} from '../../assets/js/core/tax-reform-config.js';
import { runTax2033Sensitivity } from '../../scripts/audit/tax_2033_sensitivity.mjs';

setTaxReformConfig(DEFAULT_TAX_REFORM_CONFIG);
const before = structuredClone(getTaxReformConfig());
const scenario = (id, revenue) => ({
  scenario_id: id,
  changes: { tax_year: 2033, tax_regime: 'reform_full_2033', revenue },
});
const execute = (item) => {
  const tax = calculateReformTax({
    fiscalFlows: [{ gross_revenue: item.changes.revenue, fiscal_category: 'default_goods' }],
    regimeDefinition: getTaxReformConfig().regimes.reform_full_2033,
  });
  return {
    simulation_status: 'success',
    costs: {
      total_logistics_cost: 100,
      tax_impact: tax.total_reform_tax,
      tax_details: { ...tax, total_tax_impact: tax.total_reform_tax, total_current_tax: 0 },
    },
    total_with_tax: 100 + tax.total_reform_tax,
  };
};
const rows = runTax2033Sensitivity({
  baselineScenario: scenario('baseline', 1000),
  candidateScenario: scenario('candidate', 800),
  run: execute,
});
assert.equal(rows.length, 4);
assert.deepEqual(getTaxReformConfig(), before);
const current = rows.find(
  (r) => r.assumption === 'configured_selective_tax' && r.scenario === 'baseline'
);
const noIS = rows.find((r) => r.assumption === 'no_selective_tax' && r.scenario === 'baseline');
assert(current.selective_tax_brl > 0);
assert.equal(noIS.selective_tax_brl, 0);
assert.equal(current.cbs_brl, noIS.cbs_brl);
assert.equal(current.ibs_brl, noIS.ibs_brl);
assert.equal(current.credits_brl, noIS.credits_brl);
assert(Math.abs(current.tax_impact_brl - noIS.tax_impact_brl - current.selective_tax_brl) < 1e-9);
assert.throws(
  () =>
    runTax2033Sensitivity({
      baselineScenario: scenario('base', 1000),
      candidateScenario: { changes: { tax_year: 2025, tax_regime: 'current' } },
      run: execute,
    }),
  /2033/
);
assert.throws(
  () =>
    runTax2033Sensitivity({
      baselineScenario: scenario('base', 1000),
      candidateScenario: scenario('candidate', 800),
      run: () => {
        throw new Error('failed');
      },
    }),
  /failed/
);
assert.deepEqual(getTaxReformConfig(), before);
const invalid = runTax2033Sensitivity({
  baselineScenario: scenario('base', 1000),
  candidateScenario: scenario('candidate', 800),
  run: (item) =>
    item.scenario_id === 'candidate'
      ? { simulation_status: 'invalid', costs: { tax_impact: 12345 }, total_with_tax: 12345 }
      : execute(item),
});
assert(
  invalid
    .filter((r) => r.scenario === 'candidate')
    .every((r) => r.tax_impact_brl === null && r.total_with_tax_brl === null)
);
assert(
  invalid
    .filter((r) => r.scenario === 'baseline')
    .every((r) => r.tax_impact_brl === null && r.total_with_tax_brl === null)
);
const emptyValues = runTax2033Sensitivity({
  baselineScenario: scenario('base', 1000),
  candidateScenario: scenario('candidate', 800),
  run: () => ({
    simulation_status: 'success',
    costs: { total_logistics_cost: '', tax_impact: ' ', tax_details: { cbs_total: '' } },
    total_with_tax: '',
  }),
});
assert(
  emptyValues.every(
    (r) =>
      r.logistics_brl === null &&
      r.cbs_brl === null &&
      r.tax_impact_brl === null &&
      r.total_with_tax_brl === null
  )
);
console.log('TAX_2033_SENSITIVITY_OK');
