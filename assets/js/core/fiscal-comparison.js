import { resolveTaxRegime } from './tax-reform-config.js';

function fiscalContext({ scenario, result } = {}) {
  const changes = scenario?.changes || result?.scenario?.changes || {};
  const tax = result?.tax_results || {};
  const mode = changes.tax_mode ?? tax.tax_mode ?? 'current';
  const regime = changes.tax_regime ?? tax.tax_regime ?? null;
  const year = changes.tax_year == null ? null : Number(changes.tax_year);
  return {
    regime: resolveTaxRegime({ taxMode: mode, taxRegime: regime, year }),
    year: Number.isFinite(year) ? year : null,
  };
}

export function sameFiscalContext(first, second) {
  const a = fiscalContext(first);
  const b = fiscalContext(second);
  return a.regime === b.regime && a.year === b.year;
}
