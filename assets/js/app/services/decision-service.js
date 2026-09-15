import { compareScenarios } from '../../phase3/scenario-comparator.js';
import { selectFinalScenario } from '../../phase5/final-scenario-selector.js';
import { buildRecommendation } from '../../phase5/recommendation-engine.js';
import { buildAuditTrail } from '../../phase5/audit-trail-engine.js';
import { runFinalQAChecks } from '../../phase5/final-qa-checker.js';
import { validateRelease } from '../../phase5/release-validator.js';
import { buildExportPackage } from '../../phase5/export-center.js';
import { runRiskAnalysis } from './risk-service.js';

function buildBlockedPackage(companyId, message) {
  return {
    company_id: companyId,
    selected_scenario: null,
    recommendation: {
      company_id: companyId,
      recommendation_status: 'not_recommended',
      executive_summary: message,
      main_reasons: [],
      main_risks: [message],
      next_actions: ['Corrigir o bloqueio antes de interpretar o resultado.'],
    },
    final_qa: {
      company_id: companyId,
      final_qa_status: 'failed',
      checks: [],
      blocking_issues: [message],
      warnings: [],
    },
    release: {
      release_status: 'blocked',
      ready_to_deliver: false,
      blocking_issues: [message],
      warnings: [],
    },
    export_package: { export_status: 'blocked', files: [], warnings: [], errors: [message] },
  };
}

export async function runDecisionPipeline({
  provider,
  profileId = 'balanced',
  selectionMode = 'best_by_score',
  manualScenarioId = null,
  optimizerConfig = {},
  constraints = {},
  riskConfig = {},
} = {}) {
  const context = provider.getDomainContext();
  const companyId = context.company_id;
  const optimizer = await provider.runOptimization({
    profileId,
    constraints,
    config: optimizerConfig,
  });
  if (!String(optimizer?.optimizer_status || '').startsWith('success')) {
    return buildBlockedPackage(
      companyId,
      (optimizer?.errors || ['Falha na busca discreta de cenários.']).join('; ')
    );
  }
  const selection = selectFinalScenario({
    companyId,
    optimizerResult: optimizer,
    selectionMode,
    manualScenarioId,
  });
  if (!selection.selected_scenario) {
    return buildBlockedPackage(
      companyId,
      (selection.errors || ['Nenhum cenário pôde ser selecionado.']).join('; ')
    );
  }
  const selected = selection.selected_scenario;
  const risk = await runRiskAnalysis({
    provider,
    selectedScenario: selected.scenario,
    deterministicResult: selected.result,
    config: riskConfig,
  });
  const selectedWithRisk = { ...selected, monte_carlo: risk.monte_carlo };
  const comparison = compareScenarios({
    companyId,
    baselineBundle: context.baselineBundle,
    scenarioResults: [selected.result],
  });
  const recommendation = buildRecommendation({
    companyId,
    selectedScenario: selectedWithRisk,
    comparison,
    quality: selected.quality || {},
    robustness: risk.robustness,
    rankingSensitivity: optimizer.ranking_sensitivity,
    objective: optimizer.objective || context.objective || {},
    optimization: optimizer.search_log,
  });
  const audit = buildAuditTrail({
    companyId,
    selectedScenario: selectedWithRisk,
    baselineBundle: context.baselineBundle,
    objective: optimizer.objective || context.objective || {},
    recommendation,
    optimizerResult: optimizer,
    extraSources: context.baselineBundle?.complements?.audit_sources || [],
  });
  const decisionPackage = {
    company_id: companyId,
    selected_scenario_id: selection.selected_scenario_id,
    baseline_scenario_id: context.baselineBundle?.model?.scenario_id,
    objective: optimizer.objective || context.objective || {},
    recommendation,
    stress_test: risk.stress?.summary || risk.stress,
    robustness: risk.robustness,
    audit,
    ranking_sensitivity: optimizer.ranking_sensitivity,
    monte_carlo: risk.monte_carlo,
    optimizer_status: optimizer.optimizer_status,
    result_scope: optimizer.result_scope,
  };
  const finalQA = runFinalQAChecks({
    companyId,
    bundle: context.baselineBundle,
    selectedScenario: selectedWithRisk,
    stress: risk.stress,
    recommendation,
    audit,
  });
  const preReleasePackage = buildExportPackage({
    companyId,
    decisionPackage: { ...decisionPackage, final_qa: finalQA },
    stress: risk.stress,
    sensitivity: risk.sensitivity,
    sensitivityMatrix: risk.sensitivity_matrix,
    audit,
    recommendation,
    selectedScenario: selectedWithRisk,
    comparison,
    robustness: risk.robustness,
    workbookParity: context.baselineBundle?.workbook_parity || null,
    rankingSensitivity: optimizer.ranking_sensitivity,
    finalQA,
  });
  const release = validateRelease({
    finalQA,
    exportPackage: preReleasePackage,
    decisionPackage: { ...decisionPackage, final_qa: finalQA },
  });
  const exportPackage = buildExportPackage({
    companyId,
    decisionPackage: { ...decisionPackage, final_qa: finalQA, release },
    stress: risk.stress,
    sensitivity: risk.sensitivity,
    sensitivityMatrix: risk.sensitivity_matrix,
    audit,
    recommendation,
    selectedScenario: selectedWithRisk,
    comparison,
    robustness: risk.robustness,
    workbookParity: context.baselineBundle?.workbook_parity || null,
    rankingSensitivity: optimizer.ranking_sensitivity,
    finalQA,
    release,
  });
  return {
    company_id: companyId,
    optimizer,
    selection,
    selected_scenario: selectedWithRisk,
    comparison,
    risk,
    recommendation,
    audit,
    final_qa: finalQA,
    release,
    export_package: exportPackage,
  };
}
