import { readStorageJSON, removeStorageKey, writeStorageJSON } from '../shared/browser-storage.js';

function key(companyId) {
  return `visagio_phase3_scenarios_${companyId}`;
}
export function loadSavedScenarios(companyId) {
  return readStorageJSON('local', key(companyId), []);
}
export function saveScenario(companyId, scenario) {
  const list = loadSavedScenarios(companyId).filter((s) => s.scenario_id !== scenario.scenario_id);
  list.push(scenario);
  const saved = writeStorageJSON('local', key(companyId), list);
  return { saved, storage_key: key(companyId), scenario_count: saved ? list.length : 0 };
}
export function deleteScenario(companyId, scenarioId) {
  const list = loadSavedScenarios(companyId).filter((s) => s.scenario_id !== scenarioId);
  const saved = writeStorageJSON('local', key(companyId), list);
  return { deleted: saved, storage_key: key(companyId), scenario_count: saved ? list.length : 0 };
}
export function clearCompanyScenarios(companyId) {
  const cleared = removeStorageKey('local', key(companyId));
  return { cleared, storage_key: key(companyId) };
}
export function validateStoredScenario(companyId, scenario) {
  return (
    !!scenario &&
    scenario.company_id === companyId &&
    !!scenario.scenario_id &&
    !!scenario.base_scenario_id
  );
}
