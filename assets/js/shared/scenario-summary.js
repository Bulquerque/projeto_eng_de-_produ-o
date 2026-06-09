import { resolveTaxRegime, taxRegimeLabel } from './tax-reform-config.js';

function toNum(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function formatMultiplierDisplay(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`;
}

export function formatInventoryDaysDisplay(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number}d` : '—';
}

export function resolveScenarioTaxRegimeLabel(scenario = {}, taxResults = {}) {
  const taxMode = scenario?.changes?.tax_mode;
  const taxRegime = scenario?.changes?.tax_regime;
  const taxYear = scenario?.changes?.tax_year;
  const resolvedTaxRegime =
    taxResults?.tax_regime || taxRegime || resolveTaxRegime({ taxMode, taxRegime, year: taxYear });
  return (
    taxResults?.regime_label || taxResults?.tax_regime_label || taxRegimeLabel(resolvedTaxRegime)
  );
}

export function buildScenarioSummary({
  scenario = {},
  result = {},
  quality = null,
  baselineTotal = 0,
} = {}) {
  const scenarioSource = scenario?.changes ? scenario : result?.scenario || scenario || {};
  const changes = scenarioSource?.changes || {};
  const taxResults = result?.tax_results || scenarioSource?.tax_results || {};
  const totalWithTax = toNum(result?.total_with_tax ?? result?.costs?.total_with_tax);
  const activeCds = Array.isArray(changes.active_cds) ? changes.active_cds : [];
  const savingAbs = baselineTotal ? baselineTotal - totalWithTax : 0;
  const savingPct = baselineTotal ? (savingAbs / baselineTotal) * 100 : 0;

  return {
    scenario_id: scenarioSource?.scenario_id || result?.scenario_id || null,
    scenario_name: scenarioSource?.scenario_name || result?.scenario_name || '—',
    scenario_type: scenarioSource?.scenario_type || result?.scenario_type || '—',
    active_cds_count: activeCds.length,
    freight_multiplier: toNum(changes.freight_multiplier ?? 1, 1),
    demand_multiplier: toNum(changes.demand_multiplier ?? 1, 1),
    inventory_days: toNum(changes.inventory_days ?? 45, 45),
    tax_regime_label: resolveScenarioTaxRegimeLabel(scenarioSource, taxResults),
    transfer_cost: toNum(result?.costs?.transfer_cost),
    tax_impact: toNum(result?.costs?.tax_impact ?? taxResults.total_tax_impact),
    total_with_tax: totalWithTax,
    saving_abs: savingAbs,
    saving_pct: savingPct,
    quality_score: quality?.quality_score ?? result?.quality?.quality_score ?? null,
    risk_level: quality?.risk_level ?? result?.quality?.risk_level ?? '—',
  };
}
