function n(v,d=0){const x=Number(v); return Number.isFinite(x)?x:d}
export function scoreScenarios({companyId,objective,normalizedMetrics=[]}){
  const weights=objective?.weights||{}; const warnings=[]; const scored_scenarios=normalizedMetrics.map(row=>{const score_components={}; let final=0; for(const [metric,weight] of Object.entries(weights)){const component=n(row[`${metric}_score`])*n(weight); score_components[metric]=component; final+=component} final=Math.max(0,Math.min(100,final)); return {scenario_id:row.scenario_id,scenario_name:row.scenario_name,company_id:companyId,final_score:final,score_components,rank:null}}).sort((a,b)=>b.final_score-a.final_score).map((r,i)=>({...r,rank:i+1}));
  if(!scored_scenarios.length)warnings.push('Nenhum cenário para ranquear.'); return {company_id:companyId,scored_scenarios,warnings,errors:[]};
}
export function getBestScenario(scored){return (scored?.scored_scenarios||[])[0]||null}
