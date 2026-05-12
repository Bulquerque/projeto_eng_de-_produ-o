import { runScenario } from '../phase3/scenario-simulator.js';
function clone(obj) { return JSON.parse(JSON.stringify(obj || {})); }
function n(v, d = 0) { const x = Number(v); return Number.isFinite(x) ? x : d; }
export function runSensitivity({ companyId, selectedScenario, baselineBundle, sensitivityConfig = null } = {}) {
  const cfg = sensitivityConfig || { variable: 'freight_multiplier', values: [0.9, 1.0, 1.1, 1.2] };
  const allowed = new Set(['freight_multiplier', 'demand_multiplier', 'inventory_days', 'wacc']);
  if (!allowed.has(cfg.variable)) return { company_id: companyId, scenario_id: selectedScenario?.scenario_id, sensitivity_results: [], most_sensitive_variable: null, warnings: [], errors: [`variável não suportada: ${cfg.variable}`] };
  const baselineTotal = n(baselineBundle?.costs?.costs?.total_with_tax);
  const sensitivity_results = (cfg.values || []).map(value => {
    const scenario = clone(selectedScenario);
    scenario.scenario_id = `${selectedScenario.scenario_id}__sens_${cfg.variable}_${String(value).replace('.', '_')}`;
    scenario.changes = { ...(scenario.changes || {}), [cfg.variable]: value };
    const result = runScenario({ companyId, scenario, baselineBundle });
    const saving_pct = baselineTotal ? ((baselineTotal - n(result.total_with_tax)) / baselineTotal) * 100 : 0;
    return { variable: cfg.variable, value, total_with_tax: n(result.total_with_tax), saving_pct, errors: result.errors || [], warnings: result.warnings || [] };
  });
  const vals = sensitivity_results.map(r => r.total_with_tax);
  const slope = vals.length > 1 ? Math.abs(vals[vals.length - 1] - vals[0]) / Math.max(1, Math.abs((cfg.values || [])[vals.length - 1] - (cfg.values || [])[0])) : 0;
  return { company_id: companyId, scenario_id: selectedScenario?.scenario_id, sensitivity_results, most_sensitive_variable: cfg.variable, sensitivity_slope: slope, warnings: [], errors: [] };
}

export function runSensitivityMatrix({ companyId, selectedScenario, baselineBundle, matrixConfig = null } = {}) {
  const cfg = matrixConfig || { xVariable: 'freight_multiplier', yVariable: 'demand_multiplier', xValues: [0.9, 1, 1.1], yValues: [0.9, 1, 1.1] };
  const allowed = new Set(['freight_multiplier', 'demand_multiplier', 'inventory_days', 'wacc']);
  if (!allowed.has(cfg.xVariable) || !allowed.has(cfg.yVariable)) {
    return { company_id: companyId, scenario_id: selectedScenario?.scenario_id, x_variable: cfg.xVariable, y_variable: cfg.yVariable, matrix_results: [], warnings: [], errors: ['variável de matriz não suportada'] };
  }
  if (cfg.xVariable === cfg.yVariable) {
    return { company_id: companyId, scenario_id: selectedScenario?.scenario_id, x_variable: cfg.xVariable, y_variable: cfg.yVariable, matrix_results: [], warnings: [], errors: ['escolha duas variáveis diferentes para a matriz'] };
  }
  const baselineTotal = n(baselineBundle?.costs?.costs?.total_with_tax);
  const matrix_results = [];
  for (const yValue of cfg.yValues || []) {
    for (const xValue of cfg.xValues || []) {
      const scenario = clone(selectedScenario);
      scenario.scenario_id = `${selectedScenario.scenario_id}__matrix_${cfg.xVariable}_${xValue}_${cfg.yVariable}_${yValue}`.replaceAll('.', '_');
      scenario.changes = { ...(scenario.changes || {}), [cfg.xVariable]: xValue, [cfg.yVariable]: yValue };
      const result = runScenario({ companyId, scenario, baselineBundle });
      const total = n(result.total_with_tax);
      const saving_abs = baselineTotal - total;
      matrix_results.push({
        x_variable: cfg.xVariable,
        y_variable: cfg.yVariable,
        x_value: xValue,
        y_value: yValue,
        total_with_tax: total,
        saving_abs,
        saving_pct: baselineTotal ? (saving_abs / baselineTotal) * 100 : 0,
        errors: result.errors || [],
        warnings: result.warnings || []
      });
    }
  }
  return { company_id: companyId, scenario_id: selectedScenario?.scenario_id, x_variable: cfg.xVariable, y_variable: cfg.yVariable, x_values: cfg.xValues || [], y_values: cfg.yValues || [], matrix_results, warnings: [], errors: [] };
}
