const RISK_ORDER={low:1,baixo:1,medium:2,medio:2,'médio':2,high:3,alto:3};
function riskVal(v){return RISK_ORDER[String(v||'medium').toLowerCase()]||2}
export function evaluateConstraints({scenarioResult,quality,scenario,constraints={}}){
  const violations=[]; const warnings=[]; const cds=scenario?.changes?.active_cds||scenarioResult?.scenario?.changes?.active_cds||[]; const activeCount=cds.length;
  const min=Number(constraints.min_active_cds??1), max=Number(constraints.max_active_cds??999); if(activeCount<min)violations.push(`CDs ativos abaixo do mínimo (${activeCount}<${min}).`); if(activeCount>max)violations.push(`CDs ativos acima do máximo (${activeCount}>${max}).`);
  const maxShare=Number(constraints.max_cd_volume_share??constraints.max_cd_concentration??1); const share=Number(quality?.quality_metrics?.max_cd_volume_share??0); if(share>maxShare)violations.push(`Concentração em CD acima do limite (${(share*100).toFixed(1)}% > ${(maxShare*100).toFixed(1)}%).`);
  const maxRisk=constraints.max_risk_level||'high'; if(riskVal(quality?.risk_level)>riskVal(maxRisk))violations.push(`Risco ${quality?.risk_level} acima do limite ${maxRisk}.`);
  const taxMode=scenario?.changes?.tax_mode||scenarioResult?.scenario?.changes?.tax_mode; const taxRegime=scenario?.changes?.tax_regime||scenarioResult?.scenario?.changes?.tax_regime; if(constraints.allow_tax_disabled===false && (taxMode==='disabled' || taxRegime==='disabled'))violations.push('Tributário desligado não permitido pela restrição.');
  return {scenario_id:scenarioResult?.scenario_id||scenario?.scenario_id,passes_constraints:violations.length===0,violations,warnings};
}
export function validateConstraintConfig(constraints={}){
  const errors=[];
  const min=Number(constraints.min_active_cds??1);
  const max=Number(constraints.max_active_cds??999);
  const share=Number(constraints.max_cd_volume_share??1);
  if(!Number.isFinite(min) || min<1)errors.push('min_active_cds precisa ser >= 1.');
  if(!Number.isFinite(max) || max<1)errors.push('max_active_cds precisa ser >= 1.');
  if(Number.isFinite(min) && Number.isFinite(max) && max<min)errors.push('max_active_cds precisa ser maior ou igual ao mínimo.');
  if(!Number.isFinite(share) || share<=0)errors.push('max_cd_volume_share precisa ser positivo.');
  return {valid:errors.length===0,errors,warnings:[]}
}
