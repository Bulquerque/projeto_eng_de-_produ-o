import {flowMeasure} from './scenario-flow-rebuilder.js';
function pct(part,total){return total?part/total:0}
export function evaluateScenarioQuality({scenarioResult,baselineBundle,qualityRules={}}){
  const flows=scenarioResult?.flows||[]; const total=flows.reduce((a,f)=>a+flowMeasure(f),0); const byCd={}; flows.forEach(f=>{const cd=f.cd||'SEM_CD'; byCd[cd]=(byCd[cd]||0)+flowMeasure(f)});
  const maxShare=Math.max(0,...Object.values(byCd).map(v=>pct(v,total))); const reallocated=(scenarioResult?.flow_summary?.reallocated_flows||0); const flowCount=Math.max(1,scenarioResult?.flow_summary?.total_flows||flows.length||1); const reallocShare=reallocated/flowCount; const missing=(scenarioResult?.flow_summary?.uncovered_flows||0)/flowCount;
  const maxCd=qualityRules.max_cd_volume_share??0.75; const maxRe=qualityRules.max_reallocated_flow_share??0.5; const maxMissing=qualityRules.max_missing_distance_share??0.05;
  const alerts=[]; let score=100;
  if(maxShare>maxCd){alerts.push({severity:'warning',type:'concentration',message:`Maior concentração em CD: ${(maxShare*100).toFixed(1)}%.`}); score-=Math.min(35,(maxShare-maxCd)*100)}
  if(reallocShare>0){alerts.push({severity:reallocShare>maxRe?'warning':'info',type:'reallocation',message:`${(reallocShare*100).toFixed(1)}% dos fluxos foram realocados.`}); score-=Math.min(25,reallocShare*30)}
  if(missing>maxMissing){alerts.push({severity:'error',type:'coverage',message:`${(missing*100).toFixed(1)}% dos fluxos ficaram sem atendimento.`}); score-=40}
  const baseTotal=baselineBundle?.costs?.costs?.total_with_tax||0; const delta=baseTotal?((scenarioResult.total_with_tax-baseTotal)/baseTotal):0; if(delta>0.1){alerts.push({severity:'warning',type:'cost',message:`Custo aumentou ${(delta*100).toFixed(1)}% contra o baseline.`}); score-=10}
  score=Math.max(0,Math.min(100,Math.round(score))); const risk=score>=85?'low':score>=65?'medium':'high';
  return {scenario_id:scenarioResult.scenario_id,quality_score:score,risk_level:risk,quality_metrics:{max_cd_volume_share:maxShare,reallocated_flow_share:reallocShare,uncovered_flow_share:missing,cost_increase_pct:delta},alerts}
}
