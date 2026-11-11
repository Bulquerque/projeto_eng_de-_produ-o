import {
  runMonteCarloSimulation,
  summarizeMonteCarloPrefix,
} from '../../assets/js/phase3/monte-carlo-engine.js';
import { projectMonteCarloExecutionEvidence } from '../academic-evidence-config.mjs';
import { listTaxModes } from '../../assets/js/core/tax-reform-config.js';

const taxModes = new Set(listTaxModes());

/** The profiles and seeds describe conditional model sensitivity, not real-world probabilities. */
export function monteCarloBatterySettings({ include5000 = false } = {}) {
  const settings = [];
  for (const profile of ['conservative', 'balanced', 'broad']) {
    for (const seed of [42, 43, 44]) {
      for (const iterations of include5000 ? [300, 1000, 5000] : [300, 1000]) {
        settings.push({ profile, seed, iterations });
      }
    }
  }
  return settings;
}

/** Returns only aggregated results; source identifiers and per-flow data stay private. */
export function runMonteCarloBattery({
  companyId,
  baselineBundle,
  scenarios,
  include5000 = false,
  runner = runMonteCarloSimulation,
  onProgress = () => {},
}) {
  const results = [];
  for (const item of scenarios) {
    if (!item.scenario) {
      results.push({
        scenario_key: item.key,
        status: 'BLOCKED_SOURCE',
        reason_code: item.reason || 'MISSING_SCENARIO_INPUT',
      });
      continue;
    }
    const fullRuns = new Map();
    for (const setting of monteCarloBatterySettings({ include5000 })) {
      onProgress({ scenario_key: item.key, ...setting });
      const runKey = `${setting.profile}:${setting.seed}`;
      // A prefix of the same seeded stream is identical to a shorter run.
      // Reuse it only for the production runner; injected test runners can
      // provide arbitrary samples and are called separately.
      let result;
      if (runner === runMonteCarloSimulation) {
        if (!fullRuns.has(runKey)) {
          fullRuns.set(
            runKey,
            runner({
              companyId,
              baselineBundle,
              selectedScenario: item.scenario,
              iterations: include5000 ? 5000 : 1000,
              seed: setting.seed,
              config: { profile: setting.profile },
            })
          );
        }
        const complete = fullRuns.get(runKey);
        result =
          setting.iterations === complete.config?.iterations
            ? complete
            : summarizeMonteCarloPrefix(complete, setting.iterations);
      } else {
        result = runner({
          companyId,
          baselineBundle,
          selectedScenario: item.scenario,
          iterations: setting.iterations,
          seed: setting.seed,
          config: { profile: setting.profile },
        });
      }
      const changes = item.scenario.changes || {};
      const year = Number(changes.tax_year);
      results.push({
        scenario_key: item.key,
        tax_year: Number.isInteger(year) && year >= 2025 && year <= 2033 ? year : null,
        tax_mode: taxModes.has(changes.tax_mode)
          ? changes.tax_mode
          : taxModes.has(changes.tax_regime)
            ? changes.tax_regime
            : changes.tax_mode == null && changes.tax_regime == null
              ? 'current'
              : null,
        tax_regime: taxModes.has(changes.tax_regime) ? changes.tax_regime : null,
        iterations_requested: setting.iterations,
        seed: setting.seed,
        profile: setting.profile,
        source_class: 'PARAMETRIC_EXPLORATORY',
        ...projectMonteCarloExecutionEvidence(result),
      });
    }
  }
  return results;
}
