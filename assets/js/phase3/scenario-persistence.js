function key(companyId){return `visagio_phase3_scenarios_${companyId}`}
export function loadSavedScenarios(companyId){try{return JSON.parse(localStorage.getItem(key(companyId))||'[]')}catch{return []}}
export function saveScenario(companyId,scenario){const list=loadSavedScenarios(companyId).filter(s=>s.scenario_id!==scenario.scenario_id); list.push(scenario); localStorage.setItem(key(companyId),JSON.stringify(list)); return {saved:true,storage_key:key(companyId),scenario_count:list.length}}
export function deleteScenario(companyId,scenarioId){const list=loadSavedScenarios(companyId).filter(s=>s.scenario_id!==scenarioId); localStorage.setItem(key(companyId),JSON.stringify(list)); return {deleted:true,storage_key:key(companyId),scenario_count:list.length}}
export function clearCompanyScenarios(companyId){localStorage.removeItem(key(companyId)); return {cleared:true,storage_key:key(companyId)}}
export function validateStoredScenario(companyId,scenario){return !!scenario && scenario.company_id===companyId && !!scenario.scenario_id && !!scenario.base_scenario_id}
