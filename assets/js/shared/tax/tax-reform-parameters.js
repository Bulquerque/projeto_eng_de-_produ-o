const DEFAULT_PARAMETERS = {
  parameter_version: '2026-05',
  default_tax_mode: 'current',
  default_tax_regime: 'legacy_current',
  rates: {
    cbs: 0.088,
    ibs: 0.177,
    selective: 0.02,
    legacy_reference_rate: 0.18,
    test_2026_cbs: 0.009,
    test_2026_ibs: 0.001
  },
  regime_overrides: {
    reform_2026: { cbs: 0.009, ibs: 0.001, selective: 0 },
    reform_test_2026: { cbs: 0.009, ibs: 0.001, selective: 0 },
    reform_2027_2028: { cbs: 0.088, ibs: 0, selective: 0.01 },
    reform_2027: { cbs: 0.088, ibs: 0, selective: 0.01 },
    reform_2028: { cbs: 0.088, ibs: 0, selective: 0.01 },
    transition_2029: { cbs: 0.088, ibs: 0.177, selective: 0.01 },
    transition_2030: { cbs: 0.088, ibs: 0.177, selective: 0.01 },
    transition_2031: { cbs: 0.088, ibs: 0.177, selective: 0.01 },
    transition_2032: { cbs: 0.088, ibs: 0.177, selective: 0.01 },
    reform_full_2033: { cbs: 0.088, ibs: 0.177, selective: 0.02 }
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getTaxReformParameters() {
  return clone(DEFAULT_PARAMETERS);
}

export function getRegimeTaxRates(regimeId, parameters = DEFAULT_PARAMETERS) {
  const normalizedRegimeId = String(regimeId || parameters.default_tax_regime || DEFAULT_PARAMETERS.default_tax_regime);
  return {
    ...parameters.rates,
    ...(parameters.regime_overrides?.[normalizedRegimeId] || {})
  };
}

export async function loadTaxReformParameters(path = '../assets/data/tax/tax-reform-parameters.json') {
  const { fetchJson } = await import('../data-loader.js');
  const loaded = await fetchJson(path);
  return {
    parameter_version: String(loaded?.parameter_version || DEFAULT_PARAMETERS.parameter_version),
    default_tax_mode: String(loaded?.default_tax_mode || DEFAULT_PARAMETERS.default_tax_mode),
    default_tax_regime: String(loaded?.default_tax_regime || DEFAULT_PARAMETERS.default_tax_regime),
    rates: { ...DEFAULT_PARAMETERS.rates, ...(loaded?.rates || {}) },
    regime_overrides: { ...DEFAULT_PARAMETERS.regime_overrides, ...(loaded?.regime_overrides || {}) }
  };
}
