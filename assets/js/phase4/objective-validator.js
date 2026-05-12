const KNOWN_METRICS=['total_cost','service_quality','operational_risk','tax_impact','inventory_efficiency'];
function n(v){const x=Number(v); return Number.isFinite(x)?x:NaN}
export function validateObjective(objective){
  const errors=[]; const warnings=[]; const weights=objective?.weights||{};
  if(!objective?.company_id)errors.push('objective sem company_id.');
  if(!weights||Object.keys(weights).length===0)errors.push('objective sem pesos.');
  const missing=[]; let positive=0; let sum=0;
  for(const key of Object.keys(weights)){if(!KNOWN_METRICS.includes(key))missing.push(key); const val=n(weights[key]); if(!Number.isFinite(val))errors.push(`peso não numérico: ${key}`); else {if(val<0)errors.push(`peso negativo: ${key}`); if(val>0)positive++; sum+=val;}}
  if(missing.length)errors.push(`métricas desconhecidas: ${missing.join(', ')}`);
  if(positive===0)errors.push('todos os pesos estão zerados.');
  if(sum>0 && Math.abs(sum-1)>1e-6)warnings.push(`pesos somam ${sum.toFixed(4)}; serão normalizados no builder.`);
  return {objective_id:objective?.objective_id,valid:errors.length===0,weights_sum:sum,available_metrics:KNOWN_METRICS,missing_metrics:missing,warnings,errors};
}
export function knownMetrics(){return [...KNOWN_METRICS]}
