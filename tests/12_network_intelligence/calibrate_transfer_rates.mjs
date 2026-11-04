import assert from 'node:assert/strict';
import { calibrateTransferRates } from '../../scripts/calibrate_transfer_rates.mjs';

const result = calibrateTransferRates({
  source: '  ERP sintético  ',
  period: '  2026-Q1  ',
  rows: [
    { destination_uf: 'sp', freight_brl: 100, weight_kg: 10, distance_km: 10 },
    { destination_uf: 'SP', freight_brl: 300, weight_kg: 20, distance_km: 5 },
    { destination_uf: 'mg', freight_brl: 60, weight_kg: 10, distance_km: 10 },
    { destination_uf: 'PR', freight_brl: 30, weight_kg: 5, distance_km: 3 },
    null,
    { destination_uf: 'S', freight_brl: 10, weight_kg: 1, distance_km: 1 },
    { destination_uf: 'SP1', freight_brl: 10, weight_kg: 1, distance_km: 1 },
    { destination_uf: 'SP', freight_brl: 'not-a-number', weight_kg: 5, distance_km: 5 },
    { destination_uf: 'SP', freight_brl: 5, weight_kg: -1, distance_km: 5 },
    { destination_uf: 'SP', freight_brl: 5, weight_kg: 1, distance_km: null },
    { destination_uf: 'SP', freight_brl: 0, weight_kg: 1, distance_km: 1 },
    { destination_uf: 'SP', freight_brl: 5, weight_kg: 1, distance_km: 'Infinity' },
  ],
});

assert.equal(result.source, 'ERP sintético');
assert.equal(result.period, '2026-Q1');
assert.equal(result.method, 'sum_freight_brl_divided_by_sum_weight_kg_times_distance_km');
assert.equal(result.unit, 'BRL_per_kg_km');
assert.equal(result.input_row_count, 12);
assert.equal(result.rows_used, 4);
assert.deepEqual(result.rows_excluded, {
  invalid_uf: 3,
  nonpositive_or_missing_input: 5,
});
assert.deepEqual(Object.keys(result.rates_by_destination_uf), ['MG', 'PR', 'SP']);
assert.equal(result.rates_by_destination_uf.MG.rate_brl_per_kg_km, 0.6);
assert.equal(result.rates_by_destination_uf.PR.rate_brl_per_kg_km, 2);
assert.equal(result.rates_by_destination_uf.SP.rows_used, 2);
assert.equal(result.rates_by_destination_uf.SP.freight_brl_sum, 400);
assert.equal(result.rates_by_destination_uf.SP.weight_distance_kg_km_sum, 200);
assert.equal(result.rates_by_destination_uf.SP.rate_brl_per_kg_km, 2);
assert.match(result.warning, /revise filtros fiscais, período e origem\/distância/);

assert.throws(
  () => calibrateTransferRates({ rows: {}, source: 'synthetic', period: '2026' }),
  /rows/
);
assert.throws(
  () => calibrateTransferRates({ rows: [], source: '', period: '2026' }),
  /source e period/
);
assert.throws(
  () => calibrateTransferRates({ rows: [], source: 'synthetic', period: '  ' }),
  /source e period/
);

console.log('CALIBRATE_TRANSFER_RATES_OK');
