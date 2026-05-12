import {buildScenarioFromForm} from '../phase3/scenario-builder.js';
function combinations(arr,k,limit=80){const out=[]; function rec(start,cur){if(out.length>=limit)return; if(cur.length===k){out.push([...cur]); return} for(let i=start;i<arr.length;i++){cur.push(arr[i]); rec(i+1,cur); cur.pop()}} rec(0,[]); return out}
function uniqueById(list){const m=new Map(); for(const x of list)m.set(JSON.stringify(x.changes),x); return [...m.values()]}
function uniqueSets(sets){
  const seen=new Set();
  const out=[];
  for(const set of sets){
    const key=JSON.stringify([...new Set(set||[])]);
    if(seen.has(key)) continue;
    seen.add(key);
    out.push([...new Set(set||[])]);
  }
  return out;
}
export function generateCandidateScenarios({companyId,baselineBundle,generationConfig={}}){
  const baseCds=baselineBundle?.model?.active_cds||[];
  const maxCandidates=Number(generationConfig.max_candidates??120);
  const freight=generationConfig.freight_multipliers||[0.95,1,1.1];
  const inv=generationConfig.inventory_days_options||[30,45,60];
  const baseTaxMode=generationConfig.base_tax_mode||'current';
  const baseTaxRegime=generationConfig.base_tax_regime||null;
  const tax=generationConfig.allow_tax_disabled ? [baseTaxMode,'disabled'] : [baseTaxMode];
  const demand=generationConfig.demand_multipliers||[0.95,1,1.05];
  const cdSets=[];
  if(baseCds.length)cdSets.push(baseCds);
  for(const cd of baseCds.slice(0,Math.min(baseCds.length,10)))cdSets.push([cd]);
  for(let i=0;i<baseCds.length && cdSets.length<50;i++)cdSets.push(baseCds.filter((_,idx)=>idx!==i));
  const maxPairBase=baseCds.slice(0,Math.min(4,baseCds.length));
  for(const c of combinations(maxPairBase,2,40))cdSets.push(c);
  const maxTripleBase=baseCds.slice(0,Math.min(4,baseCds.length));
  for(const c of combinations(maxTripleBase,3,30))cdSets.push(c);
  const cdSetsUnique=uniqueSets(cdSets);
  const candidates=[];
  let idx=1;
  outer: for(const cds of cdSetsUnique){
    for(const fm of freight){
      for(const days of inv){
        for(const tm of tax){
          for(const dm of demand){
            const name=`Candidato ${String(idx).padStart(3,'0')} · ${cds.length} CD(s)`;
            const s=buildScenarioFromForm({companyId,baselineBundle,scenarioId:`${companyId}_candidate_${String(idx).padStart(3,'0')}`,formValues:{scenario_name:name,active_cds:cds,freight_multiplier:fm,demand_multiplier:dm,inventory_days:days,wacc:0.15,tax_mode:tm,tax_regime:baseTaxRegime,reallocation_rule:'nearest_available_cd',scenario_type:'candidate'}});
            candidates.push(s);
            idx++;
            if(Number.isFinite(maxCandidates) && candidates.length>=maxCandidates)break outer;
          }
        }
      }
    }
  }
  const candidate_scenarios=uniqueById(candidates);
  const candidate_space_size=cdSetsUnique.length*freight.length*inv.length*tax.length*demand.length;
  const limited_by_max_candidates=Number.isFinite(maxCandidates) && candidates.length>=maxCandidates && candidate_space_size>maxCandidates;
  return {company_id:companyId,candidate_scenarios: Number.isFinite(maxCandidates) ? candidate_scenarios.slice(0,maxCandidates) : candidate_scenarios,generation_summary:{generated:candidate_scenarios.length,candidate_space_size,cd_set_count:cdSetsUnique.length,limited_by_max_candidates,max_candidates:maxCandidates},warnings:[],errors:[]};
}
