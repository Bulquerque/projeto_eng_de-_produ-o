import assert from 'node:assert/strict';
import {
  ACADEMIC_EVIDENCE_SCHEMA_VERSION,
  buildAcademicScenarioEvidence,
  buildAcademicScenarioPlan,
  buildScenarioAssumptionEvidence,
  getAcademicOptimizerProfiles,
  buildScenarioNAvailabilityEvidence,
  mapAcademicSampleScenarios,
  projectAcademicScenarioPlan,
} from '../../scripts/academic-evidence-config.mjs';

assert.equal(ACADEMIC_EVIDENCE_SCHEMA_VERSION, '1.2.0');
assert.equal(getAcademicOptimizerProfiles().length, 6);
assert.equal(new Set(getAcademicOptimizerProfiles().map(({ profile_id }) => profile_id)).size, 6);

assert.deepEqual(
  buildScenarioAssumptionEvidence(
    { scenario: { changes: { freight_multiplier: 1, inventory_days: 45, wacc: 0.15 } } },
    { scenario: { changes: { inventory_days: 30, wacc: 0.15, tax_mode: 'current' } } },
    { changes: { freight_multiplier: 1.1 } }
  ),
  {
    freight_multiplier: 1.1,
    demand_multiplier: 1,
    inventory_days: 30,
    wacc: 0.15,
    tax_mode: 'current',
  }
);
assert.deepEqual(
  buildScenarioAssumptionEvidence(
    { scenario: { changes: { inventory_days: 30, wacc: 0.15 } } },
    { scenario: { changes: { inventory_days: 45, wacc: 0.12, tax_mode: 'current' } } },
    { changes: {} }
  ),
  {
    freight_multiplier: 1,
    demand_multiplier: 1,
    inventory_days: 45,
    wacc: 0.12,
    tax_mode: 'current',
  }
);

const cds = [
  'CD Ribeirão Preto',
  'CD Cajamar',
  'CD A',
  'CD B',
  'CD C',
  'CD D',
  'CD E',
  'CD F',
  'CD G',
  'CD H',
  'CD I',
  'CD J',
  'CD K',
  'CD L',
  'CD M',
];
const plan = buildAcademicScenarioPlan('empresa1', {
  model: { scenario_id: 'baseline-e1', active_cds: cds },
});
assert.equal(plan.scenario_status, 'ready');
assert.deepEqual(
  plan.scenarios.map(({ scenario_id }) => scenario_id),
  [
    'e1_14_cds_sem_ribeirao_preto',
    'e1_14_cds_sem_cajamar',
    ...cds.map((cd, index) => `e1_cd_unico_${String(index + 1).padStart(2, '0')}`),
  ]
);
assert.equal(plan.scenarios[0].changes.active_cds.length, 14);
assert.ok(!plan.scenarios[0].changes.active_cds.includes('CD Ribeirão Preto'));
assert.equal(plan.scenarios[1].changes.active_cds.length, 14);
assert.ok(!plan.scenarios[1].changes.active_cds.includes('CD Cajamar'));
assert.ok(plan.scenarios.slice(2).every(({ changes }) => changes.active_cds.length === 1));
assert.ok(plan.scenarios.every(({ changes }) => changes.freight_multiplier === 1));
const projectedPlan = projectAcademicScenarioPlan(plan);
assert.ok(!JSON.stringify(projectedPlan).includes('Ribeirão Preto'));
assert.ok(!JSON.stringify(projectedPlan).includes('Cajamar'));
assert.ok(!JSON.stringify(projectedPlan).includes('ribeirao_preto'));
assert.deepEqual(
  projectedPlan.scenarios.map(({ scenario_id }) => scenario_id),
  [
    'scenario_plan_001',
    'scenario_plan_002',
    ...Array.from({ length: 15 }, (_, i) => `scenario_plan_${String(i + 3).padStart(3, '0')}`),
  ]
);
assert.equal(projectedPlan.scenarios[0].active_cd_count, 14);
assert.equal(projectedPlan.scenarios[0].scenario_name, 'Cenário planejado 1');

const unresolvedNames = buildAcademicScenarioPlan('empresa1', {
  model: { scenario_id: 'baseline-e1', active_cds: ['CD A', 'CD B'] },
});
assert.equal(unresolvedNames.scenario_status, 'partial');
assert.equal(unresolvedNames.scenarios[0].status, 'not_reproducible');
assert.match(unresolvedNames.scenarios[0].reason, /exatamente 15 CDs/i);

const nBlocked = buildScenarioNAvailabilityEvidence({ scenario_id: 'scenario_n' });
assert.equal(nBlocked.status, 'not_reproducible');
assert.deepEqual(nBlocked.required_inputs, ['flow_to_cd_allocation']);
const nReady = buildScenarioNAvailabilityEvidence({
  scenario_id: 'scenario_n',
  flow_to_cd_allocation: [{ flow_id: 'f1', cd: 'CD A' }],
});
assert.equal(nReady.status, 'allocation_available');
assert.equal(nReady.execution_status, 'not_run_by_academic_evidence_generator');
assert.deepEqual(nReady.required_inputs, []);

const executedSampleIds = [];
const sampleResults = mapAcademicSampleScenarios(
  [
    { scenario_id: 'ordinary', scenario_name: 'Ordinary scenario' },
    { scenario_id: 'e2_cenario_n', scenario_name: 'Cenário N' },
    {
      scenario_id: 'scenario_n_with_allocation',
      scenario_name: 'Cenário N com alocação',
      flow_to_cd_allocation: [{ flow_id: 'PRIVATE_FLOW_SENTINEL', cd: 'PRIVATE_CD_SENTINEL' }],
    },
  ],
  (scenario) => {
    executedSampleIds.push(scenario.scenario_id);
    return { scenario_id: scenario.scenario_id, simulation_status: 'success' };
  },
  'empresa2'
);
assert.deepEqual(executedSampleIds, ['ordinary']);
assert.equal(sampleResults[1].status, 'not_reproducible');
assert.equal(sampleResults[1].execution_status, 'not_run_by_academic_evidence_generator');
assert.deepEqual(sampleResults[1].required_inputs, ['flow_to_cd_allocation']);
assert.equal(sampleResults[2].status, 'allocation_available');
assert.equal(sampleResults[2].execution_status, 'not_run_by_academic_evidence_generator');
assert.ok(!JSON.stringify(sampleResults).includes('PRIVATE_FLOW_SENTINEL'));
assert.ok(!JSON.stringify(sampleResults).includes('PRIVATE_CD_SENTINEL'));
const evidence = buildAcademicScenarioEvidence({
  plan: {
    scenario_id: 'sample',
    status: 'ready',
    changes: { active_cds: ['CD A'], freight_multiplier: 1 },
  },
  deterministic: { costs: { freight_cost: 10 }, saving_pct: 5 },
  monteCarlo: {
    monte_carlo_status: 'success',
    iterations: 300,
    seed: 42,
    config: { profile: 'balanced', scatter_driver: 'freight_multiplier' },
    summary: { probability_saving_positive: 0.6 },
  },
});
assert.equal(evidence.scenario.scenario_id, 'scenario_plan_001');
assert.equal(evidence.deterministic.scenario_id, 'scenario_plan_001');
assert.equal(evidence.deterministic.costs.freight_cost, 10);
assert.equal(evidence.monte_carlo.iterations, 300);
assert.equal(evidence.monte_carlo.seed, 42);
assert.equal(evidence.monte_carlo.summary.probability_saving_positive, 0.6);
console.log('ACADEMIC_SCENARIO_PLAN_OK');
