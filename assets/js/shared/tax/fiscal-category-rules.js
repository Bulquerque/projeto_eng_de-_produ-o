const DEFAULT_RULES = {
  default_category: 'default_goods',
  categories: {
    default_goods: { label: 'Mercadorias padrão', cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 0, credit_rate: 0.1, credit_eligible: true },
    essential_goods: { label: 'Bens essenciais', cbs_rate_multiplier: 0.7, ibs_rate_multiplier: 0.8, selective_rate_multiplier: 0, credit_rate: 0.15, credit_eligible: true },
    services: { label: 'Serviços', cbs_rate_multiplier: 1.05, ibs_rate_multiplier: 1.05, selective_rate_multiplier: 0, credit_rate: 0.08, credit_eligible: true },
    selective_goods: { label: 'Produtos sujeitos ao seletivo', cbs_rate_multiplier: 1, ibs_rate_multiplier: 1, selective_rate_multiplier: 1, credit_rate: 0, credit_eligible: false }
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getFiscalCategoryRules() {
  return clone(DEFAULT_RULES);
}

export function normalizeFiscalCategory(category, rules = DEFAULT_RULES) {
  const key = String(category || '').trim().toLowerCase();
  return rules.categories[key] ? key : rules.default_category;
}

export function getFiscalCategoryRule(category, rules = DEFAULT_RULES) {
  const normalized = normalizeFiscalCategory(category, rules);
  return rules.categories[normalized] || rules.categories[rules.default_category];
}

export async function loadFiscalCategoryRules(path = '../assets/data/tax/fiscal-category-rules.json') {
  const { fetchJson } = await import('../data-loader.js');
  const loaded = await fetchJson(path);
  return {
    default_category: String(loaded?.default_category || DEFAULT_RULES.default_category),
    categories: loaded?.categories ? loaded.categories : clone(DEFAULT_RULES.categories)
  };
}
