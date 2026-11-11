import { getTaxReformConfig, setTaxReformConfig } from '../../assets/js/core/tax-reform-config.js';

const numberOrNull = (value) =>
  value != null &&
  (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
  Number.isFinite(Number(value))
    ? Number(value)
    : null;

/** Run both networks under each 2033 assumption; results are aggregate-only. */
export function runTax2033Sensitivity({ baselineScenario, candidateScenario, run }) {
  for (const scenario of [baselineScenario, candidateScenario]) {
    if (
      Number(scenario?.changes?.tax_year) !== 2033 ||
      scenario?.changes?.tax_regime !== 'reform_full_2033'
    ) {
      throw new Error('Both scenarios must use tax year 2033 and reform_full_2033.');
    }
  }
  if (typeof run !== 'function') throw new TypeError('A synchronous scenario runner is required.');
  const original = structuredClone(getTaxReformConfig());
  const withoutSelective = structuredClone(original);
  withoutSelective.regimes.reform_full_2033.selective_rate = 0;
  const rows = [];
  try {
    for (const [assumption, config] of [
      ['configured_selective_tax', original],
      ['no_selective_tax', withoutSelective],
    ]) {
      setTaxReformConfig(config);
      for (const [scenario, input] of [
        ['baseline', baselineScenario],
        ['candidate', candidateScenario],
      ]) {
        const result = run(input);
        if (!result || typeof result.then === 'function')
          throw new TypeError('The scenario runner must return a result synchronously.');
        const costs = result.costs || {};
        const details = costs.tax_details || {};
        rows.push({
          assumption,
          scenario,
          tax_year: 2033,
          tax_regime: 'reform_full_2033',
          source_class: 'PARAMETRIC_EXPLORATORY',
          simulation_status: result.simulation_status ?? null,
          logistics_brl: numberOrNull(costs.total_logistics_cost),
          cbs_brl: numberOrNull(details.cbs_total),
          ibs_brl: numberOrNull(details.ibs_total),
          selective_tax_brl: numberOrNull(details.selective_tax_total),
          credits_brl: numberOrNull(details.credits_total),
          current_tax_brl: numberOrNull(details.total_current_tax),
          tax_impact_brl: numberOrNull(costs.tax_impact),
          total_with_tax_brl: numberOrNull(result.total_with_tax),
        });
      }
      const pair = rows.slice(-2);
      const pairValid = pair.every((entry) => entry.simulation_status === 'success');
      for (const entry of pair) {
        entry.pair_status = pairValid ? 'success' : 'blocked_invalid_simulation';
        if (!pairValid) {
          for (const key of [
            'logistics_brl',
            'cbs_brl',
            'ibs_brl',
            'selective_tax_brl',
            'credits_brl',
            'current_tax_brl',
            'tax_impact_brl',
            'total_with_tax_brl',
          ])
            entry[key] = null;
        }
      }
    }
  } finally {
    setTaxReformConfig(original);
  }
  return rows;
}
