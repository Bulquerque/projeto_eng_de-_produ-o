import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tests.crypto_helpers import NODE_DECRYPT_HELPER

ROOT = Path(__file__).resolve().parents[2]
code = (
    NODE_DECRYPT_HELPER
    + r"""
import assert from 'node:assert/strict';
import { buildLibraryComparisonRows } from './assets/js/phase3/scenario-arena/library-comparison.js';
import { buildScenarioFromForm } from './assets/js/phase3/scenario-builder.js';
import { runScenario } from './assets/js/phase3/scenario-simulator.js';
import { evaluateScenarioQuality } from './assets/js/phase3/scenario-quality-check.js';
import { buildScenarioSummary } from './assets/js/core/scenario-summary.js';
import { MODEL_DEFAULTS } from './assets/js/core/model-configuration.js';
import { loadRuntimeBundle } from './tests/runtime_bundle_support.mjs';

function referenceRows({ companyId, library, currentResult, quality }) {
  if (!library) return null;
  const isHiddenScenario = (scenario) =>
    /apenas\s+malha/i.test(String(scenario?.scenario_name || scenario?.name || '')) ||
    /apenas\s+malha/i.test(String(scenario?.scenario_id || ''));
  const baselineTotal = Number(library.baselineBundle.costs.costs.total_with_tax || 0);
  const baselineRows = [
    {
      ...buildScenarioSummary({
        scenario: {
          scenario_id: 'baseline',
          scenario_name: 'Baseline',
          scenario_type: 'referência',
          changes: {
            active_cds: library.baselineBundle.model?.active_cds || [],
            freight_multiplier: 1,
            demand_multiplier: 1,
            inventory_days: MODEL_DEFAULTS.inventory_days,
            tax_mode: 'current',
          },
        },
        result: {
          total_with_tax: baselineTotal,
          costs: library.baselineBundle.costs.costs || {},
          tax_results: library.baselineBundle.tax_results?.tax_results || {},
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
        baselineBundle: library.baselineBundle,
      });
      const scenarioQuality = evaluateScenarioQuality({
        scenarioResult: result,
        baselineBundle: library.baselineBundle,
      });
      return {
        ...buildScenarioSummary({ scenario, result, quality: scenarioQuality, baselineTotal }),
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

for (const companyId of ['empresa1', 'empresa2']) {
  const baselineBundle = loadRuntimeBundle({ companyId, decryptJson });
  const scenarios = Array.from({ length: 10 }, (_, index) => {
    const scenario = buildScenarioFromForm({
      companyId,
      baselineBundle,
      formValues: {
        scenario_name: `Biblioteca ${index}`,
        active_cds: baselineBundle.model.active_cds,
        freight_multiplier: 1 + (index + 1) / 100,
        demand_multiplier: 1,
        inventory_days: MODEL_DEFAULTS.inventory_days,
        wacc: MODEL_DEFAULTS.reference_wacc,
        tax_mode: 'disabled',
      },
    });
    scenario.scenario_type = index === 0 ? undefined : 'teste';
    return scenario;
  });
  scenarios.splice(1, 0, {
    scenario_id: 'only-mesh-name',
    scenario_name: 'Cenário apenas malha',
  });
  scenarios.splice(3, 0, {
    scenario_id: 'apenas malha por id',
    scenario_name: 'Oculto pelo identificador',
  });
  const currentScenario = buildScenarioFromForm({
    companyId,
    baselineBundle,
    formValues: {
      scenario_name: 'Cenário atual',
      active_cds: baselineBundle.model.active_cds,
      freight_multiplier: 1.12,
      demand_multiplier: 1,
      inventory_days: MODEL_DEFAULTS.inventory_days,
      wacc: MODEL_DEFAULTS.reference_wacc,
      tax_mode: 'disabled',
    },
  });
  const currentResult = runScenario({ companyId, scenario: currentScenario, baselineBundle });
  const quality = evaluateScenarioQuality({ scenarioResult: currentResult, baselineBundle });
  const library = { baselineBundle, scenarios };
  const input = { companyId, library, currentResult, quality };
  const actual = buildLibraryComparisonRows(input);

  assert.deepEqual(actual, referenceRows(input), `${companyId}: rows must match pre-extraction behavior`);
  assert.deepEqual(
    actual.map((row) => row.scenario_id),
    ['baseline', currentScenario.scenario_id, ...scenarios.filter((scenario) =>
      !/apenas\s+malha/i.test(String(scenario?.scenario_name || scenario?.name || '')) &&
      !/apenas\s+malha/i.test(String(scenario?.scenario_id || ''))
    ).slice(0, 8).map((scenario) => scenario.scenario_id)],
    `${companyId}: baseline, current, then first eight visible library scenarios`
  );
  assert.equal(actual[0].scenario_name, 'Baseline');
  assert.equal(actual[1].scenario_name, 'Cenário atual (atual)');
  assert.equal(actual[2].type, 'biblioteca');
  assert.equal(actual.length, 10, `${companyId}: baseline + current + eight library rows`);

  const hiddenCurrent = { ...currentResult, scenario: { scenario_name: 'Apenas malha' } };
  const withoutHiddenCurrent = buildLibraryComparisonRows({
    ...input,
    currentResult: hiddenCurrent,
  });
  assert.equal(withoutHiddenCurrent.length, 9, `${companyId}: hidden current scenario is omitted`);
  assert.equal(buildLibraryComparisonRows({ ...input, library: null }), null);
}
console.log('PHASE3_LIBRARY_COMPARISON_OK');
"""
)
res = subprocess.run(['node', '--input-type=module', '-e', code], cwd=ROOT, text=True, capture_output=True)
assert res.returncode == 0, res.stderr + res.stdout
print(res.stdout.strip())
