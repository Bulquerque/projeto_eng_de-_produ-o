import assert from 'node:assert/strict';
import { rebuildScenarioFlows } from '../../assets/js/phase3/scenario-flow-rebuilder.js';
import { runScenario } from '../../assets/js/phase3/scenario-simulator.js';
import { validateScenario } from '../../assets/js/phase3/scenario-validator.js';
import { buildScenarioFromForm } from '../../assets/js/phase3/scenario-builder.js';
import { generateCandidateScenarios } from '../../assets/js/phase4/candidate-scenario-generator.js';

const baselineBundle = {
  model: { scenario_id: 'base', active_cds: ['CD A', 'CD B'] },
};
const scenario = {
  scenario_id: 'lowest-freight',
  scenario_name: 'Menor frete por kg',
  company_id: 'empresa1',
  base_scenario_id: 'base',
  changes: {
    active_cds: ['CD A', 'CD B'],
    closed_cds: ['CD fechado'],
    freight_multiplier: 1,
    demand_multiplier: 1,
    inventory_days: 30,
    wacc: 0.15,
    tax_mode: 'current',
    reallocation_rule: 'lowest_freight_available_cd',
  },
};
const baselineFlows = [
  {
    flow_id: 'flow-1',
    flow_type: 'cd_to_destination',
    cd: 'CD fechado',
    centroid: 'Cidade X',
    destination_uf: 'SP',
    annual_weight_kg: 100,
  },
];
const distanceMatrix = [
  {
    DESTINO: 'Cidade X',
    UF_DESTINO: 'SP',
    ORIGEM: 'CD A',
    UF_ORIGEM: 'SP',
    'Distancia(KM)': 20,
    'Frete (R$/Kg)': 3.2,
  },
  {
    DESTINO: 'Cidade X',
    UF_DESTINO: 'SP',
    ORIGEM: 'CD B',
    UF_ORIGEM: 'RJ',
    'Distancia(KM)': 80,
    'Frete (R$/Kg)': 2.1,
  },
];

const validation = validateScenario({ companyId: 'empresa1', scenario, baselineBundle });
assert.equal(validation.valid, true, 'the validator must accept the lower-freight rule');

const rebuilt = rebuildScenarioFlows({ scenario, baselineFlows, distanceMatrix });
assert.equal(rebuilt.flows[0].assigned_cd, 'CD B');
assert.equal(rebuilt.flows[0].reallocation_rule, 'lowest_freight_available_cd');
assert.equal(rebuilt.flow_summary.reallocated_flows, 1);

const ufOnly = rebuildScenarioFlows({
  scenario,
  baselineFlows,
  distanceMatrix: distanceMatrix.map(({ DESTINO: _destination, ...row }) => row),
});
assert.equal(ufOnly.flows[0].assigned_cd, 'CD B');
const cityPriority = rebuildScenarioFlows({
  scenario,
  baselineFlows,
  distanceMatrix: [...distanceMatrix, { UF_DESTINO: 'SP', ORIGEM: 'CD A', 'Frete (R$/Kg)': 0.01 }],
});
assert.equal(cityPriority.flows[0].assigned_cd, 'CD B');
const otherCity = rebuildScenarioFlows({
  scenario,
  baselineFlows,
  distanceMatrix: distanceMatrix.map((row) => ({ ...row, DESTINO: 'Outra cidade' })),
});
assert.equal(otherCity.flows[0].reallocation_status, 'uncovered');

const sameState = rebuildScenarioFlows({
  scenario: {
    ...scenario,
    changes: { ...scenario.changes, active_cds: ['SP / CD A', 'RJ / CD B'], closed_cds: [] },
  },
  baselineFlows: [{ ...baselineFlows[0], cd: 'SP / CD fechado', cd_uf: 'SP' }],
  distanceMatrix,
});
assert.equal(sameState.flows[0].assigned_cd, 'RJ / CD B');
assert.equal(sameState.flow_summary.reallocated_flows, 1);

const integrated = runScenario({
  companyId: 'empresa1',
  scenario: { ...scenario, changes: { ...scenario.changes, tax_mode: 'disabled' } },
  baselineBundle: {
    ...baselineBundle,
    core_data: { distance_matrix: distanceMatrix },
    flows: baselineFlows,
    costs: {
      costs: {
        transfer_cost: 0,
        distribution_cost: 0,
        storage_cost: 0,
        inventory_cost: 0,
        total_with_tax: 0,
      },
    },
  },
});
assert.equal(integrated.simulation_status, 'success');
assert.equal(integrated.flows[0].assigned_cd, 'CD B');
assert.equal(integrated.flows[0].reallocation_rule, 'lowest_freight_available_cd');

const withoutFreight = rebuildScenarioFlows({
  scenario,
  baselineFlows,
  distanceMatrix: distanceMatrix.map(({ ['Frete (R$/Kg)']: _rate, ...row }) => row),
});
assert.equal(withoutFreight.flows[0].reallocation_status, 'uncovered');
assert.equal(withoutFreight.flow_summary.uncovered_flows, 1);
assert.match(withoutFreight.errors[0].message, /lowest_freight_available_cd/);

for (const missingMatrix of [undefined, null, []]) {
  const unpriced = rebuildScenarioFlows({ scenario, baselineFlows, distanceMatrix: missingMatrix });
  assert.equal(
    unpriced.flows[0].assigned_cd,
    null,
    'missing matrix must not choose an arbitrary CD'
  );
  assert.equal(unpriced.flow_summary.uncovered_flows, 1);
  assert.equal(unpriced.errors[0].code, 'UNCOVERED_FLOWS');
}

for (const [companyId, expectedRule] of [
  ['empresa1', 'lowest_freight_available_cd'],
  ['empresa2', 'nearest_available_cd'],
  ['empresa_mock', 'nearest_available_cd'],
]) {
  const base = { model: { scenario_id: 'base', active_cds: ['CD A', 'CD B'] } };
  const built = buildScenarioFromForm({ companyId, baselineBundle: base, formValues: {} });
  assert.equal(
    built.changes.reallocation_rule,
    expectedRule,
    `${companyId}: default scenario rule`
  );
  const candidates = generateCandidateScenarios({
    companyId,
    baselineBundle: base,
    generationConfig: {
      freight_multipliers: [1],
      inventory_days_options: [45],
      demand_multipliers: [1],
      max_candidates: 10,
    },
  });
  assert.ok(candidates.candidate_scenarios.length > 0);
  assert.ok(
    candidates.candidate_scenarios.every(
      (candidate) => candidate.changes.reallocation_rule === expectedRule
    )
  );
}

console.log('SCENARIO_REALLOCATION_RULES_OK');
