const DIRECTIONS={total_cost:'lower_is_better',service_quality:'higher_is_better',operational_risk:'lower_is_better',tax_impact:'lower_is_better',inventory_efficiency:'higher_is_better'};
function n(v){const x=Number(v); return Number.isFinite(x)?x:null}
function scoreValue(value,min,max,direction){if(value===null)return 50; if(max===min)return 50; const raw=(value-min)/(max-min)*100; return Math.max(0,Math.min(100,direction==='lower_is_better'?100-raw:raw))}
export function normalizeMetrics({companyId,scenarioMetrics=[],metricDirections=DIRECTIONS,referenceMetrics=[]}){
  const warnings=[]; const metrics=Object.keys(metricDirections); const minmax={}; for(const m of metrics){const vals=scenarioMetrics.map(r=>n(r[m])).filter(v=>v!==null); if(!vals.length){minmax[m]={min:0,max:0}; warnings.push(`métrica ausente: ${m}`)} else minmax[m]={min:Math.min(...vals),max:Math.max(...vals)}}
  for(const m of metrics){
    const refs=referenceMetrics.map(r=>n(r[m])).filter(v=>v!==null);
    if(!refs.length) continue;
    const current=minmax[m]||{min:0,max:0};
    minmax[m]={min:Math.min(current.min,...refs),max:Math.max(current.max,...refs)};
  }
  const normalized_metrics=scenarioMetrics.map(row=>{const out={scenario_id:row.scenario_id,scenario_name:row.scenario_name,company_id:companyId}; for(const m of metrics){out[`${m}_score`]=scoreValue(n(row[m]),minmax[m].min,minmax[m].max,metricDirections[m])} return out});
  return {company_id:companyId,normalized_metrics,minmax,metric_directions:metricDirections,warnings,errors:[]};
}
export function defaultMetricDirections(){return {...DIRECTIONS}}
