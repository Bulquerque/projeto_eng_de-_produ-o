import {loadPhase2Bundle, loadPhase3Samples} from '../shared/data-loader.js';
import {loadSavedScenarios} from './scenario-persistence.js';
export async function loadScenarioLibrary(companyId){
  const baselineBundle=await loadPhase2Bundle(companyId);
  let samples=[]; try{samples=await loadPhase3Samples(companyId)}catch(e){samples=[]}
  const baselineScenario={scenario_id:baselineBundle.model.scenario_id,scenario_name:'Baseline',company_id:companyId,base_scenario_id:baselineBundle.model.scenario_id,scenario_type:'baseline',changes:{active_cds:baselineBundle.model.active_cds||[],closed_cds:[],freight_multiplier:1,demand_multiplier:1,inventory_days:45,wacc:0.15,tax_mode:'current',tax_regime:'legacy_current',reallocation_rule:'nearest_available_cd'},metadata:{phase:3,source:'phase2_bundle',editable:false}};
  const saved=loadSavedScenarios(companyId).filter(s=>s.company_id===companyId);
  return {company_id:companyId,baselineBundle,scenarios:[baselineScenario,...samples,...saved],warnings:samples.length?[]:[{message:'Sem sample_scenarios.json; usando baseline e cenários salvos.'}],errors:[]}
}
