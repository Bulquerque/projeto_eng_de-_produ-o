import { resolveTaxRegime } from './tax-reform-config.js';
import { MODEL_DEFAULTS } from './model-configuration.js';

export const CANONICAL_OPTIMIZATION_POLICY = {
  freight_multiplier: 1,
  demand_multiplier: 1,
  inventory_days: MODEL_DEFAULTS.inventory_days,
  // Like-for-like comparison: the canonical optimizer uses the same current
  // regime as the published phase-2 baseline. Reform scenarios remain
  // explicit stress/sensitivity cases, not a hidden ranking switch.
  tax_mode: 'current',
  tax_regime: resolveTaxRegime({ taxMode: 'current' }),
  allow_tax_disabled: false,
};

export function buildCanonicalOptimizationConfig(optimizerConfig = {}) {
  const requestedMax = Number(optimizerConfig.max_candidates ?? 2000);
  const requestedSeed = Number(optimizerConfig.seed ?? 42);
  return {
    ...CANONICAL_OPTIMIZATION_POLICY,
    method: String(optimizerConfig.method || 'exact_discrete'),
    max_candidates: Number.isInteger(requestedMax) && requestedMax > 0 ? requestedMax : 2000,
    seed: Number.isFinite(requestedSeed) ? Math.trunc(requestedSeed) : 42,
    max_candidates_was_invalid: !(Number.isInteger(requestedMax) && requestedMax > 0),
  };
}
