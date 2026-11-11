import { buildBaselineScenario } from '../phase4/optimizer-utils.js';
import { runScenario } from '../phase3/scenario-simulator.js';
import { isNumericallyUsableScenarioResult } from '../core/analysis-quality.js';

export function buildPhysicalComparisonBaseline({ companyId, baselineBundle, selectedScenario }) {
  if (!baselineBundle?.model?.active_cds?.length || !selectedScenario) return null;
  const scenario = buildBaselineScenario(companyId, baselineBundle, selectedScenario.changes);
  const result = runScenario({
    companyId,
    scenario,
    baselineBundle,
    baselineMode: 'physical_unanchored',
  });
  return isNumericallyUsableScenarioResult(result) && Number(result.total_with_tax) > 0
    ? result
    : null;
}
