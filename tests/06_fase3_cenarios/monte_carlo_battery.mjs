import assert from 'node:assert/strict';
import {
  monteCarloBatterySettings,
  runMonteCarloBattery,
} from '../../scripts/audit/monte_carlo_battery.mjs';
const settings = monteCarloBatterySettings();
assert.equal(settings.length, 18);
assert.deepEqual([...new Set(settings.map((x) => x.seed))], [42, 43, 44]);
assert.deepEqual([...new Set(settings.map((x) => x.iterations))], [300, 1000]);
assert.equal(monteCarloBatterySettings({ include5000: true }).length, 27);
const calls = [];
const data = runMonteCarloBattery({
  companyId: 'synthetic',
  baselineBundle: {},
  scenarios: [
    {
      key: 'single_cd_es_2033',
      scenario: {
        changes: { tax_year: 2033, tax_mode: 'reform_full_2033', tax_regime: 'reform_full_2033' },
      },
    },
    { key: 'blocked', scenario: null },
  ],
  runner: (args) => {
    calls.push(args);
    return {
      monte_carlo_status: 'success',
      pairing: {
        method: 'common_random_numbers_v1',
        status: 'paired',
        baseline_mode: 'physical_unanchored',
      },
      summary: {
        iterations_valid: args.iterations,
        seed_effective: 101,
        rng_algorithm: 'mulberry32-v1',
        mean_delta_cost_brl: -3,
        uncertainty_source: 'parametric_assumptions',
      },
      data_quality_status: 'limited_fiscal_coverage',
    };
  },
});
assert.equal(calls.length, 18);
assert.equal(data.length, 19);
assert.ok(
  data
    .slice(0, 18)
    .every(
      (x) =>
        x.source_class === 'PARAMETRIC_EXPLORATORY' &&
        x.pairing.baseline_mode === 'physical_unanchored'
    )
);
assert.equal(data[18].status, 'BLOCKED_SOURCE');
assert.equal(data[0].tax_year, 2033);
assert.equal(data[0].tax_mode, 'reform_full_2033');
assert.equal(data[0].tax_regime, 'reform_full_2033');
assert.equal(data[0].summary.rng_algorithm, 'mulberry32-v1');
assert.equal(data[0].summary.mean_delta_cost_brl, -3);
assert.equal(data[0].data_quality_status, 'limited_fiscal_coverage');
console.log('MONTE_CARLO_BATTERY_OK');
