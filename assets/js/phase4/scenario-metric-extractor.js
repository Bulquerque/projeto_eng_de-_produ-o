import { safeNumber } from '../core/common.js';

function riskToNumber(level) {
  const s = String(level || '').toLowerCase();
  if (s === 'low' || s === 'baixo') return 20;
  if (s === 'medium' || s === 'médio' || s === 'medio') return 55;
  if (s === 'high' || s === 'alto') return 90;
  return 50;
}
export function extractScenarioMetrics({ companyId, scenarioResults = [] }) {
  const warnings = [];
  const errors = [];
  const scenario_metrics = (scenarioResults || []).map((item) => {
    const result = item.result || item;
    const quality = item.quality || result.quality || {};
    const costs = result.costs || {};
    const total = safeNumber(
      result.total_with_tax,
      costs.total_with_tax ?? safeNumber(costs.total_logistics_cost) + safeNumber(costs.tax_impact)
    );
    const tax = safeNumber(result.tax_results?.total_tax_impact, costs.tax_impact);
    const q = safeNumber(quality.quality_score, 50);
    const risk = quality.risk_numeric ?? riskToNumber(quality.risk_level);
    const inv = safeNumber(costs.inventory_cost);
    const logistics = safeNumber(costs.total_logistics_cost);
    const invEfficiency = logistics > 0 ? Math.max(0, 100 * (1 - inv / logistics)) : 50;
    if (!result.scenario_id) warnings.push('resultado sem scenario_id encontrado.');
    return {
      scenario_id: result.scenario_id,
      scenario_name: result.scenario_name || result.scenario?.scenario_name || result.scenario_id,
      company_id: companyId,
      total_cost: total,
      service_quality: q,
      operational_risk: safeNumber(risk, 50),
      tax_impact: tax,
      inventory_efficiency: invEfficiency,
      raw: { total_with_tax: total, quality_score: q, risk_level: quality.risk_level || 'unknown' },
    };
  });
  return { company_id: companyId, scenario_metrics, warnings, errors };
}
