import { safeNumber } from './common.js';
import { MODEL_DEFAULTS } from './model-configuration.js';

export function sameSet(left = [], right = []) {
  const a = [...new Set((left || []).map(String))].sort();
  const b = [...new Set((right || []).map(String))].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function isCanonicalBaselineNetwork({ companyId, scenario, baselineBundle } = {}) {
  const changes = scenario?.changes || {};
  const model = baselineBundle?.model || {};
  return (
    (!companyId || scenario?.company_id === companyId) &&
    sameSet(changes.active_cds, model.active_cds) &&
    sameSet(changes.closed_cds, []) &&
    (changes.tax_mode || 'current') === 'current' &&
    (changes.tax_regime || 'current') === 'current'
  );
}

export function isCanonicalBaselineScenario({ companyId, scenario, baselineBundle } = {}) {
  const changes = scenario?.changes || {};
  return (
    isCanonicalBaselineNetwork({ companyId, scenario, baselineBundle }) &&
    safeNumber(changes.freight_multiplier, 1) === 1 &&
    safeNumber(changes.demand_multiplier, 1) === 1 &&
    safeNumber(changes.inventory_days, MODEL_DEFAULTS.inventory_days) ===
      MODEL_DEFAULTS.inventory_days &&
    safeNumber(changes.wacc, MODEL_DEFAULTS.reference_wacc) === MODEL_DEFAULTS.reference_wacc
  );
}
