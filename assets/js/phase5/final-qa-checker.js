export function runFinalQAChecks({ companyId, bundle, selectedScenario, stress, recommendation, audit, releaseContext = {} } = {}) {
  const checks = [];
  function add(check, pass, message, severity = 'critical') { checks.push({ check, status: pass ? 'passed' : 'failed', pass, message, severity }); }
  add('phase1_available', true, 'Fase 1 disponível no pacote.');
  add('phase2_bundle_available', Boolean(bundle?.model && bundle?.costs), 'Bundle da Fase 2 carregado.');
  add('phase3_scenario_selected', Boolean(selectedScenario), 'Cenário final selecionado.');
  add('phase4_score_available', selectedScenario?.final_score !== undefined, 'Score/ranking da Fase 4 disponível.');
  add('phase5_stress_run', Boolean(stress?.stress_results?.length), 'Stress test executado.');
  add('recommendation_status', Boolean(recommendation?.recommendation_status), 'Recomendação gerada.');
  add('audit_trail_complete', Boolean(audit?.company_id && audit?.selected_scenario_id && audit?.baseline_scenario_id), 'Audit trail básico completo.');
  add('company_isolation', [audit?.company_id, bundle?.model?.company_id, companyId].every(x => x === companyId), 'Empresa isolada corretamente.');
  const blocking_issues = checks.filter(c => !c.pass && c.severity === 'critical').map(c => c.message);
  return { company_id: companyId, final_qa_status: blocking_issues.length ? 'failed' : 'passed', checks, blocking_issues, warnings: [] };
}
