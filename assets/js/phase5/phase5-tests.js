import { buildStressCaseLibrary } from './stress-case-library.js';
import { applyStressCaseToScenario, runStressTests } from './stress-test-engine.js';
import { calculateRobustness } from './robustness-scorer.js';
import { buildRecommendation } from './recommendation-engine.js';
import { buildAuditTrail, validateAuditTrail } from './audit-trail-engine.js';
import { buildExportPackage } from './export-center.js';
export function runPhase5BrowserChecks({ companyId, bundle, selectedScenario, stress, robustness, recommendation, audit } = {}) {
  const checks = [];
  function add(module, test, pass, message) { checks.push({ module, test, pass: Boolean(pass), status: pass ? 'OK' : 'FAIL', message }); }
  const cases = buildStressCaseLibrary({ companyId }).stress_cases;
  add('StressCaseLibrary', 'casos padrão existem', cases.length >= 7, `${cases.length} casos`);
  if (selectedScenario?.scenario) {
    const original = JSON.stringify(selectedScenario.scenario);
    const stressed = applyStressCaseToScenario({ scenario: selectedScenario.scenario, stressCase: cases.find(c => c.case_id === 'frete_mais_20') || cases[0] });
    add('StressTestEngine', 'stress não altera cenário original', JSON.stringify(selectedScenario.scenario) === original && stressed.scenario_id !== selectedScenario.scenario.scenario_id, 'clone preservado');
  } else add('StressTestEngine', 'stress não altera cenário original', false, 'sem cenário selecionado');
  add('StressTestEngine', 'stress test roda', Boolean(stress?.stress_results?.length), `${stress?.stress_results?.length || 0} casos`);
  add('RobustnessScorer', 'score entre 0 e 100', robustness?.robustness_score >= 0 && robustness?.robustness_score <= 100, String(robustness?.robustness_score));
  add('RecommendationEngine', 'recomendação tem status', Boolean(recommendation?.recommendation_status), recommendation?.recommendation_status || 'ausente');
  const auditValidation = validateAuditTrail(audit || {});
  add('AuditTrailEngine', 'audit trail completo', auditValidation.valid, auditValidation.errors.join('; ') || 'ok');
  const exportPkg = buildExportPackage({ companyId, decisionPackage: { test: true }, stress, audit, recommendation, selectedScenario, robustness });
  add('ExportCenter', 'export JSON/CSV/HTML preparado', exportPkg.files?.length >= 3 && exportPkg.files.every(f => f.content), `${exportPkg.files?.length || 0} arquivos`);
  add('CompanyIsolation', 'empresa isolada', audit?.company_id === companyId && bundle?.model?.company_id === companyId, 'company_id consistente');
  return checks;
}
export function renderPhase5Checks(checks) {
  return checks.map(c => `<div class="check-item ${c.pass ? 'is-ok' : 'is-fail'}"><span><span class="check-title">${c.pass ? '✓' : '✕'} ${c.module} · ${c.test}</span><span class="check-detail">${c.message}</span></span></div>`).join('');
}
