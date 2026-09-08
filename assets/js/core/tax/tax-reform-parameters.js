const DEFAULT_PARAMETERS = {
  parameter_version: '2026-05',
  default_tax_mode: 'current',
  default_tax_regime: 'current',
  rates: {
    cbs: 0.088,
    ibs: 0.177,
    selective: 0.02,
    current_reference_rate: 0.18,
    test_2026_cbs: 0.009,
    test_2026_ibs: 0.001,
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
    reform_full_2033: { cbs: 0.088, ibs: 0.177, selective: 0.02 },
  },
};

function normalizeRegimeId(value) {
  const regimeId = String(value ?? '').trim();
  return regimeId.endsWith('_current') ? 'current' : regimeId;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getTaxReformParameters() {
  return clone(DEFAULT_PARAMETERS);
}

export function getRegimeTaxRates(regimeId, parameters = DEFAULT_PARAMETERS) {
  const normalizedRegimeId = normalizeRegimeId(
    regimeId || parameters.default_tax_regime || DEFAULT_PARAMETERS.default_tax_regime
  );
  const override = Object.entries(parameters.regime_overrides || {}).find(
    ([key]) => normalizeRegimeId(key) === normalizedRegimeId
  )?.[1];
  const referenceRateEntry = Object.entries(parameters.rates || {}).find(([key]) =>
    key.endsWith('_reference_rate')
  );
  return {
    ...parameters.rates,
    ...(referenceRateEntry ? { current_reference_rate: referenceRateEntry[1] } : {}),
    ...(override || {}),
  };
}
