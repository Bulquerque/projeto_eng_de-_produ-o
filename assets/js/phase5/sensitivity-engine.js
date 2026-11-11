import { runScenario } from '../phase3/scenario-simulator.js';
import { calculateSaving } from '../core/model-configuration.js';
import { isNumericallyUsableScenarioResult } from '../core/analysis-quality.js';
import { buildPhysicalComparisonBaseline } from './physical-comparison.js';
function clone(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}
export function runSensitivity({
  companyId,
  selectedScenario,
  baselineBundle,
  sensitivityConfig = null,
} = {}) {
  const cfg = sensitivityConfig || { variable: 'freight_multiplier', values: [0.9, 1.0, 1.1, 1.2] };
  const allowed = new Set(['freight_multiplier', 'demand_multiplier', 'inventory_days', 'wacc']);
  if (!allowed.has(cfg.variable))
    return {
      company_id: companyId,
      scenario_id: selectedScenario?.scenario_id,
      sensitivity_results: [],
      most_sensitive_variable: null,
      warnings: [],
      errors: [`variável não suportada: ${cfg.variable}`],
    };
  const reference = buildPhysicalComparisonBaseline({
    companyId,
    baselineBundle,
    selectedScenario,
  });
  const baselineTotal = reference?.total_with_tax ?? null;
  const baselineUsable = baselineTotal != null;
  const sensitivity_results = (cfg.values || []).map((value) => {
    const scenario = clone(selectedScenario);
    scenario.scenario_id = `${selectedScenario.scenario_id}__sens_${cfg.variable}_${String(value).replace('.', '_')}`;
    scenario.changes = { ...(scenario.changes || {}), [cfg.variable]: value };
    const result = runScenario({
      companyId,
      scenario,
      baselineBundle,
      baselineMode: 'physical_unanchored',
    });
    const validResult = isNumericallyUsableScenarioResult(result);
    const usable = validResult && baselineUsable;
    const saving = usable
      ? calculateSaving({ baselineTotal, scenarioTotal: result.total_with_tax })
      : { saving_abs: null, saving_pct: null };
    return {
      variable: cfg.variable,
      value,
      status: usable ? 'success' : 'blocked',
      simulation_status: result.simulation_status || null,
      total_with_tax: usable ? Number(result.total_with_tax) : null,
      saving_abs: saving.saving_abs,
      saving_pct: saving.saving_pct,
      errors: [
        ...(result.errors || []),
        ...(!baselineUsable ? ['baseline indisponível para comparação'] : []),
      ],
      warnings: result.warnings || [],
    };
  });
  const vals = sensitivity_results.map((r) => r.total_with_tax);
  const slope = vals.some((value) => !Number.isFinite(value))
    ? null
    : vals.length > 1
      ? Math.abs(vals[vals.length - 1] - vals[0]) /
        Math.max(1, Math.abs((cfg.values || [])[vals.length - 1] - (cfg.values || [])[0]))
      : 0;
  return {
    company_id: companyId,
    scenario_id: selectedScenario?.scenario_id,
    sensitivity_results,
    analyzed_variable: cfg.variable,
    most_sensitive_variable: slope == null ? null : cfg.variable,
    sensitivity_slope: slope,
    warnings: [],
    errors: [],
  };
}

export function runSensitivityMatrix({
  companyId,
  selectedScenario,
  baselineBundle,
  matrixConfig = null,
} = {}) {
  const cfg = matrixConfig || {
    xVariable: 'freight_multiplier',
    yVariable: 'demand_multiplier',
    xValues: [0.9, 1, 1.1],
    yValues: [0.9, 1, 1.1],
  };
  const allowed = new Set(['freight_multiplier', 'demand_multiplier', 'inventory_days', 'wacc']);
  if (!allowed.has(cfg.xVariable) || !allowed.has(cfg.yVariable)) {
    return {
      company_id: companyId,
      scenario_id: selectedScenario?.scenario_id,
      x_variable: cfg.xVariable,
      y_variable: cfg.yVariable,
      matrix_results: [],
      warnings: [],
      errors: ['variável de matriz não suportada'],
    };
  }
  if (cfg.xVariable === cfg.yVariable) {
    return {
      company_id: companyId,
      scenario_id: selectedScenario?.scenario_id,
      x_variable: cfg.xVariable,
      y_variable: cfg.yVariable,
      matrix_results: [],
      warnings: [],
      errors: ['escolha duas variáveis diferentes para a matriz'],
    };
  }
  const reference = buildPhysicalComparisonBaseline({
    companyId,
    baselineBundle,
    selectedScenario,
  });
  const baselineTotal = reference?.total_with_tax ?? null;
  const baselineUsable = baselineTotal != null;
  const matrix_results = [];
  for (const yValue of cfg.yValues || []) {
    for (const xValue of cfg.xValues || []) {
      const scenario = clone(selectedScenario);
      scenario.scenario_id =
        `${selectedScenario.scenario_id}__matrix_${cfg.xVariable}_${xValue}_${cfg.yVariable}_${yValue}`.replace(
          /\./g,
          '_'
        );
      scenario.changes = {
        ...(scenario.changes || {}),
        [cfg.xVariable]: xValue,
        [cfg.yVariable]: yValue,
      };
      const result = runScenario({
        companyId,
        scenario,
        baselineBundle,
        baselineMode: 'physical_unanchored',
      });
      const validResult = isNumericallyUsableScenarioResult(result);
      const usable = validResult && baselineUsable;
      const total = usable ? Number(result.total_with_tax) : null;
      const saving = usable
        ? calculateSaving({ baselineTotal, scenarioTotal: total })
        : { saving_abs: null, saving_pct: null };
      matrix_results.push({
        x_variable: cfg.xVariable,
        y_variable: cfg.yVariable,
        x_value: xValue,
        y_value: yValue,
        status: usable ? 'success' : 'blocked',
        simulation_status: result.simulation_status || null,
        total_with_tax: total,
        saving_abs: saving.saving_abs,
        saving_pct: saving.saving_pct,
        errors: [
          ...(result.errors || []),
          ...(!baselineUsable ? ['baseline indisponível para comparação'] : []),
        ],
        warnings: result.warnings || [],
      });
    }
  }
  return {
    company_id: companyId,
    scenario_id: selectedScenario?.scenario_id,
    x_variable: cfg.xVariable,
    y_variable: cfg.yVariable,
    x_values: cfg.xValues || [],
    y_values: cfg.yValues || [],
    matrix_results,
    warnings: [],
    errors: [],
  };
}
