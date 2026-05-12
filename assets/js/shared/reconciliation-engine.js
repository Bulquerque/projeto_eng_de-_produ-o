function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function classifyPct(value) {
  if (value == null) return 'pending';
  const absPct = Math.abs(value);
  if (absPct <= 3) return 'aligned';
  if (absPct <= 10) return 'tolerable';
  return 'divergent';
}

function buildMetricRows(simulated = {}, referenceResults = {}) {
  const keys = Object.keys(referenceResults || {});
  if (!keys.length) return [];

  return keys.map((metric) => {
    const simulatedValue = n(simulated[metric]);
    const referenceValue = n(referenceResults[metric]);
    const absoluteError = simulatedValue == null || referenceValue == null ? null : simulatedValue - referenceValue;
    const percentageError = referenceValue === 0 || simulatedValue == null || referenceValue == null
      ? null
      : ((simulatedValue - referenceValue) / referenceValue) * 100;
    return {
      metric,
      reference: referenceValue,
      simulated: simulatedValue,
      absolute_error: absoluteError,
      percentage_error: percentageError,
      status: classifyPct(percentageError)
    };
  });
}

function summarizeRows(rows = []) {
  const numeric = rows.map((row) => n(row?.percentage_error)).filter((value) => value !== null);
  const absValues = numeric.map((value) => Math.abs(value));
  const comparedMetrics = rows.length;
  const missingMetrics = rows.filter((row) => row?.simulated == null || row?.reference == null).length;
  return {
    compared_metrics: comparedMetrics,
    missing_metrics: missingMetrics,
    mean_abs_error_pct: absValues.length ? absValues.reduce((acc, value) => acc + value, 0) / absValues.length : null,
    max_abs_error_pct: absValues.length ? Math.max(...absValues) : null,
    aligned_metrics: rows.filter((row) => row.status === 'aligned').length,
    tolerable_metrics: rows.filter((row) => row.status === 'tolerable').length,
    divergent_metrics: rows.filter((row) => row.status === 'divergent').length
  };
}

function buildOperationalReconciliation(bundle) {
  const costs = bundle?.costs || {};
  const referenceResults = costs?.reference_results || null;
  const simulated = costs?.costs || {};
  const rows = buildMetricRows(simulated, referenceResults || {});
  const summary = summarizeRows(rows);
  const available = rows.length > 0;
  const status = !available ? 'pending' : summary.divergent_metrics > 0 ? 'partial' : 'aligned';
  const label = !available
    ? 'reconciliaçao operacional pendente'
    : summary.divergent_metrics > 0
      ? 'reconciliaçao operacional parcial'
      : 'reconciliaçao operacional alinhada';

  return {
    status,
    label,
    source: costs?.cost_basis || bundle?.base_fit?.reference_source || 'Sem referencia consolidada disponivel.',
    rows,
    summary,
    warnings: available ? [] : ['Sem referencia operacional consolidada para comparar custos.']
  };
}

function buildTaxReconciliation(bundle) {
  const tax = bundle?.tax_results || {};
  const recon = tax?.tax_reconciliation || tax?.tax_results?.tax_reconciliation || bundle?.tax_reconciliation || null;
  if (!recon) {
    return {
      status: 'pending',
      label: 'reconciliaçao tributaria pendente',
      source: 'Sem reconciliacao tributaria disponivel.',
      summary: null,
      warnings: ['Reconciliação tributaria ausente.']
    };
  }
  return {
    status: recon.status || 'pending',
    label: recon.status === 'within_tolerance'
      ? 'reconciliaçao tributaria alinhada'
      : recon.status === 'divergent'
        ? 'reconciliaçao tributaria divergente'
        : 'reconciliaçao tributaria pendente',
    source: 'dados_tributario / scenario_totals',
    summary: recon,
    warnings: recon.warning ? [recon.warning] : []
  };
}

function buildOverallStatus(operational, tax, baseFit) {
  if (operational.status === 'pending' && tax.status === 'pending' && baseFit?.status === 'benchmark_pending') {
    return { status: 'pending', label: 'reconciliaçao plena pendente' };
  }
  if (operational.status === 'aligned' && tax.status === 'within_tolerance') {
    return { status: 'fully_reconciled', label: 'reconciliaçao plena' };
  }
  if (operational.status === 'aligned' && tax.status === 'divergent') {
    return { status: 'partial_tax_divergence', label: 'reconciliaçao operacional completa com divergencia tributaria' };
  }
  if (operational.status === 'partial' || tax.status === 'divergent') {
    return { status: 'partial', label: 'reconciliaçao parcial' };
  }
  return { status: 'pending', label: 'reconciliaçao pendente' };
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
    warnings: [...operational.warnings, ...tax.warnings]
  };
}
