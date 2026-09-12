import { loadPhase2Bundle } from '../core/data-loader.js';
import { $, escapeHtml, formatBRL, formatNumber, formatPct, metric } from '../core/common.js';
import { buildObjective } from '../phase4/objective-builder.js';
import { runOptimization } from '../phase4/scenario-optimizer.js';
import { selectFinalScenario } from './final-scenario-selector.js';
import { buildStressCaseLibrary } from './stress-case-library.js';
import { runStressTests } from './stress-test-engine.js';
import { runSensitivity, runSensitivityMatrix } from './sensitivity-engine.js';
import { calculateRobustness } from './robustness-scorer.js';
import { buildRecommendation } from './recommendation-engine.js';
import { buildAuditTrail } from './audit-trail-engine.js';
import { buildExecutiveReportHtml } from './executive-report-builder.js';
import { buildExportPackage, triggerBrowserDownload } from './export-center.js';
import { runFinalQAChecks } from './final-qa-checker.js';
import { validateRelease } from './release-validator.js';
import { runMonteCarloSimulation } from '../phase3/monte-carlo-engine.js';
import { renderSensitivityChart, renderStressChart, renderRobustnessChart } from './charts.js';
import { buildWorkbookParitySummary, renderWorkbookParityPanel } from './workbook-parity.js';
import { appendSharedDebugEntry } from '../core/debug-tools.js';
import { buildCanonicalOptimizationConfig } from '../core/optimization-policy.js';
import { loadOptimizationConfig } from '../core/optimization-config-store.js';
import {
  buildScenarioSummary,
  formatInventoryDaysDisplay,
  formatMultiplierDisplay,
} from '../core/scenario-summary.js';
import { calculateSaving, MODEL_DEFAULTS } from '../core/model-configuration.js';

const state = {
  companyId: 'empresa1',
  bundle: null,
  objective: null,
  optimizer: null,
  selection: null,
  stress: null,
  sensitivity: null,
  sensitivityMatrix: null,
  robustness: null,
  recommendation: null,
  audit: null,
  exportPackage: null,
  finalQA: null,
  release: null,
  monteCarlo: null,
  workbookParity: null,
  optimizationConfig: null,
  isLoading: false,
};
function label(cid) {
  return cid === 'empresa2' ? 'Empresa 2' : 'Empresa 1';
}
function formatOptionalBRL(value, compact = false) {
  return value === null || value === undefined || value === '' ? '—' : formatBRL(value, compact);
}
function formatOptionalPct(value, digits = 1) {
  return value === null || value === undefined || value === '' ? '—' : formatPct(value, digits);
}
function log(label, obj) {
  appendSharedDebugEntry({
    phase: 'phase5',
    module: 'phase5-dashboard',
    level: 'info',
    event: label,
    detail: typeof obj === 'string' ? { message: obj } : obj || {},
  });
  const el = $('phase5DebugConsole');
  if (el)
    el.textContent = `${new Date().toLocaleTimeString()} · ${label}\n${typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)}`;
}
function logError(label, obj) {
  appendSharedDebugEntry({
    phase: 'phase5',
    module: 'phase5-dashboard',
    level: 'error',
    event: label,
    detail: typeof obj === 'string' ? { message: obj } : obj || {},
    error: typeof obj === 'string' ? new Error(obj) : obj,
  });
  const el = $('phase5DebugConsole');
  if (el)
    el.textContent = `${new Date().toLocaleTimeString()} · ${label}\n${typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)}`;
}
function defaultObjective() {
  const inherited = state.optimizationConfig?.objective;
  if (inherited?.weights) {
    return buildObjective({
      companyId: state.companyId,
      objectiveName: inherited.objective_name || 'Objetivo herdado da Fase 4',
      weights: inherited.weights,
    });
  }
  return buildObjective({
    companyId: state.companyId,
    objectiveName: 'Perfil Final Balanceado',
    weights: {
      total_cost: 30,
      service_quality: 25,
      operational_risk: 20,
      tax_impact: 15,
      inventory_efficiency: 10,
    },
  });
}
function constraints() {
  return {
    min_active_cds: 1,
    max_active_cds: 999,
    max_cd_volume_share: 0.75,
    max_risk_level: 'high',
    ...(state.optimizationConfig?.constraints || {}),
    allow_tax_disabled: false,
  };
}
function optimizerConfig() {
  return buildCanonicalOptimizationConfig({
    ...(state.optimizationConfig?.optimizer_config || {}),
    method: state.optimizationConfig?.optimizer_config?.method || 'exact_discrete',
    max_candidates: Number($('phase5MaxCandidates')?.value || 2000),
    seed: Number(state.optimizationConfig?.optimizer_config?.seed ?? 42),
  });
}
function applyInheritedOptimizationConfig() {
  const note = $('phase5OptimizationConfigNote');
  if (!state.optimizationConfig) {
    if (note)
      note.textContent =
        'Configuração canônica da Fase 5; rode a Fase 4 para herdar um perfil customizado.';
    return;
  }
  const maxCandidates = Number(state.optimizationConfig.optimizer_config?.max_candidates);
  if (Number.isFinite(maxCandidates) && maxCandidates >= 100) {
    $('phase5MaxCandidates').value = String(Math.min(10000, Math.max(100, maxCandidates)));
  }
  if (note)
    note.textContent = `Configuração herdada da Fase 4: ${state.optimizationConfig.objective?.objective_name || 'objetivo customizado'} · seed ${state.optimizationConfig.optimizer_config?.seed ?? 42}.`;
}
function renderTabs() {
  document.querySelectorAll('[data-company]').forEach((btn) => {
    const active = btn.dataset.company === state.companyId;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  $('phase5CompanyLabel').textContent = label(state.companyId);
}
function baselineResult() {
  return {
    scenario_id: state.bundle?.model?.scenario_id,
    total_with_tax: state.bundle?.costs?.costs?.total_with_tax,
    costs: state.bundle?.costs?.costs || {},
    tax_results: state.bundle?.tax_results?.tax_results || {},
  };
}
export function scenarioComparison(selected) {
  const scenarioTotal = selected?.result?.total_with_tax ?? selected?.total_with_tax;
  if (scenarioTotal == null || !Number.isFinite(Number(scenarioTotal))) {
    return {
      baseline_total: Number(state.bundle?.costs?.costs?.total_with_tax) || 0,
      scenario_total: null,
      saving_abs: null,
      saving_pct: null,
    };
  }
  return calculateSaving({
    baselineTotal: state.bundle?.costs?.costs?.total_with_tax,
    scenarioTotal,
  });
}
function blockedDecisionState(message) {
  state.stress = {
    company_id: state.companyId,
    scenario_id: null,
    stress_results: [],
    summary: { cases_run: 0, cases_positive: 0, cases_negative: 0 },
    warnings: [],
    errors: [message],
  };
  state.sensitivity = {
    company_id: state.companyId,
    scenario_id: null,
    sensitivity_results: [],
    most_sensitive_variable: null,
    warnings: [],
    errors: [message],
  };
  state.sensitivityMatrix = {
    company_id: state.companyId,
    scenario_id: null,
    matrix_results: [],
    warnings: [],
    errors: [message],
  };
  state.robustness = {
    company_id: state.companyId,
    scenario_id: null,
    robustness_score: 0,
    robustness_status: 'low',
    cases_positive: 0,
    cases_total: 0,
    worst_case_saving_pct: 0,
    alerts: [message],
    warnings: [],
    errors: [message],
  };
  state.recommendation = {
    company_id: state.companyId,
    scenario_id: null,
    recommendation_status: 'not_recommended',
    objective_id: state.objective?.objective_id || null,
    executive_summary: message,
    main_reasons: [],
    main_risks: [message],
    next_actions: [],
    warnings: [],
    errors: [message],
  };
  state.audit = buildAuditTrail({
    companyId: state.companyId,
    selectedScenario: null,
    baselineBundle: state.bundle,
    objective: state.objective || {},
    recommendation: state.recommendation,
    optimizerResult: state.optimizer,
    rankingSensitivity: state.optimizer?.ranking_sensitivity,
    extraSources: state.bundle?.complements?.audit_sources || [],
  });
  state.exportPackage = { export_status: 'blocked', files: [], warnings: [], errors: [message] };
  state.finalQA = runFinalQAChecks({
    companyId: state.companyId,
    bundle: state.bundle,
    selectedScenario: null,
    stress: state.stress,
    recommendation: state.recommendation,
    audit: state.audit,
  });
  state.release = validateRelease({ finalQA: state.finalQA });
  state.monteCarlo = null;
}
function runDecisionPipeline() {
  state.objective = defaultObjective();
  state.workbookParity = buildWorkbookParitySummary(state.bundle);
  state.optimizer = runOptimization({
    companyId: state.companyId,
    baselineBundle: state.bundle,
    objective: state.objective,
    constraints: constraints(),
    optimizerConfig: optimizerConfig(),
  });
  if (!String(state.optimizer.optimizer_status || '').startsWith('success')) {
    state.selection = null;
    blockedDecisionState(
      (state.optimizer.errors || ['Falha na busca discreta de cenários.']).join('; ')
    );
    return;
  }
  state.selection = selectFinalScenario({
    companyId: state.companyId,
    optimizerResult: state.optimizer,
    selectionMode: $('phase5SelectionMode')?.value || 'best_by_score',
    manualScenarioId: $('phase5ManualScenarioId')?.value || null,
  });
  if (!state.selection?.selected_scenario) {
    blockedDecisionState(
      (state.selection?.errors || ['Nenhum cenário pôde ser selecionado.']).join('; ')
    );
    return;
  }
  const selected = state.selection.selected_scenario;
  const scenario = selected?.scenario;
  const quality = selected?.quality || {};
  state.monteCarlo = runMonteCarloSimulation({
    companyId: state.companyId,
    selectedScenario: scenario,
    baselineBundle: state.bundle,
    deterministicResult: selected?.result,
    iterations: 300,
    seed: 42,
    config: { profile: 'balanced', scatter_driver: 'freight_multiplier' },
  });
  const selectedWithMonteCarlo = { ...selected, monte_carlo: state.monteCarlo };
  state.selection.selected_scenario = selectedWithMonteCarlo;
  state.workbookParity = buildWorkbookParitySummary(state.bundle);
  state.stress = runStressTests({
    companyId: state.companyId,
    selectedScenario: scenario,
    baselineBundle: state.bundle,
    baselineResult: baselineResult(),
    stressCases: buildStressCaseLibrary({
      companyId: state.companyId,
      stressProfile: $('phase5StressProfile')?.value || 'standard',
    }).stress_cases,
  });
  state.sensitivity = runSensitivity({
    companyId: state.companyId,
    selectedScenario: scenario,
    baselineBundle: state.bundle,
    sensitivityConfig: {
      variable: $('phase5SensitivityVariable')?.value || 'freight_multiplier',
      values: sensitivityValues($('phase5SensitivityVariable')?.value || 'freight_multiplier'),
    },
  });
  state.sensitivityMatrix = runSensitivityMatrix({
    companyId: state.companyId,
    selectedScenario: scenario,
    baselineBundle: state.bundle,
    matrixConfig: {
      xVariable: $('phase5SensitivityX')?.value || 'freight_multiplier',
      yVariable: $('phase5SensitivityY')?.value || 'demand_multiplier',
      xValues: sensitivityValues($('phase5SensitivityX')?.value || 'freight_multiplier', true),
      yValues: sensitivityValues($('phase5SensitivityY')?.value || 'demand_multiplier', true),
    },
  });
  state.robustness = calculateRobustness({
    companyId: state.companyId,
    scenarioId: scenario?.scenario_id,
    stressResults: state.stress.stress_results,
    quality,
    monteCarlo: state.monteCarlo,
    evidence: selected?.result?.evidence || null,
  });
  const comparison = scenarioComparison(selectedWithMonteCarlo);
  state.recommendation = buildRecommendation({
    companyId: state.companyId,
    selectedScenario: selectedWithMonteCarlo,
    comparison,
    quality,
    robustness: state.robustness,
    rankingSensitivity: state.optimizer?.ranking_sensitivity,
    objective: state.objective,
    optimization: state.optimizer?.search_log,
  });
  state.audit = buildAuditTrail({
    companyId: state.companyId,
    selectedScenario: selectedWithMonteCarlo,
    baselineBundle: state.bundle,
    objective: state.objective,
    recommendation: state.recommendation,
    optimizerResult: state.optimizer,
    extraSources: state.bundle?.complements?.audit_sources || [],
  });
  const decisionPackage = {
    company_id: state.companyId,
    selected_scenario_id: state.selection.selected_scenario_id,
    baseline_scenario_id: state.bundle.model.scenario_id,
    objective: state.objective,
    recommendation: state.recommendation,
    stress_test: state.stress.summary,
    robustness: state.robustness,
    audit: state.audit,
    ranking_sensitivity: state.optimizer?.ranking_sensitivity,
    monte_carlo: state.monteCarlo,
    optimizer_status: state.optimizer?.optimizer_status || null,
    result_scope: state.optimizer?.result_scope || null,
  };
  state.finalQA = runFinalQAChecks({
    companyId: state.companyId,
    bundle: state.bundle,
    selectedScenario: selectedWithMonteCarlo,
    stress: state.stress,
    recommendation: state.recommendation,
    audit: state.audit,
  });
  const decisionPackageWithQA = { ...decisionPackage, final_qa: state.finalQA };
  state.exportPackage = buildExportPackage({
    companyId: state.companyId,
    decisionPackage: decisionPackageWithQA,
    stress: state.stress,
    sensitivity: state.sensitivity,
    sensitivityMatrix: state.sensitivityMatrix,
    audit: state.audit,
    recommendation: state.recommendation,
    selectedScenario: selectedWithMonteCarlo,
    comparison,
    robustness: state.robustness,
    workbookParity: state.workbookParity,
    rankingSensitivity: state.optimizer?.ranking_sensitivity,
    finalQA: state.finalQA,
  });
  state.release = validateRelease({
    finalQA: state.finalQA,
    exportPackage: state.exportPackage,
    decisionPackage: decisionPackageWithQA,
  });
  const finalizedDecisionPackage = { ...decisionPackageWithQA, release: state.release };
  state.exportPackage = buildExportPackage({
    companyId: state.companyId,
    decisionPackage: finalizedDecisionPackage,
    stress: state.stress,
    sensitivity: state.sensitivity,
    sensitivityMatrix: state.sensitivityMatrix,
    audit: state.audit,
    recommendation: state.recommendation,
    selectedScenario: selectedWithMonteCarlo,
    comparison,
    robustness: state.robustness,
    workbookParity: state.workbookParity,
    rankingSensitivity: state.optimizer?.ranking_sensitivity,
    finalQA: state.finalQA,
    release: state.release,
  });
  state.release = validateRelease({
    finalQA: state.finalQA,
    exportPackage: state.exportPackage,
    decisionPackage: finalizedDecisionPackage,
  });
}
function sensitivityValues(variable, compact = false) {
  if (variable === 'inventory_days')
    return compact
      ? [30, MODEL_DEFAULTS.inventory_days, 60]
      : [30, MODEL_DEFAULTS.inventory_days, 60];
  if (variable === 'wacc')
    return compact
      ? [0.1, MODEL_DEFAULTS.reference_wacc, 0.2]
      : [0.1, MODEL_DEFAULTS.reference_wacc, 0.2];
  return compact ? [0.9, 1.0, 1.1] : [0.9, 1.0, 1.1, 1.2];
}
function variableLabel(variable) {
  return (
    {
      freight_multiplier: 'Frete',
      demand_multiplier: 'Demanda',
      inventory_days: 'Estoque',
      wacc: 'WACC',
    }[variable] || variable
  );
}
function recommendationLabel(status) {
  return (
    {
      recommended: 'recomendado',
      recommended_with_warnings: 'recomendado com alertas',
      not_recommended: 'não recomendado',
      review_required: 'revisar',
    }[status] ||
    status ||
    '—'
  );
}
function releaseLabel(status) {
  return { ready: 'pronto', blocked: 'bloqueado', warning: 'atenção' }[status] || status || '—';
}
function renderOverview() {
  const selected = state.selection?.selected_scenario;
  const comp = scenarioComparison(selected);
  const robustnessIsCertified = state.robustness?.certified_robustness_score != null;
  const robustnessValue = selected
    ? `${formatNumber(state.robustness?.robustness_score, 0)}/100`
    : '—';
  $('phase5OverviewCards').innerHTML = [
    metric(
      'Cenário selecionado',
      selected?.scenario_name || selected?.scenario_id || '—',
      state.selection?.selection_reason || ''
    ),
    metric(
      'Total cenário',
      formatBRL(selected?.result?.total_with_tax, true),
      'estimado pelo simulador'
    ),
    metric(
      'Saving vs baseline',
      formatOptionalBRL(comp.saving_abs, true),
      formatOptionalPct(comp.saving_pct)
    ),
    metric(
      robustnessIsCertified ? 'Robustez' : 'Robustez condicional',
      robustnessValue,
      selected
        ? robustnessIsCertified
          ? state.robustness?.robustness_status || '—'
          : 'exploratória — não certificada'
        : 'não calculada'
    ),
    metric(
      'Recomendação',
      recommendationLabel(state.recommendation?.recommendation_status),
      'status final'
    ),
    metric(
      'Release',
      releaseLabel(state.release?.release_status),
      state.release?.release_status === 'warning'
        ? 'pronto com limitações documentadas'
        : state.release?.ready_to_deliver
          ? 'pronto'
          : 'com bloqueios técnicos'
    ),
  ].join('');
  renderRobustnessChart(state.robustness?.robustness_score);
  renderFinalSituationTable(selected, comp);
}
function renderFinalSituationTable(selected, comp) {
  if (!selected) {
    const rows = [
      ['Empresa', label(state.companyId)],
      ['Baseline', state.bundle?.model?.scenario_id || '—'],
      ['Cenário selecionado', '— (nenhum cenário elegível)'],
      ['Status do cálculo tributário', 'bloqueado'],
      ['Cobertura fiscal dos fluxos de entrada', '—'],
      ['Total', '—'],
      ['Total baseline', formatOptionalBRL(comp.baseline_total, true)],
      ['Total final', '—'],
      ['Saving absoluto', '—'],
      ['Saving percentual', '—'],
      ['Robustez', '—'],
      ['Suporte da evidência', '—'],
      ['Risco', '—'],
      ['Recomendação', recommendationLabel(state.recommendation?.recommendation_status)],
    ];
    const el = $('finalSituationTable');
    if (el)
      el.innerHTML = `<table><thead><tr><th>Indicador</th><th>Valor</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1])}</td></tr>`).join('')}</tbody></table>`;
    return;
  }
  const quality = selected?.quality || {};
  const summary = buildScenarioSummary({
    scenario: selected?.scenario,
    result: selected?.result || selected,
    quality,
    baselineTotal: comp.baseline_total,
  });
  const rows = [
    ['Empresa', label(state.companyId)],
    ['Baseline', state.bundle?.model?.scenario_id || '—'],
    ['Cenário selecionado', selected?.scenario_name || selected?.scenario_id || '—'],
    ['CDs', String(summary.active_cds_count)],
    ['Frete', formatMultiplierDisplay(summary.freight_multiplier)],
    ['Demanda', formatMultiplierDisplay(summary.demand_multiplier)],
    ['Estoque', formatInventoryDaysDisplay(summary.inventory_days)],
    ['Regime tributário', summary.tax_regime_label],
    ['Transferência', formatBRL(summary.transfer_cost, true)],
    ['Tributo', formatBRL(summary.tax_impact, true)],
    ['Status do cálculo tributário', selected?.result?.tax_results?.calculation_mode || '—'],
    ['Qualidade dos dados', selected?.result?.data_quality?.status || '—'],
    ['Uso permitido', selected?.result?.data_quality?.decision_use || 'decision_support'],
    ['Estudo próprio tributário', selected?.result?.tax_results?.tax_study?.study_id || '—'],
    [
      'Cobertura fiscal dos fluxos de entrada',
      selected?.result?.tax_results?.tax_coverage?.input_coverage_ratio == null
        ? '—'
        : formatPct(selected.result.tax_results.tax_coverage.input_coverage_ratio * 100),
    ],
    ['Total', formatBRL(summary.total_with_tax, true)],
    ['Total baseline', formatOptionalBRL(comp.baseline_total, true)],
    ['Total final', formatOptionalBRL(comp.scenario_total, true)],
    ['Saving absoluto', formatOptionalBRL(comp.saving_abs, true)],
    ['Saving percentual', formatOptionalPct(comp.saving_pct)],
    [
      state.robustness?.certified_robustness_score != null ? 'Robustez' : 'Robustez condicional',
      `${formatNumber(state.robustness?.robustness_score, 0)}/100`,
    ],
    [
      'Certificação da robustez',
      state.robustness?.certified_robustness_score != null
        ? 'disponível no escopo modelado'
        : 'não certificada — interpretação exploratória',
    ],
    [
      'Suporte da evidência',
      `${formatNumber(selected?.result?.evidence?.evidence_score, 0)}/100 · ${selected?.result?.evidence?.evidence_status || '—'}`,
    ],
    ['Risco', quality.risk_level || '—'],
    ['Recomendação', recommendationLabel(state.recommendation?.recommendation_status)],
  ];
  const el = $('finalSituationTable');
  if (el)
    el.innerHTML = `<table><thead><tr><th>Indicador</th><th>Valor</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1])}</td></tr>`).join('')}</tbody></table>`;
}
function renderTaxPeriods() {
  const el = $('taxPeriodsPanel');
  if (!el) return;
  const tax = state.selection?.selected_scenario?.result?.tax_results || {};
  const contract = tax.tax_period_contract || tax.metadata?.tax_period_contract || {};
  const selected = contract.selected_period || {};
  const dataPeriod = contract.current_reference_data_period || {};
  const observed = contract.observed_data_coverage || {};
  const rows = (contract.available_periods || [])
    .map(
      (period) =>
        `<tr><td>${escapeHtml(String(period.year ?? '—'))}</td><td>${escapeHtml(period.phase || '—')}</td><td>${period.current_tax_weight == null ? '—' : formatPct(period.current_tax_weight * 100)}</td><td>${period.reform_tax_weight == null ? '—' : formatPct(period.reform_tax_weight * 100)}</td><td>${escapeHtml(period.source_confidence || '—')}</td><td>${escapeHtml(period.data_status || '—')}</td></tr>`
    )
    .join('');
  el.innerHTML = `<p><strong>Selecionado:</strong> ${escapeHtml(String(selected.year || '—'))} · ${escapeHtml(selected.source_status || '—')} · ${escapeHtml(selected.source_ref || selected.bridge_source_ref || '—')}</p><p><strong>Matriz atual:</strong> ${escapeHtml(`${dataPeriod.period_start || '—'} a ${dataPeriod.period_end || 'aberto'} · ${dataPeriod.source_file || '—'}`)}</p><p><strong>Dados transacionais observados:</strong> ${escapeHtml(`${observed.status || '—'}; período não informado quando ausente na fonte.`)}</p><table><thead><tr><th>Ano</th><th>Fase</th><th>Atual</th><th>IBS</th><th>Fonte</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Cronograma oficial não carregado.</td></tr>'}</tbody></table><p class="small-note">A tabela separa cronograma oficial, matriz de referência e histórico transacional. A ausência de período observado não é preenchida por hipótese.</p>`;
}
function renderStress() {
  const rows = (state.stress?.stress_results || [])
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.case_name)}</td><td>${formatBRL(r.total_with_tax, true)}</td><td>${formatBRL(r.saving_vs_baseline, true)}</td><td>${formatPct(r.saving_pct)}</td><td>${r.scenario_still_better_than_baseline ? 'sim' : 'não'}</td><td>${escapeHtml(r.data_quality_status || 'complete')}</td></tr>`
    )
    .join('');
  $('stressPanel').innerHTML =
    `<table><thead><tr><th>Caso</th><th>Total</th><th>Saving</th><th>Saving %</th><th>Melhor que base?</th><th>Qualidade dos dados</th></tr></thead><tbody>${rows}</tbody></table><p class="small-note">Casos com cobertura fiscal parcial permanecem disponíveis para leitura exploratória.</p>`;
  renderStressChart(state.stress?.stress_results);
}
function renderSensitivityPanel() {
  const rows = (state.sensitivity?.sensitivity_results || [])
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.variable)}</td><td>${escapeHtml(r.value)}</td><td>${formatBRL(r.total_with_tax, true)}</td><td>${formatPct(r.saving_pct)}</td></tr>`
    )
    .join('');
  $('sensitivityPanel').innerHTML =
    `<table><thead><tr><th>Variável</th><th>Valor</th><th>Total</th><th>Saving %</th></tr></thead><tbody>${rows}</tbody></table><p class="small-note">Mais sensível: ${escapeHtml(state.sensitivity?.most_sensitive_variable || '—')}</p>`;
  renderSensitivityChart(state.sensitivity?.sensitivity_results);
  renderSensitivityMatrix();
}
function getHeatmapClass(savingPct) {
  const v = Number(savingPct);
  if (v >= 5) return 'heatmap-very-good';
  if (v > 1) return 'heatmap-good';
  if (v > -1) return 'heatmap-neutral';
  if (v > -5) return 'heatmap-bad';
  return 'heatmap-very-bad';
}
function renderSensitivityMatrix() {
  const matrix = state.sensitivityMatrix;
  const el = $('sensitivityMatrixPanel');
  if (!el) return;
  if (matrix?.errors?.length) {
    el.innerHTML = `<div class="alert-box warn"><strong>Matriz não exibida</strong><p>${escapeHtml(matrix.errors.join('; '))}</p></div>`;
    return;
  }
  const xValues = matrix?.x_values || [];
  const yValues = matrix?.y_values || [];
  const rows = yValues
    .map((yValue) => {
      const cells = xValues
        .map((xValue) => {
          const cell = (matrix.matrix_results || []).find(
            (r) => String(r.x_value) === String(xValue) && String(r.y_value) === String(yValue)
          );
          const hClass = getHeatmapClass(cell?.saving_pct || 0);
          return `<td class="heatmap-cell ${hClass}">${formatPct(cell?.saving_pct, 1)}<br><span class="small-note" style="color:inherit;opacity:0.8">${formatBRL(cell?.total_with_tax, true)}</span></td>`;
        })
        .join('');
      return `<tr><th>${escapeHtml(String(yValue))}</th>${cells}</tr>`;
    })
    .join('');
  el.innerHTML = `<div class="table-wrap"><table class="sensitivity-matrix executive-table-premium"><thead><tr><th>${escapeHtml(variableLabel(matrix?.y_variable))} / ${escapeHtml(variableLabel(matrix?.x_variable))}</th>${xValues.map((v) => `<th>${escapeHtml(String(v))}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div><p class="small-note">Cada célula mostra o impacto percentual no custo total e o valor final estimado.</p>`;
}
function renderRecommendation() {
  $('recommendationPanel').innerHTML =
    `<div class="recommendation-card"><span class="status-chip ${state.recommendation?.recommendation_status === 'recommended' ? 'status-ok' : state.recommendation?.recommendation_status === 'not_recommended' ? 'status-error' : 'status-warn'}">${escapeHtml(recommendationLabel(state.recommendation?.recommendation_status))}</span><p>${escapeHtml(state.recommendation?.executive_summary)}</p><h4>Razões</h4><ul>${(state.recommendation?.main_reasons || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul><h4>Riscos e próximos passos</h4><ul>${[...(state.recommendation?.main_risks || []), ...(state.recommendation?.next_actions || [])].map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`;
}
function renderReport() {
  $('executiveReportPanel').innerHTML = buildExecutiveReportHtml({
    companyId: state.companyId,
    selectedScenario: state.selection?.selected_scenario,
    recommendation: state.recommendation,
    stress: state.stress,
    robustness: state.robustness,
    audit: state.audit,
    comparison: scenarioComparison(state.selection?.selected_scenario),
    workbookParity: state.workbookParity,
    rankingSensitivity: state.optimizer?.ranking_sensitivity,
  });
}
function renderWorkbookParity() {
  const el = $('workbookParityPanel');
  if (!el) return;
  el.innerHTML = renderWorkbookParityPanel(state.workbookParity);
}
function renderAuditAndExport() {
  $('auditTrailPanel').innerHTML =
    `<pre class="debug-console compact">${escapeHtml(JSON.stringify(state.audit, null, 2))}</pre>`;
  $('exportCenterPanel').innerHTML = (state.exportPackage?.files || [])
    .map(
      (f, idx) =>
        `<button type="button" class="secondary-button export-button" data-export-index="${idx}">${escapeHtml(f.filename)}</button>`
    )
    .join('');
}
function renderAll() {
  renderTabs();
  renderOverview();
  renderWorkbookParity();
  renderTaxPeriods();
  renderStress();
  renderSensitivityPanel();
  renderRecommendation();
  renderReport();
  renderAuditAndExport();
  log('Pipeline de decisão final executado', {
    companyId: state.companyId,
    selected: state.selection?.selected_scenario_id,
    release: state.release,
  });
}
function setCompanyButtonsDisabled(disabled) {
  document.querySelectorAll('[data-company]').forEach((btn) => {
    btn.disabled = disabled;
    btn.style.opacity = disabled ? '0.5' : '';
    btn.title = disabled ? 'Aguarde o carregamento da empresa atual...' : '';
  });
}
export async function loadPhase5Company(companyId) {
  if (state.isLoading) {
    log('loadPhase5Company ignorado — carregamento em andamento', { companyId });
    return;
  }
  state.isLoading = true;
  state.companyId = companyId;
  renderTabs();
  setCompanyButtonsDisabled(true);
  $('phase5Loading').classList.remove('hidden');
  try {
    state.bundle = await loadPhase2Bundle(companyId);
    state.optimizationConfig = loadOptimizationConfig(companyId);
    applyInheritedOptimizationConfig();
    runDecisionPipeline();
    $('phase5Loading').classList.add('hidden');
    renderAll();
  } catch (e) {
    $('phase5Loading').innerHTML =
      `<div class="alert-box error"><strong>Erro</strong><p>${escapeHtml(e.message)}</p></div>`;
    logError('erro', e.message);
  } finally {
    state.isLoading = false;
    setCompanyButtonsDisabled(false);
  }
}
export function setupPhase5() {
  document
    .querySelectorAll('[data-company]')
    .forEach((btn) => btn.addEventListener('click', () => loadPhase5Company(btn.dataset.company)));
  [
    'phase5SelectionMode',
    'phase5StressProfile',
    'phase5SensitivityVariable',
    'phase5SensitivityX',
    'phase5SensitivityY',
    'phase5MaxCandidates',
    'phase5ManualScenarioId',
  ].forEach((id) =>
    $(id)?.addEventListener('change', () => {
      runDecisionPipeline();
      renderAll();
    })
  );
  $('phase5SelectionMode')?.addEventListener('change', () => {
    const isManual = $('phase5SelectionMode').value === 'manual';
    const manualLabel = $('manualScenarioIdLabel');
    if (manualLabel) manualLabel.style.display = isManual ? '' : 'none';
  });
  $('rerunPhase5')?.addEventListener('click', () => {
    runDecisionPipeline();
    renderAll();
  });
  $('exportCenterPanel')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-export-index]');
    if (!btn) return;
    const f = state.exportPackage.files[Number(btn.dataset.exportIndex)];
    triggerBrowserDownload(f.filename, f.content, f.type);
  });

  const loadCurrentCompanyOnRoute = () => {
    if (window.location.hash === '#/homologacao-relatorio') {
      void loadPhase5Company(state.companyId);
    }
  };
  window.addEventListener('hashchange', loadCurrentCompanyOnRoute);
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', loadCurrentCompanyOnRoute, { once: true });
  } else {
    loadCurrentCompanyOnRoute();
  }
}
