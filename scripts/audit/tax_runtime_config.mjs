import {
  DEFAULT_TAX_REFORM_CONFIG,
  normalizeTaxReformConfig,
  setTaxReformConfig,
} from '../../assets/js/core/tax-reform-config.js';

const REGIME_FIELDS = [
  'year',
  'current_weight',
  'ibs_weight',
  'cbs_rate',
  'ibs_rate',
  'selective_rate',
  'credit_rate',
];
const CATEGORY_FIELDS = [
  'cbs_rate_multiplier',
  'ibs_rate_multiplier',
  'selective_rate_multiplier',
  'credit_rate',
];

// Only known numerical configuration parameters are projected; input metadata
// and unforeseen fields are excluded from the aggregate evidence.
function snapshot(config) {
  const regimes = {};
  for (const id of Object.keys(DEFAULT_TAX_REFORM_CONFIG.regimes)) {
    const source = config.regimes[id] || {};
    const entry = {};
    for (const field of REGIME_FIELDS) {
      if (typeof source[field] === 'number' && Number.isFinite(source[field]))
        entry[field] = source[field];
    }
    entry.category_rules = {};
    for (const category of Object.keys(DEFAULT_TAX_REFORM_CONFIG.category_rules)) {
      const rule = source.category_rules?.[category];
      if (!rule) continue;
      entry.category_rules[category] = {};
      for (const field of CATEGORY_FIELDS) {
        if (typeof rule[field] === 'number' && Number.isFinite(rule[field])) {
          entry.category_rules[category][field] = rule[field];
        }
      }
    }
    regimes[id] = entry;
  }
  return { regimes };
}

function differences(defaultValue, activeValue, path = '') {
  if (
    defaultValue &&
    activeValue &&
    typeof defaultValue === 'object' &&
    typeof activeValue === 'object'
  ) {
    const keys = new Set([...Object.keys(defaultValue), ...Object.keys(activeValue)]);
    return [...keys]
      .sort()
      .flatMap((key) =>
        differences(defaultValue[key], activeValue[key], path ? `${path}.${key}` : key)
      );
  }
  if (defaultValue === activeValue) return [];
  return [{ path, default_js: defaultValue ?? null, active_json: activeValue ?? null }];
}

/** Apply the same public JSON configuration as the browser and capture its numerical provenance. */
export function applyTaxRuntimeConfig(jsonConfig) {
  if (!jsonConfig || typeof jsonConfig !== 'object' || Array.isArray(jsonConfig)) {
    throw new TypeError('A tax configuration object is required.');
  }
  const defaultJs = snapshot(normalizeTaxReformConfig(DEFAULT_TAX_REFORM_CONFIG));
  const active = snapshot(setTaxReformConfig(jsonConfig));
  return {
    active_source: 'data/tax/tax_reform_config.json_normalized',
    assumptions_status: 'PARAMETRIC_EXPLORATORY_NOT_LEGAL_VALIDATION',
    default_js: defaultJs,
    active,
    differences: differences(defaultJs, active),
  };
}
