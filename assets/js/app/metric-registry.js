export const METRIC_REGISTRY = Object.freeze({
  // Scenario inputs and financial outputs.
  active_cds: { label: 'CDs ativos', source_path: 'model.active_cds', format: 'list' },
  freight_multiplier: {
    label: 'Multiplicador de frete',
    source_path: 'scenario.changes.freight_multiplier',
    format: 'multiplier',
  },
  total_with_tax: {
    label: 'Total com tributo',
    source_path: 'result.total_with_tax',
    format: 'brl',
  },

  // Data quality and evidence.
  quality_score: { label: 'Qualidade', source_path: 'quality.quality_score', format: 'number' },
  evidence_score: {
    label: 'Evidence',
    source_path: 'result.evidence.evidence_score',
    format: 'score',
  },
  saving_pct: { label: 'Saving', source_path: 'comparison.saving_pct', format: 'pct' },
  robustness_score: {
    label: 'Robustez',
    source_path: 'robustness.robustness_score',
    format: 'score',
  },

  // Tax coverage and optimizer search diagnostics.
  tax_coverage: {
    label: 'Cobertura fiscal',
    source_path: 'result.tax_results.tax_coverage.complete_fiscal_coverage_ratio',
    format: 'pct_ratio',
  },
  coverage_ratio: {
    label: 'Cobertura da busca',
    source_path: 'optimizer.search_log.coverage_ratio',
    format: 'pct_ratio',
  },
  exact_search_space: {
    label: 'Busca exata',
    source_path: 'optimizer.search_log.exact_search_space',
    format: 'boolean',
  },

  // Decision and release status.
  recommendation_status: {
    label: 'Recomendação',
    source_path: 'recommendation.recommendation_status',
    format: 'status',
  },
  release_status: { label: 'Release', source_path: 'release.release_status', format: 'status' },
});

function readPath(value, path) {
  return String(path)
    .split('.')
    .reduce((current, part) => current?.[part], value);
}

export function getMetricDefinition(metricId) {
  return METRIC_REGISTRY[metricId] || null;
}

export function readMetric(viewModel, metricId) {
  const definition = getMetricDefinition(metricId);
  return definition ? readPath(viewModel, definition.source_path) : null;
}

export function formatMissing(value) {
  return value === null || value === undefined || value === '' ? '—' : value;
}

export function formatMetric(metricId, value) {
  const definition = getMetricDefinition(metricId);
  if (!definition) return formatMissing(value);
  if (value === null || value === undefined || value === '') return '—';
  if (definition.format === 'brl') {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  if (definition.format === 'pct')
    return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  if (definition.format === 'pct_ratio')
    return `${(Number(value) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  if (definition.format === 'multiplier')
    return `x${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
  if (definition.format === 'score')
    return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/100`;
  if (definition.format === 'boolean') return value ? 'sim' : 'não';
  if (definition.format === 'list') return Array.isArray(value) ? value.join(', ') || '—' : '—';
  return String(value);
}
