import {
  getTaxReformConfig,
  normalizeTaxReformConfig,
  resolveTaxModeForRegime,
  resolveTaxRegime,
  setTaxReformConfig,
  taxRegimeLabel
} from '../tax-reform-config.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getTaxRegimeCatalog() {
  return clone(normalizeTaxReformConfig(getTaxReformConfig()));
}

export { resolveTaxRegime, resolveTaxModeForRegime, taxRegimeLabel, setTaxReformConfig };

export async function loadTaxRegimeCatalog(path = '../assets/data/tax/tax-regime-catalog.json') {
  const { fetchJson } = await import('../data-loader.js');
  const loaded = await fetchJson(path);
  const normalized = normalizeTaxReformConfig(loaded);
  setTaxReformConfig(normalized);
  return normalized;
}
