import { isNumericallyUsableScenarioResult } from '../core/analysis-quality.js';

const DESTINATION_FLOW_TYPES = new Set([
  'distribution',
  'cd_to_customer',
  'cd_to_destination',
  'cd_to_destination_proxy',
  'cd_to_retail',
  'distribution_flow',
]);

function finitePositive(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function unavailableQuality(scenarioResult, message) {
  return {
    scenario_id: scenarioResult?.scenario_id ?? null,
    quality_score: null,
    risk_level: null,
    quality_metrics: null,
    concentration_measure_basis: null,
    evidence_score: null,
    evidence_status: 'unknown',
    evidence_blockers: [],
    alerts: [{ severity: 'error', type: 'simulation', message }],
  };
}

function normalizeFlowType(flow) {
  const type = flow?.flow_type ?? flow?.type;
  return type == null
    ? ''
    : String(type)
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
}

function isDestinationFlow(flow) {
  const type = normalizeFlowType(flow);
  if (DESTINATION_FLOW_TYPES.has(type)) return true;
  return (
    !type &&
    Boolean(flow?.cd || flow?.assigned_cd) &&
    Boolean(flow?.destination || flow?.destination_uf || flow?.destination_city)
  );
}

function getConcentrationMeasure(flows) {
  const destinationFlows = flows.filter(isDestinationFlow);
  const factoryToCdFlows = flows.filter((flow) => normalizeFlowType(flow) === 'factory_to_cd');
  const targetFlows = destinationFlows.length ? destinationFlows : factoryToCdFlows;
  if (!targetFlows.length) return null;

  const cdByFlow = targetFlows.map((flow) => flow.cd || flow.assigned_cd || null);
  if (cdByFlow.some((cd) => !cd)) return null;

  const weightValues = targetFlows.map((flow) =>
    finitePositive(flow.annual_weight_kg ?? flow.weight_kg)
  );
  const revenueValues = destinationFlows.map((flow) =>
    finitePositive(flow.annual_revenue ?? flow.revenue)
  );

  let values;
  let basis;
  if (weightValues.every((value) => value != null)) {
    values = weightValues;
    basis = destinationFlows.length ? 'cd_to_destination_weight_kg' : 'factory_to_cd_weight_kg';
  } else if (destinationFlows.length && revenueValues.every((value) => value != null)) {
    values = revenueValues;
    basis = 'cd_to_destination_revenue';
  } else {
    return null;
  }

  const measureByCd = new Map();
  targetFlows.forEach((flow, index) => {
    const cd = cdByFlow[index];
    measureByCd.set(cd, (measureByCd.get(cd) || 0) + values[index]);
  });
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  const maxShare = Math.max(...measureByCd.values()) / total;
  return Number.isFinite(maxShare) ? { maxShare, basis } : null;
}

export function evaluateScenarioQuality({ scenarioResult, baselineBundle, qualityRules = {} }) {
  if (!isNumericallyUsableScenarioResult(scenarioResult)) {
    return unavailableQuality(
      scenarioResult,
      'Qualidade indisponível: simulação ou custos inválidos.'
    );
  }

  const baseValue = finitePositive(baselineBundle?.costs?.costs?.total_with_tax);
  if (baseValue == null) {
    return unavailableQuality(
      scenarioResult,
      'Qualidade indisponível: custo do baseline ausente ou inválido.'
    );
  }

  const flows = Array.isArray(scenarioResult.flows) ? scenarioResult.flows : [];
  const concentration = getConcentrationMeasure(flows);
  if (!concentration) {
    return unavailableQuality(
      scenarioResult,
      'Qualidade indisponível: não há um conjunto completo de fluxos com unidade consistente para medir concentração.'
    );
  }

  const totalFlows = flows.length;
  const reallocated = scenarioResult.flow_summary?.reallocated_flows || 0;
  const flowCount = Math.max(1, scenarioResult.flow_summary?.total_flows || totalFlows || 1);
  const reallocShare = reallocated / flowCount;
  const missing = (scenarioResult.flow_summary?.uncovered_flows || 0) / flowCount;
  const maxCd = qualityRules.max_cd_volume_share ?? 0.75;
  const maxRe = qualityRules.max_reallocated_flow_share ?? 0.5;
  const maxMissing = qualityRules.max_missing_distance_share ?? 0.05;
  const alerts = [];
  let score = 100;
  if (concentration.maxShare > maxCd) {
    alerts.push({
      severity: 'warning',
      type: 'concentration',
      message: `Maior concentração em CD: ${(concentration.maxShare * 100).toFixed(1)}%.`,
    });
    score -= Math.min(35, (concentration.maxShare - maxCd) * 100);
  }
  if (reallocShare > 0) {
    alerts.push({
      severity: reallocShare > maxRe ? 'warning' : 'info',
      type: 'reallocation',
      message: `${(reallocShare * 100).toFixed(1)}% dos fluxos foram realocados.`,
    });
    score -= Math.min(25, reallocShare * 30);
  }
  if (missing > maxMissing) {
    alerts.push({
      severity: 'error',
      type: 'coverage',
      message: `${(missing * 100).toFixed(1)}% dos fluxos ficaram sem atendimento.`,
    });
    score -= 40;
  }
  const scenarioValue = Number(scenarioResult.total_with_tax);
  const delta = (scenarioValue - baseValue) / baseValue;
  if (delta > 0.1) {
    alerts.push({
      severity: 'warning',
      type: 'cost',
      message: `Custo aumentou ${(delta * 100).toFixed(1)}% contra o baseline.`,
    });
    score -= 10;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const risk = score >= 85 ? 'low' : score >= 65 ? 'medium' : 'high';
  return {
    scenario_id: scenarioResult.scenario_id,
    quality_score: score,
    risk_level: risk,
    concentration_measure_basis: concentration.basis,
    quality_metrics: {
      max_cd_volume_share: concentration.maxShare,
      concentration_measure_basis: concentration.basis,
      reallocated_flow_share: reallocShare,
      uncovered_flow_share: missing,
      cost_increase_pct: delta,
    },
    evidence_score: scenarioResult?.evidence?.evidence_score ?? null,
    evidence_status: scenarioResult?.evidence?.evidence_status ?? 'unknown',
    evidence_blockers: scenarioResult?.evidence?.blockers || [],
    alerts,
  };
}
