function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalizeAliasMap(map = {}) {
  return Object.fromEntries(
    Object.entries(map).map(([key, value]) => [String(key), String(value)])
  );
}

function normalizeRegimes(regimes = {}) {
  const out = {};
  for (const [regimeId, regime] of Object.entries(regimes)) {
    out[String(regimeId)] = {
      regime_id: String(regimeId),
      ...clone(regime || {})
    };
  }
  return out;
}

export const DEFAULT_TAX_REFORM_CONFIG = {
  default_tax_mode: 'current',
  default_tax_regime: 'legacy_current',
  default_category: 'default_goods',
  tax_mode_aliases: normalizeAliasMap({
    current: 'legacy_current',
    disabled: 'disabled',
    reform_2026: 'reform_2026',
    reform_2027: 'reform_2027_2028',
    reform_2028: 'reform_2027_2028',
    reform_2029: 'transition_2029',
    reform_2030: 'transition_2030',
    reform_2031: 'transition_2031',
    reform_2032: 'transition_2032',
    reform_2033: 'reform_full_2033'
  }),
  regimes: normalizeRegimes({
    legacy_current: {
      label: 'Sistema atual',
      ui_mode: 'current',
      year: 2025,
      year_label: '2025',
      calculation_mode: 'legacy_current',
      legacy_weight: 1,
      cbs_rate: 0,
      ibs_rate: 0,
      selective_rate: 0,
      credit_rate: 0,
      category_rules: {
        default_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 0, credit_rate: 0.12 },
        essential_goods: { cbs_rate_multiplier: 0.7, ibs_rate_multiplier: 0.7, selective_rate_multiplier: 0, credit_rate: 0.15 },
        services: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 0, credit_rate: 0.08 },
        selective_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 1, credit_rate: 0 }
      }
    },
    disabled: {
      label: 'Tributário desligado',
      ui_mode: 'disabled',
      year: 2025,
      year_label: 'desligado',
      calculation_mode: 'disabled',
      legacy_weight: 0,
      cbs_rate: 0,
      ibs_rate: 0,
      selective_rate: 0,
      credit_rate: 0,
      category_rules: {}
    },
    reform_2026: {
      label: '2026, ano-teste',
      ui_mode: 'reform_2026',
      year: 2026,
      year_label: '2026',
      calculation_mode: 'transition_test',
      legacy_weight: 0.995,
      cbs_rate: 0.009,
      ibs_rate: 0.001,
      selective_rate: 0,
      credit_rate: 0.02,
      category_rules: {
        default_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 0, credit_rate: 0.02 },
        essential_goods: { cbs_rate_multiplier: 0.7, ibs_rate_multiplier: 0.7, selective_rate_multiplier: 0, credit_rate: 0.03 },
        services: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 0, credit_rate: 0.01 },
        selective_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 0, credit_rate: 0 }
      }
    },
    reform_2027_2028: {
      label: '2027-2028, CBS em vigor',
      ui_mode: 'reform_2027',
      alt_ui_mode: 'reform_2028',
      year: 2027,
      year_label: '2027-2028',
      calculation_mode: 'reform_cbs',
      legacy_weight: 0.72,
      cbs_rate: 0.088,
      ibs_rate: 0,
      selective_rate: 0.01,
      credit_rate: 0.15,
      category_rules: {
        default_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 0.4, credit_rate: 0.15 },
        essential_goods: { cbs_rate_multiplier: 0.65, ibs_rate_multiplier: 1, selective_rate_multiplier: 0.2, credit_rate: 0.18 },
        services: { cbs_rate_multiplier: 1.05, ibs_rate_multiplier: 1, selective_rate_multiplier: 0.2, credit_rate: 0.08 },
        selective_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 1, credit_rate: 0 }
      }
    },
    transition_2029: {
      label: 'Transição 2029',
      ui_mode: 'reform_2029',
      year: 2029,
      year_label: '2029',
      calculation_mode: 'transition_2029',
      legacy_weight: 0.9,
      ibs_weight: 0.1,
      cbs_rate: 0.088,
      ibs_rate: 0.177,
      selective_rate: 0.01,
      credit_rate: 0.15,
      category_rules: {
        default_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 0.5, credit_rate: 0.15 },
        essential_goods: { cbs_rate_multiplier: 0.7, ibs_rate_multiplier: 0.8, selective_rate_multiplier: 0.25, credit_rate: 0.18 },
        services: { cbs_rate_multiplier: 1.05, ibs_rate_multiplier: 1.05, selective_rate_multiplier: 0.25, credit_rate: 0.08 },
        selective_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 1, credit_rate: 0 }
      }
    },
    transition_2030: {
      label: 'Transição 2030',
      ui_mode: 'reform_2030',
      year: 2030,
      year_label: '2030',
      calculation_mode: 'transition_2030',
      legacy_weight: 0.8,
      ibs_weight: 0.2,
      cbs_rate: 0.088,
      ibs_rate: 0.177,
      selective_rate: 0.01,
      credit_rate: 0.15,
      category_rules: {
        default_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 0.5, credit_rate: 0.15 },
        essential_goods: { cbs_rate_multiplier: 0.7, ibs_rate_multiplier: 0.8, selective_rate_multiplier: 0.25, credit_rate: 0.18 },
        services: { cbs_rate_multiplier: 1.05, ibs_rate_multiplier: 1.05, selective_rate_multiplier: 0.25, credit_rate: 0.08 },
        selective_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 1, credit_rate: 0 }
      }
    },
    transition_2031: {
      label: 'Transição 2031',
      ui_mode: 'reform_2031',
      year: 2031,
      year_label: '2031',
      calculation_mode: 'transition_2031',
      legacy_weight: 0.7,
      ibs_weight: 0.3,
      cbs_rate: 0.088,
      ibs_rate: 0.177,
      selective_rate: 0.01,
      credit_rate: 0.15,
      category_rules: {
        default_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 0.5, credit_rate: 0.15 },
        essential_goods: { cbs_rate_multiplier: 0.7, ibs_rate_multiplier: 0.8, selective_rate_multiplier: 0.25, credit_rate: 0.18 },
        services: { cbs_rate_multiplier: 1.05, ibs_rate_multiplier: 1.05, selective_rate_multiplier: 0.25, credit_rate: 0.08 },
        selective_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 1, credit_rate: 0 }
      }
    },
    transition_2032: {
      label: 'Transição 2032',
      ui_mode: 'reform_2032',
      year: 2032,
      year_label: '2032',
      calculation_mode: 'transition_2032',
      legacy_weight: 0.6,
      ibs_weight: 0.4,
      cbs_rate: 0.088,
      ibs_rate: 0.177,
      selective_rate: 0.01,
      credit_rate: 0.15,
      category_rules: {
        default_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 0.5, credit_rate: 0.15 },
        essential_goods: { cbs_rate_multiplier: 0.7, ibs_rate_multiplier: 0.8, selective_rate_multiplier: 0.25, credit_rate: 0.18 },
        services: { cbs_rate_multiplier: 1.05, ibs_rate_multiplier: 1.05, selective_rate_multiplier: 0.25, credit_rate: 0.08 },
        selective_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 1, credit_rate: 0 }
      }
    },
    reform_full_2033: {
      label: '2033, regime integral',
      ui_mode: 'reform_2033',
      year: 2033,
      year_label: '2033',
      calculation_mode: 'reform_full',
      legacy_weight: 0,
      ibs_weight: 1,
      cbs_rate: 0.088,
      ibs_rate: 0.177,
      selective_rate: 0.02,
      credit_rate: 0.2,
      category_rules: {
        default_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 0.7, credit_rate: 0.2 },
        essential_goods: { cbs_rate_multiplier: 0.65, ibs_rate_multiplier: 0.75, selective_rate_multiplier: 0.3, credit_rate: 0.22 },
        services: { cbs_rate_multiplier: 1.05, ibs_rate_multiplier: 1.05, selective_rate_multiplier: 0.3, credit_rate: 0.1 },
        selective_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 1, credit_rate: 0 }
      }
    }
  }),
  category_rules: {
    default_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 0, credit_rate: 0.1 },
    essential_goods: { cbs_rate_multiplier: 0.7, ibs_rate_multiplier: 0.8, selective_rate_multiplier: 0, credit_rate: 0.15 },
    services: { cbs_rate_multiplier: 1.05, ibs_rate_multiplier: 1.05, selective_rate_multiplier: 0, credit_rate: 0.08 },
    selective_goods: { cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 1, credit_rate: 0 }
  }
};

let activeTaxReformConfig = clone(DEFAULT_TAX_REFORM_CONFIG);

export function getTaxReformConfig() {
  return activeTaxReformConfig;
}

export function setTaxReformConfig(nextConfig = {}) {
  activeTaxReformConfig = normalizeTaxReformConfig(nextConfig);
  return activeTaxReformConfig;
}

export function normalizeTaxReformConfig(input = {}) {
  const merged = {
    ...clone(DEFAULT_TAX_REFORM_CONFIG),
    ...clone(input || {})
  };
  merged.tax_mode_aliases = normalizeAliasMap({
    ...DEFAULT_TAX_REFORM_CONFIG.tax_mode_aliases,
    ...(input.tax_mode_aliases || {})
  });
  merged.regimes = normalizeRegimes({
    ...DEFAULT_TAX_REFORM_CONFIG.regimes,
    ...(input.regimes || {})
  });
  merged.category_rules = {
    ...clone(DEFAULT_TAX_REFORM_CONFIG.category_rules),
    ...(input.category_rules || {})
  };
  return merged;
}

export function resolveTaxRegime({ taxMode = null, taxRegime = null, year = null, config = getTaxReformConfig() } = {}) {
  const normalizedMode = String(taxMode || '').trim();
  const normalizedRegime = String(taxRegime || '').trim();
  if (normalizedRegime && config.regimes[normalizedRegime]) return normalizedRegime;
  if (normalizedMode && config.regimes[normalizedMode]) return normalizedMode;
  if (normalizedMode && config.tax_mode_aliases[normalizedMode]) return config.tax_mode_aliases[normalizedMode];
  if (normalizedRegime && config.tax_mode_aliases[normalizedRegime]) return config.tax_mode_aliases[normalizedRegime];
  const n = Number(year);
  if (Number.isFinite(n)) {
    if (n <= 2025) return 'legacy_current';
    if (n === 2026) return 'reform_2026';
    if (n === 2027 || n === 2028) return 'reform_2027_2028';
    if (n === 2029) return 'transition_2029';
    if (n === 2030) return 'transition_2030';
    if (n === 2031) return 'transition_2031';
    if (n === 2032) return 'transition_2032';
    if (n >= 2033) return 'reform_full_2033';
  }
  return config.default_tax_regime || 'legacy_current';
}

export function resolveTaxModeForRegime(regimeId, config = getTaxReformConfig()) {
  const regime = config.regimes[String(regimeId)] || null;
  if (!regime) return config.default_tax_mode || 'current';
  if (regime.ui_mode) return regime.ui_mode;
  if (regime.alt_ui_mode) return regime.alt_ui_mode;
  return regime.regime_id === 'legacy_current' ? 'current' : regime.regime_id;
}

export function taxRegimeLabel(regimeId, config = getTaxReformConfig()) {
  const regime = config.regimes[String(regimeId)] || null;
  return regime?.label || String(regimeId || config.default_tax_regime || 'legacy_current');
}

export function getTaxRegimeDefinition({ taxMode = null, taxRegime = null, year = null, config = getTaxReformConfig() } = {}) {
  const regimeId = resolveTaxRegime({ taxMode, taxRegime, year, config });
  const regime = config.regimes[regimeId] || config.regimes[config.default_tax_regime] || null;
  return regime ? { ...clone(regime), regime_id: regimeId } : null;
}

export function listTaxModes(config = getTaxReformConfig()) {
  const values = new Set([...Object.keys(config.tax_mode_aliases || {}), ...Object.keys(config.regimes || {})]);
  for (const regime of Object.values(config.regimes || {})) {
    if (regime.ui_mode) values.add(regime.ui_mode);
    if (regime.alt_ui_mode) values.add(regime.alt_ui_mode);
  }
  return [...values];
}

export async function loadTaxReformConfiguration(path = '../data/tax/tax_reform_config.json') {
  const { fetchJson } = await import('./data-loader.js');
  const loaded = await fetchJson(path);
  const normalized = normalizeTaxReformConfig(loaded);
  setTaxReformConfig(normalized);
  return normalized;
}
