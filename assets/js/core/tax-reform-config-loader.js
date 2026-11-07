import { fetchJson } from './data-loader.js';
import { normalizeTaxReformConfig, setTaxReformConfig } from './tax-reform-config.js';

export async function loadTaxReformConfiguration(path = 'data/tax/tax_reform_config.json') {
  const loaded = await fetchJson(path);
  const normalized = normalizeTaxReformConfig(loaded);
  setTaxReformConfig(normalized);
  return normalized;
}
