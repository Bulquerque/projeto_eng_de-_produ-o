import assert from 'node:assert/strict';
import {
  buildAcademicScenarioEvidence,
  projectAcademicScenarioResult,
} from '../../scripts/academic-evidence-config.mjs';
const original = {
  company_id: 'empresa1',
  simulation_status: 'success',
  scenario: {
    changes: {
      active_cds: ['PRIVATE_LOCATION', 'PRIVATE_LOCATION2'],
      freight_multiplier: 1.2,
      demand_multiplier: 1.1,
      inventory_days: 30,
      wacc: 0.12,
      tax_mode: 'reform_2033',
      reallocation_rule: 'lowest_freight_available_cd',
    },
  },
  costs: { total_logistics_cost: 100, total_with_tax: 110, tax_impact: 10 },
  total_with_tax: 110,
};
const projected = projectAcademicScenarioResult({
  result: original,
  quality: { quality_score: 77, risk_level: 'low' },
  scenarioId: 'scenario_plan_001',
});
const repeated = buildAcademicScenarioEvidence({
  plan: { status: 'ready', changes: { active_cds: ['PRIVATE_LOCATION', 'PRIVATE_LOCATION2'] } },
  deterministic: projected,
  scenarioId: 'scenario_plan_001',
}).deterministic;
for (const key of [
  'active_cds_count',
  'freight_multiplier',
  'demand_multiplier',
  'inventory_days',
  'wacc',
  'tax_mode',
  'reallocation_rule_effective',
])
  assert.equal(repeated[key], projected[key], key);
assert.equal(repeated.quality.quality_score, 77);
assert.equal(repeated.quality.risk_level, 'low');
assert(!JSON.stringify(repeated).includes('PRIVATE_LOCATION'));
console.log('ACADEMIC_PROJECTION_IDEMPOTENCY_OK');
