import { $ } from '../core/common.js';

/** Reads and normalizes UI controls before the decision pipeline runs. */
export function readDecisionControls() {
  const sensitivityVariable = $('phase5SensitivityVariable')?.value || 'freight_multiplier';
  const sensitivityX = $('phase5SensitivityX')?.value || 'freight_multiplier';
  const sensitivityY = $('phase5SensitivityY')?.value || 'demand_multiplier';

  return {
    maxCandidates: Number($('phase5MaxCandidates')?.value || 2000),
    selectionMode: $('phase5SelectionMode')?.value || 'best_by_score',
    manualScenarioId: $('phase5ManualScenarioId')?.value || null,
    stressProfile: $('phase5StressProfile')?.value || 'standard',
    sensitivityVariable,
    sensitivityX,
    sensitivityY,
  };
}
