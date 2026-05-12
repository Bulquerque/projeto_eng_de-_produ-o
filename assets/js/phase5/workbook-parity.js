import { escapeHtml, formatBRL, formatPct, renderTable } from '../shared/common.js';
import { buildBundleReconciliation } from '../shared/reconciliation-engine.js';

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeInput(input) {
  if (input && typeof input === 'object' && (input.base_fit || input.costs || input.model)) {
    return { fit: input.base_fit || {}, costs: input.costs || null, reconciliation: input.reconciliation || buildBundleReconciliation(input) };
  }
  return { fit: input || {}, costs: null, reconciliation: null };
}

function fitRows(fit, costs, reconciliation) {
  const directRows = Array.isArray(fit?.errors_by_metric) ? fit.errors_by_metric : [];
  if (directRows.length) return directRows;
  const operationalRows = Array.isArray(reconciliation?.operational?.rows) ? reconciliation.operational.rows : [];
  if (operationalRows.length) return operationalRows;
  const referenceResults = costs?.reference_results || null;
  const simulated = costs?.costs || {};
  if (!referenceResults || !Object.keys(referenceResults).length) return [];

  return Object.entries(referenceResults).map(([metric, reference]) => {
    const simulatedValue = n(simulated[metric]);
    const referenceValue = n(reference);
    const percentageError = referenceValue === 0 || simulatedValue == null || referenceValue == null
      ? null
      : ((simulatedValue - referenceValue) / referenceValue) * 100;
    const absPct = percentageError == null ? null : Math.abs(percentageError);
    return {
      metric,
      reference: referenceValue,
      simulated: simulatedValue,
      absolute_error: simulatedValue == null || referenceValue == null ? null : simulatedValue - referenceValue,
      percentage_error: percentageError,
      status: absPct == null ? 'sem_referencia' : absPct <= 3 ? 'OK' : absPct <= 10 ? 'atenção' : 'alto_desvio'
    };
  });
}

function statusLabel(fit, hasRealComparison, costs = null) {
  if (!fit) return 'sem referência';
  if (fit.status === 'benchmark_pending') {
    if (hasRealComparison) return 'comparação real disponível';
    return costs?.cost_basis === 'computed_proxy' ? 'baseline estrutural disponível' : 'benchmark pendente';
  }
  return String(fit.status || 'paridade disponível');
}

function summarizeRows(rows) {
  const numeric = rows
    .map((row) => n(row?.percentage_error))
    .filter((value) => value !== null);

  if (!numeric.length) {
    return {
      compared_metrics: 0,
      mean_abs_error_pct: null,
      max_abs_error_pct: null
    };
  }

  const absValues = numeric.map((value) => Math.abs(value));
  const total = absValues.reduce((acc, value) => acc + value, 0);

  return {
    compared_metrics: absValues.length,
    mean_abs_error_pct: total / absValues.length,
    max_abs_error_pct: Math.max(...absValues)
  };
}

export function buildWorkbookParitySummary(input) {
  const { fit, costs, reconciliation } = normalizeInput(input);
  const rows = fitRows(fit, costs, reconciliation);
  const summary = summarizeRows(rows);
  const hasDirectBenchmark = Array.isArray(fit?.errors_by_metric) && fit.errors_by_metric.length > 0;
  const hasRealComparison = rows.length > 0 && !hasDirectBenchmark && Boolean((reconciliation?.operational?.rows || []).length || costs?.reference_results);
  const hasProxyBaseline = fit.status === 'benchmark_pending' && costs?.cost_basis === 'computed_proxy';
  const overallStatus = reconciliation?.overall || null;
  const taxStatus = reconciliation?.tax || null;

  return {
    available: rows.length > 0,
    status: fit.status || 'benchmark_pending',
    status_label: hasProxyBaseline ? 'baseline estrutural disponível' : (overallStatus?.label || statusLabel(fit, hasRealComparison, costs)),
    score: fit.base_fit_score ?? null,
    reference_source: fit.reference_source || reconciliation?.operational?.source || costs?.cost_basis || 'Sem referência consolidada disponível.',
    comparison_mode: hasRealComparison ? 'reference_results' : (hasProxyBaseline ? 'proxy_baseline' : (Array.isArray(fit?.errors_by_metric) && fit.errors_by_metric.length ? 'base_fit' : 'pending')),
    reconciliation_status: overallStatus?.status || 'pending',
    reconciliation_label: overallStatus?.label || 'reconciliaçao pendente',
    operational_status: reconciliation?.operational?.status || (hasRealComparison ? 'aligned' : 'pending'),
    tax_status: taxStatus?.status || 'pending',
    rows,
    summary
  };
}

export function renderWorkbookParityPanel(parity) {
  if (!parity) {
    return '<p class="benchmark-pending">Paridade indisponível nesta execução.</p>';
  }

  const score = parity.score == null ? 'pendente' : `${parity.score}/100`;
  const summary = parity.summary || {};
  const rows = parity.rows || [];
  const summaryCards = [
    ['Status', parity.status_label || '—'],
    ['Base Fit Score', score],
    ['Métricas comparadas', String(summary.compared_metrics ?? 0)],
    ['Erro médio absoluto', summary.mean_abs_error_pct == null ? '—' : formatPct(summary.mean_abs_error_pct, 2)],
    ['Maior desvio', summary.max_abs_error_pct == null ? '—' : formatPct(summary.max_abs_error_pct, 2)],
    ['Fonte', parity.reference_source || '—']
  ];

  return `
    <div class="fit-score-layout">
      <div class="fit-score-card ${parity.available ? 'status-ok' : 'status-warn'}">
        <span class="metric-label">Paridade com workbook</span>
        <strong class="fit-score-value">${escapeHtml(score)}</strong>
        <span class="status-chip ${parity.available ? 'status-ok' : 'status-warn'}">${escapeHtml(parity.status_label || '—')}</span>
        <p>${escapeHtml(parity.reference_source || 'Sem referência consolidada disponível.')}</p>
        <p class="small-note">Status geral: ${escapeHtml(parity.reconciliation_label || 'reconciliação pendente')}</p>
        ${parity.comparison_mode === 'reference_results' ? '<p class="small-note">Comparação real exibida a partir da referência canônica do workbook; o Base Fit Score oficial continua pendente.</p>' : ''}
        ${parity.comparison_mode === 'proxy_baseline' ? '<p class="small-note">Baseline estrutural proxy calculado a partir de demanda, distância e premissas; o Base Fit histórico permanece pendente.</p>' : ''}
      </div>
      <div class="fit-table-wrap">
        ${renderTable(summaryCards.map(([metric, value]) => ({ metric, value })), [
          { label: 'Indicador', value: 'metric' },
          { label: 'Valor', value: 'value' }
        ], 20)}
      </div>
    </div>
    <div class="table-wrap" style="margin-top: 12px;">
      ${rows.length ? renderTable(rows, [
        { label: 'Métrica', value: 'metric' },
        { label: 'Referência workbook', value: (row) => formatBRL(row.reference, true) },
        { label: 'Simulado', value: (row) => formatBRL(row.simulated, true) },
        { label: 'Erro (%)', value: (row) => (row.percentage_error == null ? '—' : formatPct(row.percentage_error, 2)) },
        { label: 'Status', value: 'status' }
      ], 20) : '<p class="benchmark-pending">Sem métricas de workbook consolidadas para exibir.</p>'}
    </div>
  `;
}
