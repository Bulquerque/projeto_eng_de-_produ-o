import { loadPhase2Bundle } from '../shared/data-loader.js';
import { $, escapeHtml, formatBRL, formatNumber, formatPct, metric } from '../shared/common.js';
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
import { renderSensitivityChart, renderStressChart, renderRobustnessChart } from './charts.js';
import { buildWorkbookParitySummary, renderWorkbookParityPanel } from './workbook-parity.js';
import { appendSharedDebugEntry } from '../shared/debug-tools.js';

const state = { companyId: 'empresa1', bundle: null, objective: null, optimizer: null, selection: null, stress: null, sensitivity: null, sensitivityMatrix: null, robustness: null, recommendation: null, audit: null, exportPackage: null, finalQA: null, release: null, workbookParity: null, isLoading: false };
function label(cid) { return cid === 'empresa2' ? 'Empresa 2' : 'Empresa 1'; }
function log(label, obj) { appendSharedDebugEntry({ phase: 'phase5', module: 'phase5-dashboard', level: 'info', event: label, detail: typeof obj === 'string' ? { message: obj } : obj || {} }); const el = $('phase5DebugConsole'); if (el) el.textContent = `${new Date().toLocaleTimeString()} · ${label}\n${typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)}`; }
function logError(label, obj) { appendSharedDebugEntry({ phase: 'phase5', module: 'phase5-dashboard', level: 'error', event: label, detail: typeof obj === 'string' ? { message: obj } : obj || {}, error: typeof obj === 'string' ? new Error(obj) : obj }); const el = $('phase5DebugConsole'); if (el) el.textContent = `${new Date().toLocaleTimeString()} · ${label}\n${typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)}`; }
function defaultObjective() { return buildObjective({ companyId: state.companyId, objectiveName: 'Perfil Final Balanceado', weights: { total_cost: 30, service_quality: 25, operational_risk: 20, tax_impact: 15, inventory_efficiency: 10 } }); }
function constraints() { return { min_active_cds: 1, max_active_cds: 999, max_cd_volume_share: 1, max_risk_level: 'high', allow_tax_disabled: true }; }
function renderTabs() { document.querySelectorAll('[data-company]').forEach(btn => { const active = btn.dataset.company === state.companyId; btn.classList.toggle('active', active); btn.setAttribute('aria-selected', String(active)); }); $('phase5CompanyLabel').textContent = label(state.companyId); }
function baselineResult() { return { scenario_id: state.bundle?.model?.scenario_id, total_with_tax: state.bundle?.costs?.costs?.total_with_tax, costs: state.bundle?.costs?.costs || {}, tax_results: state.bundle?.tax_results?.tax_results || {} }; }
function scenarioComparison(selected) { const base = Number(state.bundle?.costs?.costs?.total_with_tax || 0); const total = Number(selected?.result?.total_with_tax || selected?.total_with_tax || 0); return { baseline_total: base, scenario_total: total, saving_abs: base - total, saving_pct: base ? ((base - total) / base) * 100 : 0 }; }
function blockedDecisionState(message) {
  state.stress = { company_id: state.companyId, scenario_id: null, stress_results: [], summary: { cases_run: 0, cases_positive: 0, cases_negative: 0 }, warnings: [], errors: [message] };
  state.sensitivity = { company_id: state.companyId, scenario_id: null, sensitivity_results: [], most_sensitive_variable: null, warnings: [], errors: [message] };
  state.sensitivityMatrix = { company_id: state.companyId, scenario_id: null, matrix_results: [], warnings: [], errors: [message] };
  state.robustness = { company_id: state.companyId, scenario_id: null, robustness_score: 0, robustness_status: 'low', cases_positive: 0, cases_total: 0, worst_case_saving_pct: 0, alerts: [message], warnings: [], errors: [message] };
  state.recommendation = { company_id: state.companyId, scenario_id: null, recommendation_status: 'not_recommended', objective_id: state.objective?.objective_id || null, executive_summary: message, main_reasons: [], main_risks: [message], next_actions: [], warnings: [], errors: [message] };
  state.audit = buildAuditTrail({ companyId: state.companyId, selectedScenario: null, baselineBundle: state.bundle, objective: state.objective || {}, recommendation: state.recommendation, optimizerResult: state.optimizer });
  state.exportPackage = { export_status: 'blocked', files: [], warnings: [], errors: [message] };
  state.finalQA = runFinalQAChecks({ companyId: state.companyId, bundle: state.bundle, selectedScenario: null, stress: state.stress, recommendation: state.recommendation, audit: state.audit });
  state.release = validateRelease({ finalQA: state.finalQA });
}
function runDecisionPipeline() {
  state.objective = defaultObjective();
  state.workbookParity = buildWorkbookParitySummary(state.bundle);
  state.optimizer = runOptimization({ companyId: state.companyId, baselineBundle: state.bundle, objective: state.objective, constraints: constraints(), optimizerConfig: { method: 'exact_discrete', max_candidates: Number($('phase5MaxCandidates')?.value || 2000), seed: 42 } });
  if (state.optimizer.optimizer_status !== 'success') {
    state.selection = null;
    blockedDecisionState((state.optimizer.errors || ['Falha na otimização exata.']).join('; '));
    return;
  }
  state.selection = selectFinalScenario({ companyId: state.companyId, optimizerResult: state.optimizer, selectionMode: $('phase5SelectionMode')?.value || 'best_by_score', manualScenarioId: $('phase5ManualScenarioId')?.value || null });
  if (!state.selection?.selected_scenario) {
    blockedDecisionState((state.selection?.errors || ['Nenhum cenário pôde ser selecionado.']).join('; '));
    return;
  }
  const selected = state.selection.selected_scenario;
  const scenario = selected?.scenario;
  const quality = selected?.quality || {};
  state.workbookParity = buildWorkbookParitySummary(state.bundle);
  state.stress = runStressTests({ companyId: state.companyId, selectedScenario: scenario, baselineBundle: state.bundle, baselineResult: baselineResult(), stressCases: buildStressCaseLibrary({ companyId: state.companyId, stressProfile: $('phase5StressProfile')?.value || 'standard' }).stress_cases });
  state.sensitivity = runSensitivity({ companyId: state.companyId, selectedScenario: scenario, baselineBundle: state.bundle, sensitivityConfig: { variable: $('phase5SensitivityVariable')?.value || 'freight_multiplier', values: sensitivityValues($('phase5SensitivityVariable')?.value || 'freight_multiplier') } });
  state.sensitivityMatrix = runSensitivityMatrix({ companyId: state.companyId, selectedScenario: scenario, baselineBundle: state.bundle, matrixConfig: { xVariable: $('phase5SensitivityX')?.value || 'freight_multiplier', yVariable: $('phase5SensitivityY')?.value || 'demand_multiplier', xValues: sensitivityValues($('phase5SensitivityX')?.value || 'freight_multiplier', true), yValues: sensitivityValues($('phase5SensitivityY')?.value || 'demand_multiplier', true) } });
  state.robustness = calculateRobustness({ companyId: state.companyId, scenarioId: scenario?.scenario_id, stressResults: state.stress.stress_results, quality });
  const comparison = scenarioComparison(selected);
  state.recommendation = buildRecommendation({ companyId: state.companyId, selectedScenario: selected, comparison, quality, robustness: state.robustness, objective: state.objective });
  state.audit = buildAuditTrail({ companyId: state.companyId, selectedScenario: selected, baselineBundle: state.bundle, objective: state.objective, recommendation: state.recommendation, optimizerResult: state.optimizer });
  const decisionPackage = { company_id: state.companyId, selected_scenario_id: state.selection.selected_scenario_id, baseline_scenario_id: state.bundle.model.scenario_id, objective: state.objective, recommendation: state.recommendation, stress_test: state.stress.summary, robustness: state.robustness, audit: state.audit };
  state.exportPackage = buildExportPackage({ companyId: state.companyId, decisionPackage, stress: state.stress, sensitivity: state.sensitivity, sensitivityMatrix: state.sensitivityMatrix, audit: state.audit, recommendation: state.recommendation, selectedScenario: selected, comparison, robustness: state.robustness, workbookParity: state.workbookParity });
  state.finalQA = runFinalQAChecks({ companyId: state.companyId, bundle: state.bundle, selectedScenario: selected, stress: state.stress, recommendation: state.recommendation, audit: state.audit });
  state.release = validateRelease({ finalQA: state.finalQA, exportPackage: state.exportPackage, decisionPackage });
}
function sensitivityValues(variable, compact = false) { if (variable === 'inventory_days') return compact ? [30, 45, 60] : [30, 45, 60]; if (variable === 'wacc') return compact ? [0.10, 0.15, 0.20] : [0.10, 0.15, 0.20]; return compact ? [0.9, 1.0, 1.1] : [0.9, 1.0, 1.1, 1.2]; }
function variableLabel(variable) { return { freight_multiplier: 'Frete', demand_multiplier: 'Demanda', inventory_days: 'Estoque', wacc: 'WACC' }[variable] || variable; }
function recommendationLabel(status) { return { recommended: 'recomendado', not_recommended: 'não recomendado', review_required: 'revisar' }[status] || status || '—'; }
function releaseLabel(status) { return { ready: 'pronto', blocked: 'bloqueado', warning: 'atenção' }[status] || status || '—'; }
function renderOverview() {
  const selected = state.selection?.selected_scenario; const comp = scenarioComparison(selected);
  $('phase5OverviewCards').innerHTML = [
    metric('Cenário selecionado', selected?.scenario_name || selected?.scenario_id || '—', state.selection?.selection_reason || ''),
    metric('Total cenário', formatBRL(selected?.result?.total_with_tax, true), 'estimado pelo simulador'),
    metric('Saving vs baseline', formatBRL(comp.saving_abs, true), formatPct(comp.saving_pct)),
    metric('Robustez', `${formatNumber(state.robustness?.robustness_score, 0)}/100`, state.robustness?.robustness_status || '—'),
    metric('Recomendação', recommendationLabel(state.recommendation?.recommendation_status), 'status final'),
    metric('Release', releaseLabel(state.release?.release_status), state.release?.ready_to_deliver ? 'pronto' : 'com bloqueios')
  ].join('');
  renderRobustnessChart(state.robustness?.robustness_score);
  renderFinalSituationTable(selected, comp);
}
function renderFinalSituationTable(selected, comp) {
  const quality = selected?.quality || {};
  const rows = [
    ['Empresa', label(state.companyId)],
    ['Baseline', state.bundle?.model?.scenario_id || '—'],
    ['Cenário selecionado', selected?.scenario_name || selected?.scenario_id || '—'],
    ['Total baseline', formatBRL(comp.baseline_total, true)],
    ['Total final', formatBRL(comp.scenario_total, true)],
    ['Saving absoluto', formatBRL(comp.saving_abs, true)],
    ['Saving percentual', formatPct(comp.saving_pct)],
    ['Robustez', `${formatNumber(state.robustness?.robustness_score, 0)}/100`],
    ['Risco', quality.risk_level || '—'],
    ['Recomendação', recommendationLabel(state.recommendation?.recommendation_status)]
  ];
  const el = $('finalSituationTable');
  if (el) el.innerHTML = `<table><thead><tr><th>Indicador</th><th>Valor</th></tr></thead><tbody>${rows.map(r => `<tr><td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1])}</td></tr>`).join('')}</tbody></table>`;
}
function renderStress() {
  const rows = (state.stress?.stress_results || []).map(r => `<tr><td>${escapeHtml(r.case_name)}</td><td>${formatBRL(r.total_with_tax, true)}</td><td>${formatBRL(r.saving_vs_baseline, true)}</td><td>${formatPct(r.saving_pct)}</td><td>${r.scenario_still_better_than_baseline ? 'sim' : 'não'}</td></tr>`).join('');
  $('stressPanel').innerHTML = `<table><thead><tr><th>Caso</th><th>Total</th><th>Saving</th><th>Saving %</th><th>Melhor que base?</th></tr></thead><tbody>${rows}</tbody></table>`;
  renderStressChart(state.stress?.stress_results);
}
function renderSensitivityPanel() {
  const rows = (state.sensitivity?.sensitivity_results || []).map(r => `<tr><td>${escapeHtml(r.variable)}</td><td>${escapeHtml(r.value)}</td><td>${formatBRL(r.total_with_tax, true)}</td><td>${formatPct(r.saving_pct)}</td></tr>`).join('');
  $('sensitivityPanel').innerHTML = `<table><thead><tr><th>Variável</th><th>Valor</th><th>Total</th><th>Saving %</th></tr></thead><tbody>${rows}</tbody></table><p class="small-note">Mais sensível: ${escapeHtml(state.sensitivity?.most_sensitive_variable || '—')}</p>`;
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
  const rows = yValues.map(yValue => {
    const cells = xValues.map(xValue => {
      const cell = (matrix.matrix_results || []).find(r => String(r.x_value) === String(xValue) && String(r.y_value) === String(yValue));
      const hClass = getHeatmapClass(cell?.saving_pct || 0);
      return `<td class="heatmap-cell ${hClass}">${formatPct(cell?.saving_pct, 1)}<br><span class="small-note" style="color:inherit;opacity:0.8">${formatBRL(cell?.total_with_tax, true)}</span></td>`;
    }).join('');
    return `<tr><th>${escapeHtml(String(yValue))}</th>${cells}</tr>`;
  }).join('');
  el.innerHTML = `<div class="table-wrap"><table class="sensitivity-matrix executive-table-premium"><thead><tr><th>${escapeHtml(variableLabel(matrix?.y_variable))} / ${escapeHtml(variableLabel(matrix?.x_variable))}</th>${xValues.map(v => `<th>${escapeHtml(String(v))}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div><p class="small-note">Cada célula mostra o impacto percentual no custo total e o valor final estimado.</p>`;
}
function renderRecommendation() {
  $('recommendationPanel').innerHTML = `<div class="recommendation-card"><span class="status-chip ${state.recommendation?.recommendation_status === 'recommended' ? 'status-ok' : state.recommendation?.recommendation_status === 'not_recommended' ? 'status-error' : 'status-warn'}">${escapeHtml(recommendationLabel(state.recommendation?.recommendation_status))}</span><p>${escapeHtml(state.recommendation?.executive_summary)}</p><h4>Razões</h4><ul>${(state.recommendation?.main_reasons || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul><h4>Riscos e próximos passos</h4><ul>${[...(state.recommendation?.main_risks || []), ...(state.recommendation?.next_actions || [])].map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`;
}
function renderReport() { $('executiveReportPanel').innerHTML = buildExecutiveReportHtml({ companyId: state.companyId, selectedScenario: state.selection?.selected_scenario, recommendation: state.recommendation, stress: state.stress, robustness: state.robustness, audit: state.audit, comparison: scenarioComparison(state.selection?.selected_scenario), workbookParity: state.workbookParity }); }
function renderWorkbookParity() {
  const el = $('workbookParityPanel');
  if (!el) return;
  el.innerHTML = renderWorkbookParityPanel(state.workbookParity);
}
function renderAuditAndExport() {
  $('auditTrailPanel').innerHTML = `<pre class="debug-console compact">${escapeHtml(JSON.stringify(state.audit, null, 2))}</pre>`;
  $('exportCenterPanel').innerHTML = (state.exportPackage?.files || []).map((f, idx) => `<button type="button" class="secondary-button export-button" data-export-index="${idx}">${escapeHtml(f.filename)}</button>`).join('');
}
function renderAll() { renderTabs(); renderOverview(); renderWorkbookParity(); renderStress(); renderSensitivityPanel(); renderRecommendation(); renderReport(); renderAuditAndExport(); log('Pipeline Fase 5 executado', { companyId: state.companyId, selected: state.selection?.selected_scenario_id, release: state.release }); }
function setCompanyButtonsDisabled(disabled) { document.querySelectorAll('[data-company]').forEach(btn => { btn.disabled = disabled; btn.style.opacity = disabled ? '0.5' : ''; btn.title = disabled ? 'Aguarde o carregamento da empresa atual...' : ''; }); }
export async function loadPhase5Company(companyId) { if (state.isLoading) { log('loadPhase5Company ignorado — carregamento em andamento', { companyId }); return; } state.isLoading = true; state.companyId = companyId; renderTabs(); setCompanyButtonsDisabled(true); $('phase5Loading').classList.remove('hidden'); try { state.bundle = await loadPhase2Bundle(companyId); runDecisionPipeline(); $('phase5Loading').classList.add('hidden'); renderAll(); } catch (e) { $('phase5Loading').innerHTML = `<div class="alert-box error"><strong>Erro</strong><p>${escapeHtml(e.message)}</p></div>`; logError('erro', e.message); } finally { state.isLoading = false; setCompanyButtonsDisabled(false); } }
export function setupPhase5() {
  document.querySelectorAll('[data-company]').forEach(btn => btn.addEventListener('click', () => loadPhase5Company(btn.dataset.company)));
  ['phase5SelectionMode','phase5StressProfile','phase5SensitivityVariable','phase5SensitivityX','phase5SensitivityY','phase5MaxCandidates','phase5ManualScenarioId'].forEach(id => $(id)?.addEventListener('change', () => { runDecisionPipeline(); renderAll(); }));
  $('phase5SelectionMode')?.addEventListener('change', () => { const isManual = $('phase5SelectionMode').value === 'manual'; const manualLabel = $('manualScenarioIdLabel'); if (manualLabel) manualLabel.style.display = isManual ? '' : 'none'; });
  $('rerunPhase5')?.addEventListener('click', () => { runDecisionPipeline(); renderAll(); });
  $('exportCenterPanel')?.addEventListener('click', e => { const btn = e.target.closest('[data-export-index]'); if (!btn) return; const f = state.exportPackage.files[Number(btn.dataset.exportIndex)]; triggerBrowserDownload(f.filename, f.content, f.type); });
  loadPhase5Company('empresa1');
}
