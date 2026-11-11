import assert from 'node:assert/strict';
import {
  DEFAULT_TAX_REFORM_CONFIG,
  getTaxReformConfig,
  setTaxReformConfig,
} from '../../assets/js/core/tax-reform-config.js';
import { applyTaxRuntimeConfig } from '../../scripts/audit/tax_runtime_config.mjs';

const source = structuredClone(DEFAULT_TAX_REFORM_CONFIG);
source.regimes.reform_full_2033.selective_rate = 0.071;
source.regimes.reform_full_2033.category_rules.default_goods.selective_rate_multiplier = 0.11;
source.untrusted_private_note = 'must not be projected';
const report = applyTaxRuntimeConfig(source);
assert.equal(getTaxReformConfig().regimes.reform_full_2033.selective_rate, 0.071);
assert.equal(report.active.regimes.reform_full_2033.selective_rate, 0.071);
assert.equal(
  report.active.regimes.reform_full_2033.category_rules.default_goods.selective_rate_multiplier,
  0.11
);
assert(
  report.differences.some(
    (item) =>
      item.path === 'regimes.reform_full_2033.selective_rate' &&
      item.default_js === 0.02 &&
      item.active_json === 0.071
  )
);
assert(!JSON.stringify(report).includes('must not be projected'));
source.regimes.reform_full_2033.selective_rate = 0.99;
assert.equal(report.active.regimes.reform_full_2033.selective_rate, 0.071);
setTaxReformConfig(DEFAULT_TAX_REFORM_CONFIG);
console.log('TAX_RUNTIME_CONFIG_AUDIT_OK');
