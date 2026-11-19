import { riskVal, SUPPORTED_RISK_LEVELS } from './optimizer-utils.js';

export function evaluateConstraints({ scenarioResult, quality, scenario, constraints = {} }) {
  const violations = [];
  const warnings = [];
  const cds = scenario?.changes?.active_cds || scenarioResult?.scenario?.changes?.active_cds || [];
  const activeCount = cds.length;
  const min = Number(constraints.min_active_cds ?? 1),
    max = Number(constraints.max_active_cds ?? 999);
  if (activeCount < min) violations.push(`CDs ativos abaixo do mínimo (${activeCount}<${min}).`);
  if (activeCount > max) violations.push(`CDs ativos acima do máximo (${activeCount}>${max}).`);
  const maxShare = Number(constraints.max_cd_volume_share ?? constraints.max_cd_concentration ?? 1);
  const share = Number(quality?.quality_metrics?.max_cd_volume_share);
  if (!Number.isFinite(share)) {
    violations.push('Concentração por CD indisponível; cenário não pode ser validado.');
  } else if (share > maxShare)
    violations.push(
      `Concentração em CD acima do limite (${(share * 100).toFixed(1)}% > ${(maxShare * 100).toFixed(1)}%).`
    );
  const maxRisk = constraints.max_risk_level || 'high';
  if (riskVal(quality?.risk_level) > riskVal(maxRisk))
    violations.push(`Risco ${quality?.risk_level} acima do limite ${maxRisk}.`);
  const taxMode = scenario?.changes?.tax_mode || scenarioResult?.scenario?.changes?.tax_mode;
  const taxRegime = scenario?.changes?.tax_regime || scenarioResult?.scenario?.changes?.tax_regime;
  if (
    constraints.allow_tax_disabled === false &&
    (taxMode === 'disabled' || taxRegime === 'disabled')
  )
    violations.push('Tributário desligado não permitido pela restrição.');
  return {
    scenario_id: scenarioResult?.scenario_id || scenario?.scenario_id,
    passes_constraints: violations.length === 0,
    violations,
    warnings,
  };
}
export function validateConstraintConfig(constraints = {}) {
  const errors = [];
  const min = Number(constraints.min_active_cds ?? 1);
  const max = Number(constraints.max_active_cds ?? 999);
  const share = Number(constraints.max_cd_volume_share ?? 1);
  if (!Number.isFinite(min) || min < 1) errors.push('min_active_cds precisa ser >= 1.');
  if (!Number.isFinite(max) || max < 1) errors.push('max_active_cds precisa ser >= 1.');
  if (Number.isFinite(min) && Number.isFinite(max) && max < min)
    errors.push('max_active_cds precisa ser maior ou igual ao mínimo.');
  if (!Number.isFinite(share) || share <= 0 || share > 1)
    errors.push('max_cd_volume_share precisa estar no intervalo (0,1].');
  const maxRisk = String(constraints.max_risk_level ?? 'high').toLowerCase();
  if (!SUPPORTED_RISK_LEVELS.includes(maxRisk))
    errors.push('max_risk_level precisa ser low, medium ou high.');
  if (
    typeof constraints.allow_tax_disabled !== 'undefined' &&
    typeof constraints.allow_tax_disabled !== 'boolean'
  )
    errors.push('allow_tax_disabled precisa ser booleano.');
  return { valid: errors.length === 0, errors, warnings: [] };
}
