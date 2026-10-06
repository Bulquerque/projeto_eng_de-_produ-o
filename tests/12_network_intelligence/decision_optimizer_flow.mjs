import assert from 'node:assert/strict';
import {
  resolveDecisionOptimizer,
  runDecisionPipeline,
} from '../../assets/js/app/services/decision-service.js';
import {
  renderOptimizerConfigure,
  renderOptimizerResults,
} from '../../assets/js/app/pages/optimizer.js';

const companyId = 'empresa1';
const ranked = {
  company_id: companyId,
  optimizer_status: 'success',
  constraints: { min_active_cds: 1, max_active_cds: 5 },
  search_log: { coverage_ratio: 0.8, exact_search_space: null, simulated_candidates: null },
  best_scenarios: [{ scenario_id: 'scenario-a' }],
  scored_scenarios: [
    {
      company_id: companyId,
      scenario_id: 'scenario-a',
      scenario: { company_id: companyId, scenario_id: 'scenario-a' },
      result: { company_id: companyId, scenario_id: 'scenario-a', total_with_tax: 100 },
      final_score: null,
    },
  ],
  objective: { profile_id: 'cfo' },
};

let optimizationCalls = 0;
const provider = {
  async runOptimization(config) {
    optimizationCalls += 1;
    return { ...ranked, received: config };
  },
};

const manual = await resolveDecisionOptimizer({
  provider,
  companyId,
  selectionMode: 'manual',
  manualScenarioId: 'scenario-a',
  existingOptimizerResult: ranked,
});
assert.equal(manual.optimizer, ranked, 'manual selection reuses the evaluated ranking');
assert.equal(manual.error, null);
assert.equal(optimizationCalls, 0, 'manual selection does not launch a default re-search');

const unknownManual = await resolveDecisionOptimizer({
  provider,
  companyId,
  selectionMode: 'manual',
  manualScenarioId: 'outside-ranking',
  existingOptimizerResult: ranked,
});
assert.match(unknownManual.error, /não pertence ao ranking/);
assert.equal(optimizationCalls, 0, 'invalid manual selection also avoids re-search');

const foreignRanking = await resolveDecisionOptimizer({
  provider,
  companyId,
  selectionMode: 'manual',
  manualScenarioId: 'scenario-a',
  existingOptimizerResult: { ...ranked, company_id: 'empresa2' },
});
assert.match(foreignRanking.error, /não pertence à empresa ativa/);

const automatic = await resolveDecisionOptimizer({ provider, companyId, profileId: 'cfo' });
assert.equal(optimizationCalls, 1, 'automatic decisions continue to run a fresh search');
assert.equal(automatic.optimizer.received.profileId, 'cfo');

let pipelineOptimizationCalls = 0;
const scenario = {
  company_id: companyId,
  scenario_id: 'scenario-a',
  scenario_name: 'Candidato selecionado',
  changes: { active_cds: ['cd-a'] },
};
const deterministicResult = {
  company_id: companyId,
  scenario_id: 'scenario-a',
  total_with_tax: 90,
  costs: { total_with_tax: 90 },
  evidence: { evidence_status: 'ready', evidence_score: 90 },
};
const pipelineRanking = {
  ...ranked,
  scored_scenarios: [
    {
      ...ranked.scored_scenarios[0],
      scenario,
      result: deterministicResult,
    },
  ],
};
const pipelineProvider = {
  getDomainContext() {
    return {
      company_id: companyId,
      baselineBundle: {
        company_id: companyId,
        model: { scenario_id: 'base-a' },
        costs: { costs: { total_with_tax: 100 } },
        complements: { audit_sources: [] },
      },
    };
  },
  async runOptimization() {
    pipelineOptimizationCalls += 1;
    throw new Error('manual decision must not run another search');
  },
  async runRiskSuite() {
    return {
      monte_carlo: { company_id: companyId, summary: {} },
      stress: {
        company_id: companyId,
        stress_results: [
          {
            company_id: companyId,
            status: 'success',
            saving_pct: 10,
            decision_use: 'decision_support',
          },
        ],
        summary: { cases_run: 1, cases_evaluated: 1, cases_positive: 1, cases_blocked: 0 },
      },
      sensitivity: { company_id: companyId, sensitivity_results: [] },
      sensitivity_matrix: { company_id: companyId, matrix_results: [] },
      robustness: { company_id: companyId, robustness_score: 80 },
    };
  },
};
const decisionPackage = await runDecisionPipeline({
  provider: pipelineProvider,
  selectionMode: 'manual',
  manualScenarioId: 'scenario-a',
  existingOptimizerResult: pipelineRanking,
});
assert.equal(pipelineOptimizationCalls, 0);
assert.equal(decisionPackage.selected_scenario?.scenario?.scenario_id, 'scenario-a');
const exportedDecisionPackage = JSON.parse(
  decisionPackage.export_package.files.find((file) => file.type === 'application/json').content
);
assert.deepEqual(exportedDecisionPackage.release, decisionPackage.release);
assert.deepEqual(exportedDecisionPackage.decision_package.release, decisionPackage.release);
assert.deepEqual(exportedDecisionPackage.final_qa, decisionPackage.final_qa);

const configState = {
  context: { company_id: companyId },
  ui: {
    route: '#/network/optimizer/configure',
    optimizer_config: {
      profile_id: 'cfo',
      max_candidates: 500,
      seed: 73,
      constraints: { min_active_cds: 2, max_active_cds: 6, max_risk_level: 'medium' },
      risk_config: {
        iterations: 900,
        seed: 12,
        profile: 'broad',
        scatter_driver: 'wacc',
        stress_profile: 'conservative',
        sensitivity_variable: 'inventory_days',
        sensitivity_x: 'freight_multiplier',
        sensitivity_y: 'wacc',
      },
    },
  },
  data: { baseline: { model: { scenario_id: 'base-a' } }, optimizer: ranked },
};
const configureHtml = renderOptimizerConfigure(configState);
assert.match(configureHtml, /name="profile_id" value="cfo" checked/);
for (const value of ['500', '73', '900', '12']) {
  assert.match(configureHtml, new RegExp(`value="${value}"`));
}
assert.match(configureHtml, /name="stress_profile"[\s\S]*value="conservative" selected/);
assert.match(configureHtml, /name="sensitivity_y"[\s\S]*value="wacc" selected/);
assert.match(configureHtml, /CDs no baseline<\/dt><dd>—<\/dd>/);

const resultHtml = renderOptimizerResults({
  ...configState,
  ui: { ...configState.ui, route: '#/network/optimizer/results' },
});
assert.match(resultHtml, /<dt>CDs ativos<\/dt><dd>—<\/dd>/);
assert.match(resultHtml, /<dt>Pontuação<\/dt><dd>—<\/dd>/);
assert.doesNotMatch(resultHtml, /Catálogo completo|Confiabilidade|Cobertura/i);
assert.match(resultHtml, /Alternativas avaliadas[\s\S]*?—/);
assert.match(resultHtml, /Ranking da avaliação/);
assert.doesNotMatch(resultHtml, /otimização/i);

console.log('DECISION_OPTIMIZER_FLOW_OK');
