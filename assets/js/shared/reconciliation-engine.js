import { MODEL_ASSUMPTIONS } from './model-assumptions.js';

function n(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function classifyReconciliationPct(value) {
  if (value == null) return 'pending';
  const absPct = Math.abs(value);
  if (absPct <= MODEL_ASSUMPTIONS.reconciliation.aligned_max_abs_error_pct) return 'aligned';
  if (absPct <= MODEL_ASSUMPTIONS.reconciliation.tolerable_max_abs_error_pct) return 'tolerable';
  return 'divergent';
}

function buildMetricRows(simulated = {}, referenceResults = {}) {
  const keys = Object.keys(referenceResults || {});
  if (!keys.length) return [];

  return keys.map((metric) => {
    const simulatedValue = n(simulated[metric]);
    const referenceValue = n(referenceResults[metric]);
    const absoluteError =
      simulatedValue == null || referenceValue == null ? null : simulatedValue - referenceValue;
    const percentageError =
      referenceValue === 0 || simulatedValue == null || referenceValue == null
        ? null
        : ((simulatedValue - referenceValue) / referenceValue) * 100;
    return {
      metric,
      reference: referenceValue,
      simulated: simulatedValue,
      absolute_error: absoluteError,
      percentage_error: percentageError,
      status: classifyReconciliationPct(percentageError),
    };
  });
}

function summarizeRows(rows = []) {
  const numeric = rows.map((row) => n(row?.percentage_error)).filter((value) => value !== null);
  const absValues = numeric.map((value) => Math.abs(value));
  const comparedMetrics = rows.length;
  const missingMetrics = rows.filter(
    (row) => row?.simulated == null || row?.reference == null
  ).length;
  return {
    compared_metrics: comparedMetrics,
    missing_metrics: missingMetrics,
    mean_abs_error_pct: absValues.length
      ? absValues.reduce((acc, value) => acc + value, 0) / absValues.length
      : null,
    max_abs_error_pct: absValues.length ? Math.max(...absValues) : null,
    aligned_metrics: rows.filter((row) => row.status === 'aligned').length,
    tolerable_metrics: rows.filter((row) => row.status === 'tolerable').length,
    divergent_metrics: rows.filter((row) => row.status === 'divergent').length,
  };
}

function buildOperationalReconciliation(bundle) {
  const costs = bundle?.costs || {};
  const referenceResults = costs?.reference_results || null;
  const simulated = costs?.costs || {};
  const rows = buildMetricRows(simulated, referenceResults || {});
  const summary = summarizeRows(rows);
  const available = rows.length > 0;
  const status = !available
    ? 'pending'
    : summary.divergent_metrics > 0
      ? 'divergent'
      : summary.tolerable_metrics > 0
        ? 'tolerable'
        : 'aligned';
  const label = !available
    ? 'reconciliação operacional pendente'
    : status === 'divergent'
      ? 'reconciliação operacional divergente'
      : status === 'tolerable'
        ? 'reconciliação operacional tolerável'
        : 'reconciliação operacional alinhada';

  return {
    status,
    label,
    source:
      costs?.cost_basis ||
      bundle?.base_fit?.reference_source ||
      'Sem referencia consolidada disponivel.',
    rows,
    summary,
    warnings: available ? [] : ['Sem referencia operacional consolidada para comparar custos.'],
  };
}

function buildTaxReconciliation(bundle) {
  const tax = bundle?.tax_results || {};
  const recon =
    tax?.tax_reconciliation ||
    tax?.tax_results?.tax_reconciliation ||
    bundle?.tax_reconciliation ||
    null;
  if (!recon) {
    return {
      status: 'pending',
      label: 'reconciliação tributária pendente',
      source: 'Sem reconciliação tributária disponível.',
      summary: null,
      warnings: ['Reconciliação tributaria ausente.'],
    };
  }
  const rawStatus = recon.status || 'pending';
  const status =
    rawStatus === 'within_tolerance' || rawStatus === 'aligned'
      ? 'aligned'
      : rawStatus === 'divergent'
        ? 'divergent'
        : 'pending';
  return {
    status,
    raw_status: rawStatus,
    label:
      status === 'aligned'
        ? 'reconciliação tributária alinhada'
        : recon.status === 'divergent'
          ? 'reconciliação tributária divergente'
          : 'reconciliação tributária pendente',
    source: 'dados_tributario / scenario_totals',
    summary: recon,
    warnings: recon.warning ? [recon.warning] : [],
  };
}

function buildOverallStatus(operational, tax, baseFit) {
  if (
    operational.status === 'pending' &&
    tax.status === 'pending' &&
    baseFit?.status === 'benchmark_pending'
  ) {
    return { status: 'pending', label: 'reconciliação plena pendente' };
  }
  if (operational.status === 'aligned' && tax.status === 'aligned') {
    return { status: 'aligned', label: 'reconciliação plena alinhada' };
  }
  if (operational.status === 'divergent' || tax.status === 'divergent') {
    return { status: 'divergent', label: 'reconciliação divergente' };
  }
  if (operational.status === 'tolerable') {
    return { status: 'tolerable', label: 'reconciliação tolerável' };
  }
  return { status: 'pending', label: 'reconciliação pendente' };
}

export function buildBundleReconciliation(bundle = {}) {
  const operational = buildOperationalReconciliation(bundle);
  const tax = buildTaxReconciliation(bundle);
  const overall = buildOverallStatus(operational, tax, bundle?.base_fit || {});
  return {
    company_id: bundle?.model?.company_id || null,
    scenario_id: bundle?.model?.scenario_id || null,
    operational,
    tax,
    overall,
    warnings: [...operational.warnings, ...tax.warnings],
  };
}
