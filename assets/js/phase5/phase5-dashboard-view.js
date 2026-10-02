import { $, escapeHtml, formatBRL, formatNumber, formatPct, metric } from '../core/common.js';
import { buildExecutiveReportHtml } from './executive-report-builder.js';
import { renderSensitivityChart, renderStressChart, renderRobustnessChart } from './charts.js';
import { renderFinalSituationTableHtml } from './final-situation-view.js';
import { renderTaxPeriodsHtml } from './tax-periods-view.js';
import { renderWorkbookParityPanel } from './workbook-parity.js';

function label(companyId) {
  return companyId === 'empresa2' ? 'Empresa 2' : 'Empresa 1';
}

function formatOptionalBRL(value, compact = false) {
  return value === null || value === undefined || value === '' ? '—' : formatBRL(value, compact);
}

function formatOptionalPct(value, digits = 1) {
  return value === null || value === undefined || value === '' ? '—' : formatPct(value, digits);
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

function getHeatmapClass(savingPct) {
  const value = Number(savingPct);
  if (value >= 5) return 'heatmap-very-good';
  if (value > 1) return 'heatmap-good';
  if (value > -1) return 'heatmap-neutral';
  if (value > -5) return 'heatmap-bad';
  return 'heatmap-very-bad';
}

export function renderPhase5CompanyTabs(companyId) {
  document.querySelectorAll('[data-company]').forEach((button) => {
    const active = button.dataset.company === companyId;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $('phase5CompanyLabel').textContent = label(companyId);
}

export function renderPhase5Dashboard(state, scenarioComparison, charts = {}) {
  const chartRenderers = {
    renderSensitivityChart,
    renderStressChart,
    renderRobustnessChart,
    ...charts,
  };

  function renderOverview() {
    const selected = state.selection?.selected_scenario;
    const comparison = scenarioComparison(selected);
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
        formatOptionalBRL(comparison.saving_abs, true),
        formatOptionalPct(comparison.saving_pct)
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
    chartRenderers.renderRobustnessChart(state.robustness?.robustness_score);
    renderFinalSituationTable(selected, comparison);
  }

  function renderFinalSituationTable(selected, comparison) {
    const element = $('finalSituationTable');
    if (!element) return;
    element.innerHTML = renderFinalSituationTableHtml({
      companyLabel: label(state.companyId),
      baselineId: state.bundle?.model?.scenario_id,
      selected,
      comparison,
      robustness: state.robustness,
      recommendationLabel: recommendationLabel(state.recommendation?.recommendation_status),
    });
  }

  function renderTaxPeriods() {
    const element = $('taxPeriodsPanel');
    if (!element) return;
    const tax = state.selection?.selected_scenario?.result?.tax_results || {};
    const contract = tax.tax_period_contract || tax.metadata?.tax_period_contract || {};
    element.innerHTML = renderTaxPeriodsHtml(contract);
  }

  function renderStress() {
    const rows = (state.stress?.stress_results || [])
      .map(
        (result) =>
          `<tr><td>${escapeHtml(result.case_name)}</td><td>${formatBRL(result.total_with_tax, true)}</td><td>${formatBRL(result.saving_vs_baseline, true)}</td><td>${formatPct(result.saving_pct)}</td><td>${result.scenario_still_better_than_baseline ? 'sim' : 'não'}</td><td>${escapeHtml(result.data_quality_status || 'complete')}</td></tr>`
      )
      .join('');
    $('stressPanel').innerHTML =
      `<table><thead><tr><th>Caso</th><th>Total</th><th>Saving</th><th>Saving %</th><th>Melhor que base?</th><th>Qualidade dos dados</th></tr></thead><tbody>${rows}</tbody></table><p class="small-note">Casos com cobertura fiscal parcial permanecem disponíveis para leitura exploratória.</p>`;
    chartRenderers.renderStressChart(state.stress?.stress_results);
  }

  function renderSensitivityPanel() {
    const rows = (state.sensitivity?.sensitivity_results || [])
      .map(
        (result) =>
          `<tr><td>${escapeHtml(result.variable)}</td><td>${escapeHtml(result.value)}</td><td>${formatBRL(result.total_with_tax, true)}</td><td>${formatPct(result.saving_pct)}</td></tr>`
      )
      .join('');
    $('sensitivityPanel').innerHTML =
      `<table><thead><tr><th>Variável</th><th>Valor</th><th>Total</th><th>Saving %</th></tr></thead><tbody>${rows}</tbody></table><p class="small-note">Mais sensível: ${escapeHtml(state.sensitivity?.most_sensitive_variable || '—')}</p>`;
    chartRenderers.renderSensitivityChart(state.sensitivity?.sensitivity_results);
    renderSensitivityMatrix();
  }

  function renderSensitivityMatrix() {
    const matrix = state.sensitivityMatrix;
    const element = $('sensitivityMatrixPanel');
    if (!element) return;
    if (matrix?.errors?.length) {
      element.innerHTML = `<div class="alert-box warn"><strong>Matriz não exibida</strong><p>${escapeHtml(matrix.errors.join('; '))}</p></div>`;
      return;
    }
    const xValues = matrix?.x_values || [];
    const yValues = matrix?.y_values || [];
    const rows = yValues
      .map((yValue) => {
        const cells = xValues
          .map((xValue) => {
            const cell = (matrix.matrix_results || []).find(
              (result) =>
                String(result.x_value) === String(xValue) &&
                String(result.y_value) === String(yValue)
            );
            const heatmapClass = getHeatmapClass(cell?.saving_pct || 0);
            return `<td class="heatmap-cell ${heatmapClass}">${formatPct(cell?.saving_pct, 1)}<br><span class="small-note" style="color:inherit;opacity:0.8">${formatBRL(cell?.total_with_tax, true)}</span></td>`;
          })
          .join('');
        return `<tr><th>${escapeHtml(String(yValue))}</th>${cells}</tr>`;
      })
      .join('');
    element.innerHTML = `<div class="table-wrap"><table class="sensitivity-matrix executive-table-premium"><thead><tr><th>${escapeHtml(variableLabel(matrix?.y_variable))} / ${escapeHtml(variableLabel(matrix?.x_variable))}</th>${xValues.map((value) => `<th>${escapeHtml(String(value))}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div><p class="small-note">Cada célula mostra o impacto percentual no custo total e o valor final estimado.</p>`;
  }

  function renderRecommendation() {
    $('recommendationPanel').innerHTML =
      `<div class="recommendation-card"><span class="status-chip ${state.recommendation?.recommendation_status === 'recommended' ? 'status-ok' : state.recommendation?.recommendation_status === 'not_recommended' ? 'status-error' : 'status-warn'}">${escapeHtml(recommendationLabel(state.recommendation?.recommendation_status))}</span><p>${escapeHtml(state.recommendation?.executive_summary)}</p><h4>Razões</h4><ul>${(state.recommendation?.main_reasons || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><h4>Riscos e próximos passos</h4><ul>${[...(state.recommendation?.main_risks || []), ...(state.recommendation?.next_actions || [])].map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`;
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
    const element = $('workbookParityPanel');
    if (element) element.innerHTML = renderWorkbookParityPanel(state.workbookParity);
  }

  function renderAuditAndExport() {
    $('auditTrailPanel').innerHTML =
      `<pre class="debug-console compact">${escapeHtml(JSON.stringify(state.audit, null, 2))}</pre>`;
    $('exportCenterPanel').innerHTML = (state.exportPackage?.files || [])
      .map(
        (file, index) =>
          `<button type="button" class="secondary-button export-button" data-export-index="${index}">${escapeHtml(file.filename)}</button>`
      )
      .join('');
  }

  renderPhase5CompanyTabs(state.companyId);
  renderOverview();
  renderWorkbookParity();
  renderTaxPeriods();
  renderStress();
  renderSensitivityPanel();
  renderRecommendation();
  renderReport();
  renderAuditAndExport();
}
