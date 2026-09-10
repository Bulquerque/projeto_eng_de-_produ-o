/**
 * Normalizes provenance and evidence quality without changing model values.
 *
 * This module is deliberately descriptive: it never turns a proxy into an
 * observed value and never manufactures a confidence interval. Consumers can
 * use the report to gate recommendations and to explain the result.
 */

export const EVIDENCE_CLASSES = Object.freeze({
  OBSERVED: 'observed',
  PARTIALLY_OBSERVED: 'partially_observed',
  PROXY: 'proxy',
  FALLBACK: 'fallback',
  PARAMETER: 'parameter',
  PROJECTION: 'projection',
  RECONCILED: 'reconciled',
  UNKNOWN: 'unknown',
});

const CLASS_WEIGHTS = Object.freeze({
  [EVIDENCE_CLASSES.OBSERVED]: 1,
  [EVIDENCE_CLASSES.RECONCILED]: 0.85,
  [EVIDENCE_CLASSES.PARTIALLY_OBSERVED]: 0.65,
  [EVIDENCE_CLASSES.PARAMETER]: 0.45,
  [EVIDENCE_CLASSES.PROXY]: 0.35,
  [EVIDENCE_CLASSES.PROJECTION]: 0.25,
  [EVIDENCE_CLASSES.FALLBACK]: 0.15,
  [EVIDENCE_CLASSES.UNKNOWN]: 0,
});

function finiteRatio(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeClass(value) {
  return Object.values(EVIDENCE_CLASSES).includes(value) ? value : EVIDENCE_CLASSES.UNKNOWN;
}

function item({ id, label, classification, coverage = 0, source = null, notes = [] }) {
  const normalized = normalizeClass(classification);
  return {
    id,
    label,
    classification: normalized,
    coverage: finiteRatio(coverage),
    evidence_strength: CLASS_WEIGHTS[normalized],
    source,
    notes: Array.isArray(notes) ? notes : [String(notes)],
  };
}

function weightedAverage(items) {
  const valid = items.filter((entry) => entry && Number.isFinite(entry.evidence_strength));
  if (!valid.length) return 0;
  const totalWeight = valid.reduce((sum, entry) => sum + entry.coverage, 0);
  if (!totalWeight) return 0;
  return (
    valid.reduce((sum, entry) => sum + entry.evidence_strength * entry.coverage, 0) / totalWeight
  );
}

function fallbackProfile(diagnostics = {}) {
  const rates = Object.values(diagnostics.fallback_rates || {})
    .map(Number)
    .filter(Number.isFinite);
  return {
    rates,
    maxRate: rates.length ? Math.max(...rates) : 0,
  };
}

function buildDistributionEvidence(diagnostics, maxFallbackRate) {
  const eligibleCount = Number(
    diagnostics.distribution_eligible_flow_count || diagnostics.flow_count || 0
  );
  const observedCount = Number(diagnostics.distribution_observed_flow_count || 0);
  const observedCoverage = eligibleCount ? observedCount / eligibleCount : 0;
  return item({
    id: 'distribution',
    label: 'Distribuição',
    classification:
      maxFallbackRate >= 0.5
        ? EVIDENCE_CLASSES.FALLBACK
        : diagnostics.source_classification?.includes('observed')
          ? EVIDENCE_CLASSES.PARTIALLY_OBSERVED
          : EVIDENCE_CLASSES.UNKNOWN,
    coverage:
      diagnostics.distribution_eligible_flow_count != null
        ? observedCoverage
        : diagnostics.flow_count
          ? Math.max(0, 1 - maxFallbackRate)
          : 0,
    source: diagnostics.proxy_sources || null,
    notes: diagnostics.fallback_rates ? ['Cobertura física registrada por fluxo.'] : [],
  });
}

function buildTransferEvidence({ diagnostics, transferProxy, maxFallbackRate }) {
  return item({
    id: 'transfer',
    label: 'Transferência',
    classification:
      maxFallbackRate >= 0.25
        ? EVIDENCE_CLASSES.PARTIALLY_OBSERVED
        : transferProxy
          ? EVIDENCE_CLASSES.PROXY
          : EVIDENCE_CLASSES.OBSERVED,
    coverage: diagnostics.flow_count
      ? Math.max(0, 1 - Number(diagnostics.fallback_rates?.transfer_fallback || 0))
      : 0,
    source: transferProxy || diagnostics.proxy_sources || null,
    notes: transferProxy ? ['O valor não é uma tarifa histórica própria da empresa.'] : [],
  });
}

function buildTaxEvidence({
  taxResults,
  taxCoverage,
  fiscalCoverage,
  fiscalClassificationCoverage,
}) {
  const taxProxyFlows = Number(taxCoverage.proxy_flow_count || 0);
  const classification =
    fiscalClassificationCoverage === 0
      ? EVIDENCE_CLASSES.PROXY
      : taxProxyFlows > 0
        ? EVIDENCE_CLASSES.PARTIALLY_OBSERVED
        : taxResults.tax_reconciliation
          ? EVIDENCE_CLASSES.RECONCILED
          : EVIDENCE_CLASSES.PARAMETER;
  return item({
    id: 'tax',
    label: 'Tributação',
    classification,
    coverage: taxProxyFlows > 0 ? fiscalClassificationCoverage : fiscalCoverage,
    source: taxResults.audit_trace || taxResults.tax_source_label || null,
    notes: taxProxyFlows ? [`${taxProxyFlows} fluxo(s) usam categoria fiscal proxy.`] : [],
  });
}

function buildBenchmarkEvidence({ baselineBundle, hasHistoricalBenchmark, hasHistoricalSeries }) {
  return item({
    id: 'historical_benchmark',
    label: 'Benchmark histórico',
    classification: hasHistoricalBenchmark ? EVIDENCE_CLASSES.OBSERVED : EVIDENCE_CLASSES.UNKNOWN,
    coverage: hasHistoricalBenchmark ? 1 : 0,
    source: baselineBundle.base_fit?.reference_source || null,
    notes: hasHistoricalSeries ? [] : ['Não há série temporal identificada no bundle.'],
  });
}

function buildReconciliationEvidence(reconciliation) {
  return item({
    id: 'reconciliation',
    label: 'Reconciliação',
    classification:
      reconciliation.overall?.status === 'fully_reconciled'
        ? EVIDENCE_CLASSES.RECONCILED
        : reconciliation.overall?.status
          ? EVIDENCE_CLASSES.PARTIALLY_OBSERVED
          : EVIDENCE_CLASSES.UNKNOWN,
    coverage: reconciliation.overall ? 1 : 0,
    source: reconciliation.operational?.source || reconciliation.tax?.source || null,
    notes: reconciliation.overall ? [reconciliation.overall.label] : [],
  });
}

function evidenceStatus(score) {
  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  if (score > 0) return 'low';
  return 'insufficient';
}

function buildEvidenceBlockers({
  transferProxy,
  taxProxyFlows,
  taxCoverage,
  maxFallbackRate,
  hasHistoricalBenchmark,
  reconciliation,
  taxPeriodMetadata,
}) {
  const blockers = [];
  if (transferProxy) blockers.push('transferência depende de proxy');
  if (taxProxyFlows > 0) blockers.push('classificação fiscal incompleta em parte dos fluxos');
  if (taxCoverage.coverage_limited || taxCoverage.blocked)
    blockers.push('cobertura fiscal parcial por campos obrigatórios ausentes');
  if (maxFallbackRate >= 0.25) blockers.push('dependência material de fallback físico');
  if (!hasHistoricalBenchmark) blockers.push('benchmark histórico independente ausente');
  if (!reconciliation.overall || reconciliation.overall.status === 'pending') {
    blockers.push('reconciliação independente pendente');
  }
  if (taxPeriodMetadata?.model_weights?.status === 'model_parameter_differs_from_timeline') {
    blockers.push('pesos tributários do modelo diferem do cronograma oficial');
  }
  return blockers;
}

function cappedEvidenceScore(
  score,
  { maxFallbackRate, fiscalClassificationCoverage, hasHistoricalBenchmark }
) {
  const caps = [score];
  if (maxFallbackRate >= 0.25) caps.push(54);
  if (fiscalClassificationCoverage < 0.5) caps.push(59);
  if (!hasHistoricalBenchmark) caps.push(69);
  return Math.min(...caps);
}

/**
 * Builds an evidence report for a scenario result.
 * `coverage` is coverage of the relevant records, not statistical accuracy.
 */
export function buildEvidenceReport({
  companyId,
  baselineBundle = {},
  scenarioResult = {},
  taxResults = {},
} = {}) {
  const diagnostics = scenarioResult.costs?.diagnostics || {};
  const taxCoverage = taxResults.tax_coverage || {};
  const flowCount = Math.max(
    0,
    Number(diagnostics.flow_count || scenarioResult.flows?.length || 0)
  );
  const transferProxy =
    diagnostics.transfer_proxy_provenance ||
    (companyId === 'empresa1' ? { source_company: 'empresa2' } : null);
  const taxProxyFlows = Number(taxCoverage.proxy_flow_count || 0);
  const fiscalCoverage = Number.isFinite(Number(taxCoverage.complete_fiscal_coverage_ratio))
    ? finiteRatio(taxCoverage.complete_fiscal_coverage_ratio)
    : Number.isFinite(Number(taxCoverage.fiscal_classification_coverage))
      ? finiteRatio(taxCoverage.fiscal_classification_coverage)
      : 0;
  const eligibleFlowCoverage = Number.isFinite(Number(taxCoverage.eligible_coverage_ratio))
    ? finiteRatio(taxCoverage.eligible_coverage_ratio)
    : 0;
  const fiscalClassificationCoverage = flowCount
    ? finiteRatio(Number(taxCoverage.flows_with_complete_fiscal_data || 0) / flowCount)
    : 0;
  const { maxRate: maxFallbackRate } = fallbackProfile(diagnostics);
  const baseFit = baselineBundle.base_fit || {};
  const hasHistoricalBenchmark =
    Boolean(baseFit.reference_source) && baseFit.status !== 'benchmark_pending';
  const hasHistoricalSeries = Boolean(
    baselineBundle.core_data?.historical_series || baselineBundle.core_data?.time_series
  );
  const reconciliation = scenarioResult.reconciliation || {};
  const taxPeriodMetadata =
    taxResults.tax_period_contract || taxResults.metadata?.tax_period_contract;

  const components = [
    buildDistributionEvidence(diagnostics, maxFallbackRate),
    buildTransferEvidence({ diagnostics, transferProxy, maxFallbackRate }),
    buildTaxEvidence({ taxResults, taxCoverage, fiscalCoverage, fiscalClassificationCoverage }),
    buildBenchmarkEvidence({ baselineBundle, hasHistoricalBenchmark, hasHistoricalSeries }),
    buildReconciliationEvidence(reconciliation),
  ];

  const dimensions = {
    flow_coverage: finiteRatio(flowCount ? eligibleFlowCoverage : 0),
    fiscal_classification_coverage: fiscalClassificationCoverage,
    historical_series_available: hasHistoricalSeries,
    independent_benchmark_available: hasHistoricalBenchmark,
    proxy_dependency: transferProxy || taxProxyFlows > 0 ? 'material' : 'low',
    reconciliation_status: reconciliation.overall?.status || 'pending',
  };
  const score = Math.round(weightedAverage(components) * 100);
  const blockers = buildEvidenceBlockers({
    transferProxy,
    taxProxyFlows,
    taxCoverage,
    maxFallbackRate,
    hasHistoricalBenchmark,
    reconciliation,
    taxPeriodMetadata,
  });
  const cappedScore = cappedEvidenceScore(score, {
    maxFallbackRate,
    fiscalClassificationCoverage,
    hasHistoricalBenchmark,
  });

  return {
    company_id: companyId || baselineBundle.model?.company_id || null,
    scenario_id: scenarioResult.scenario_id || null,
    evidence_score: cappedScore,
    evidence_status: evidenceStatus(cappedScore),
    components,
    dimensions,
    blockers,
    interpretation: 'Evidência não equivale a precisão estatística ou validação oficial.',
  };
}

export function isEvidenceSufficientForRecommendation(report, { minimumScore = 55 } = {}) {
  return Boolean(
    report && Number(report.evidence_score) >= minimumScore && !report.blockers?.length
  );
}
