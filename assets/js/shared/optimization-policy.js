import { resolveTaxRegime } from './tax-reform-config.js';
import { MODEL_ASSUMPTIONS } from './model-assumptions.js';

export const CANONICAL_OPTIMIZATION_POLICY = {
  freight_multiplier: 1,
  demand_multiplier: 1,
  inventory_days: MODEL_ASSUMPTIONS.inventory.baseline_days,
  tax_mode: 'reform_2033',
  tax_regime: resolveTaxRegime({ taxMode: 'reform_2033' }),
  allow_tax_disabled: false,
};

export function buildCanonicalOptimizationConfig(optimizerConfig = {}) {
  return {
    ...CANONICAL_OPTIMIZATION_POLICY,
    method: String(optimizerConfig.method || 'exact_discrete'),
    max_candidates: Number(optimizerConfig.max_candidates ?? 2000),
    seed: Number(optimizerConfig.seed ?? 42),
  };
}
