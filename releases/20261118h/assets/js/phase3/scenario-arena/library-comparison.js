import { buildScenarioSummary } from '../../core/scenario-summary.js';
import { MODEL_DEFAULTS } from '../../core/model-configuration.js';
import { runScenario } from '../scenario-simulator.js';
import { evaluateScenarioQuality } from '../scenario-quality-check.js';

function isHiddenScenario(scenario) {
  return (
    /apenas\s+malha/i.test(String(scenario?.scenario_name || scenario?.name || '')) ||
    /apenas\s+malha/i.test(String(scenario?.scenario_id || ''))
  );
}

export function buildLibraryComparisonRows({ companyId, library, currentResult, quality }) {
  if (!library) return null;

  const baselineBundle = library.baselineBundle;
  const baselineTotal = Number(baselineBundle.costs.costs.total_with_tax || 0);
  const baselineRows = [
    {
      ...buildScenarioSummary({
        scenario: {
          scenario_id: 'baseline',
          scenario_name: 'Baseline',
          scenario_type: 'referência',
          changes: {
            active_cds: baselineBundle.model?.active_cds || [],
            freight_multiplier: 1,
            demand_multiplier: 1,
            inventory_days: MODEL_DEFAULTS.inventory_days,
            tax_mode: 'current',
          },
        },
        result: {
          total_with_tax: baselineTotal,
          costs: baselineBundle.costs.costs || {},
          tax_results: baselineBundle.tax_results?.tax_results || {},
        },
        baselineTotal,
      }),
      type: 'referência',
    },
  ];
  const libraryRows = (library.scenarios || [])
    .filter((scenario) => !isHiddenScenario(scenario))
    .slice(0, 8)
    .map((scenario) => {
      const result = runScenario({
        companyId,
        scenario,
        baselineBundle,
      });
      const scenarioQuality = evaluateScenarioQuality({
        scenarioResult: result,
        baselineBundle,
      });
      return {
        ...buildScenarioSummary({
          scenario,
          result,
          quality: scenarioQuality,
          baselineTotal,
        }),
        type: scenario.scenario_type || 'biblioteca',
      };
    });
  const current =
    currentResult && !isHiddenScenario(currentResult.scenario || currentResult)
      ? [
          {
            ...buildScenarioSummary({
              scenario: currentResult.scenario,
              result: currentResult,
              quality,
              baselineTotal,
            }),
            scenario_name: `${currentResult.scenario_name} (atual)`,
            type: 'customizado',
          },
        ]
      : [];

  return [...baselineRows, ...current, ...libraryRows];
}
