import assert from 'node:assert/strict';
import { calculatePhysicalCosts } from '../../assets/js/phase3/physical-cost-engine.js';

const base = {
  costs: {
    costs: { distribution_cost: 100, transfer_cost: 0, storage_cost: 50, inventory_cost: 10 },
  },
  model: { active_cds: ['CD A'] },
  core_data: {},
};
const scenario = { changes: { active_cds: ['CD A'], freight_multiplier: 1, demand_multiplier: 1 } };

const e1 = calculatePhysicalCosts({
  companyId: 'empresa1',
  scenario,
  baselineBundle: base,
  rebuilt: {
    flows: [
      { flow_id: 'f1', annual_weight_kg: 1, annual_revenue: 10 },
      { flow_id: 'f1b', annual_weight_kg: 2, annual_revenue: 20 },
    ],
  },
});
assert.equal(e1.diagnostics.fallback_counts.proportional_storage, 1);
assert.equal(e1.diagnostics.fallback_rates.proportional_storage, 1);
assert.equal(e1.diagnostics.flow_count, 2, 'storage fallback must not inflate flow denominator');

const e2Fallback = calculatePhysicalCosts({
  companyId: 'empresa2',
  scenario,
  baselineBundle: base,
  rebuilt: { flows: [{ flow_id: 'f2', annual_weight_kg: 1, annual_revenue: 10 }] },
});
assert.equal(e2Fallback.diagnostics.fallback_counts.proportional_storage, 1);
assert.equal(e2Fallback.diagnostics.fallback_rates.proportional_storage, 1);
assert.equal(e2Fallback.diagnostics.flow_count, 1);

const e2Observed = calculatePhysicalCosts({
  companyId: 'empresa2',
  scenario,
  baselineBundle: {
    ...base,
    core_data: {
      tabelas_cif_dist: [{ 'Peso Inicial': 0, 'Peso Final': 10, 'CIF (R$/Kg)': 2 }],
      aux_custo_armazenagem: [{ Filial: 'CD A', Custo: 5 }],
    },
  },
  rebuilt: { flows: [{ flow_id: 'f3', annual_weight_kg: 1, annual_revenue: 10 }] },
});
assert.equal(e2Observed.diagnostics.fallback_counts.proportional_storage, 0);
assert.equal(e2Observed.diagnostics.fallback_rates.proportional_storage, 0);
assert.equal(e2Observed.diagnostics.flow_count, 1);
console.log('PHYSICAL_STORAGE_FALLBACK_DIAGNOSTICS_OK');
