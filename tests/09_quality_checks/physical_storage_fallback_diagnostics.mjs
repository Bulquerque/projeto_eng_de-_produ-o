import assert from 'node:assert/strict';
import { calculatePhysicalCosts } from '../../assets/js/phase3/physical-cost-engine.js';
import { buildEvidenceReport } from '../../assets/js/core/evidence-quality-engine.js';

const base = {
  costs: {
    costs: { distribution_cost: 100, transfer_cost: 0, storage_cost: 50, inventory_cost: 10 },
  },
  model: { active_cds: ['CD A'] },
  core_data: {
    distance_matrix: [
      {
        ORIGEM: 'SP',
        DESTINO: 'RJ',
        UF_ORIGEM: 'SP',
        UF_DESTINO: 'RJ',
        'Frete (R$/Kg)': 2,
        'Distancia(KM)': 50,
      },
    ],
  },
};
const scenario = { changes: { active_cds: ['CD A'], freight_multiplier: 1, demand_multiplier: 1 } };

const e1 = calculatePhysicalCosts({
  companyId: 'empresa1',
  scenario,
  baselineBundle: base,
  rebuilt: {
    flows: [
      {
        flow_id: 'f1',
        cd_uf: 'SP',
        assigned_cd_uf: 'SP',
        destination_uf: 'RJ',
        annual_weight_kg: 1,
        annual_revenue: 10,
      },
      {
        flow_id: 'f1b',
        cd_uf: 'SP',
        assigned_cd_uf: 'SP',
        destination_uf: 'RJ',
        annual_weight_kg: 2,
        annual_revenue: 20,
      },
    ],
  },
});
assert.equal(e1.diagnostics.fallback_counts.proportional_storage, 1);
assert.equal(e1.diagnostics.fallback_rates.proportional_storage, undefined);
assert.equal(e1.diagnostics.fallback_event_counts.proportional_storage, 1);
assert.equal(e1.diagnostics.flow_count, 2, 'storage fallback must not inflate flow denominator');
assert.equal(e1.diagnostics.fallback_denominators.distribution, 2);
assert.equal(e1.diagnostics.fallback_denominators.transfer, 2);
assert.equal(e1.diagnostics.fallback_rates.transfer_fallback, 0);
const e1Evidence = buildEvidenceReport({
  companyId: 'empresa1',
  baselineBundle: { model: { company_id: 'empresa1', active_cds: ['CD A'] }, base_fit: {} },
  scenarioResult: { scenario_id: 'e1', costs: { diagnostics: e1.diagnostics } },
  taxResults: { tax_coverage: {} },
});
assert.equal(
  e1Evidence.components.find((component) => component.id === 'distribution').classification,
  'partially_observed',
  'storage fallback is scenario-level and must not classify every distribution flow as fallback'
);
assert.ok(e1Evidence.blockers.some((item) => /armazenagem.*hipótese proporcional/i.test(item)));

const e2Fallback = calculatePhysicalCosts({
  companyId: 'empresa2',
  scenario,
  baselineBundle: base,
  rebuilt: { flows: [{ flow_id: 'f2', annual_weight_kg: 1, annual_revenue: 10 }] },
});
assert.equal(e2Fallback.diagnostics.fallback_counts.proportional_storage, 1);
assert.equal(e2Fallback.diagnostics.fallback_rates.proportional_storage, undefined);
assert.equal(e2Fallback.diagnostics.fallback_event_counts.proportional_storage, 1);
assert.equal(e2Fallback.diagnostics.flow_count, 1);
const e2NoTransferEvidence = buildEvidenceReport({
  companyId: 'empresa2',
  baselineBundle: { model: { company_id: 'empresa2', active_cds: ['CD A'] }, base_fit: {} },
  scenarioResult: { scenario_id: 'e2-no-transfer', costs: { diagnostics: e2Fallback.diagnostics } },
  taxResults: { tax_coverage: {} },
});
const e2NoTransferComponent = e2NoTransferEvidence.components.find(
  (component) => component.id === 'transfer'
);
assert.equal(e2NoTransferComponent.classification, 'unknown');
assert.equal(e2NoTransferComponent.coverage, 0);

const e2DisjointFallbacks = calculatePhysicalCosts({
  companyId: 'empresa2',
  scenario,
  baselineBundle: base,
  rebuilt: {
    flows: [
      { flow_id: 'missing-cif-without-revenue', annual_weight_kg: 1 },
      { flow_id: 'revenue-fallback', annual_weight_kg: 1, annual_revenue: 100 },
    ],
  },
});
assert.equal(e2DisjointFallbacks.diagnostics.fallback_rates.missing_cif_row, 0.5);
assert.equal(e2DisjointFallbacks.diagnostics.fallback_rates.revenue_fallback, 0.5);
assert.equal(e2DisjointFallbacks.diagnostics.distribution_unpriced_or_fallback_flow_count, 2);
assert.equal(e2DisjointFallbacks.diagnostics.distribution_unpriced_or_fallback_rate, 1);
const e2DisjointEvidence = buildEvidenceReport({
  companyId: 'empresa2',
  baselineBundle: { model: { company_id: 'empresa2', active_cds: ['CD A'] }, base_fit: {} },
  scenarioResult: {
    scenario_id: 'e2-disjoint-fallbacks',
    costs: { diagnostics: e2DisjointFallbacks.diagnostics },
  },
  taxResults: { tax_coverage: {} },
});
assert.equal(
  e2DisjointEvidence.components.find((component) => component.id === 'distribution').classification,
  'fallback'
);

const e2Mixed = calculatePhysicalCosts({
  companyId: 'empresa2',
  scenario,
  baselineBundle: base,
  rebuilt: {
    flows: [
      { flow_id: 'observed', annual_weight_kg: 1, annual_revenue: 10 },
      {
        flow_id: 'missing-weight-reallocated',
        annual_revenue: 100,
        reallocation_status: 'reallocated',
        previous_cd_uf: 'SP',
        destination_uf: 'RJ',
      },
      {
        flow_id: 'factory-to-cd',
        flow_type: 'factory_to_cd',
        volume: 10,
        annual_revenue: 20,
      },
    ],
  },
});
assert.equal(e2Mixed.diagnostics.flow_count, 3);
assert.equal(e2Mixed.diagnostics.distribution_eligible_flow_count, 2);
assert.equal(e2Mixed.diagnostics.fallback_counts.missing_weight, 1);
assert.equal(e2Mixed.diagnostics.fallback_denominators.distribution, 2);
assert.equal(e2Mixed.diagnostics.fallback_rates.missing_weight, 0.5);
assert.equal(e2Mixed.diagnostics.fallback_denominators.transfer, 1);
assert.equal(e2Mixed.diagnostics.fallback_rates.transfer_fallback, 1);

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
assert.equal(e2Observed.diagnostics.fallback_event_counts.proportional_storage, 0);
assert.equal(e2Observed.diagnostics.fallback_rates.proportional_storage, undefined);
assert.equal(e2Observed.diagnostics.flow_count, 1);
console.log('PHYSICAL_STORAGE_FALLBACK_DIAGNOSTICS_OK');
