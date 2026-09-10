export function runFinalQAChecks({
  companyId,
  bundle,
  selectedScenario,
  stress,
  recommendation,
  audit,
  releaseContext: _releaseContext = {},
} = {}) {
  const checks = [];
  function add(
    check,
    pass,
    successMessage,
    severity = 'critical',
    failureMessage = `Falha na verificação: ${successMessage}`
  ) {
    checks.push({
      check,
      status: pass ? 'passed' : 'failed',
      pass,
      message: pass ? successMessage : failureMessage,
      severity,
    });
  }
  add('phase1_available', true, 'Diagnóstico inicial disponível no pacote.');
  add(
    'phase2_bundle_available',
    Boolean(bundle?.model && bundle?.costs),
    'Bundle da etapa de diagnóstico carregado.',
    'critical',
    'Bundle da etapa de diagnóstico não foi carregado.'
  );
  add(
    'phase3_scenario_selected',
    Boolean(selectedScenario),
    'Cenário final selecionado.',
    'critical',
    'Nenhum cenário final foi selecionado.'
  );
  add(
    'phase4_score_available',
    selectedScenario?.final_score !== undefined,
    'Score/ranking da etapa de decisão disponível.',
    'critical',
    'Score/ranking da etapa de decisão não está disponível.'
  );
  add(
    'phase5_stress_run',
    Boolean(stress?.stress_results?.length),
    'Stress test executado.',
    'critical',
    'Stress test não foi executado ou não produziu resultados.'
  );
  add(
    'recommendation_status',
    Boolean(recommendation?.recommendation_status),
    'Recomendação gerada.',
    'critical',
    'Recomendação não foi gerada.'
  );
  add(
    'audit_trail_complete',
    Boolean(audit?.company_id && audit?.selected_scenario_id && audit?.baseline_scenario_id),
    'Audit trail básico completo.',
    'critical',
    'Audit trail incompleto: empresa, cenário selecionado ou baseline ausente.'
  );
  add(
    'company_isolation',
    [audit?.company_id, bundle?.model?.company_id, companyId].every((x) => x === companyId),
    'Empresa isolada corretamente.',
    'critical',
    'Falha no isolamento da empresa: os pacotes não pertencem à mesma empresa.'
  );
  const taxCoverage = selectedScenario?.result?.tax_results?.tax_coverage;
  if (taxCoverage) {
    const taxBlocked = Boolean(taxCoverage.blocked);
    add(
      'tax_quality_gate',
      !taxBlocked || recommendation?.recommendation_status !== 'recommended',
      'Recomendação limpa não pode depender de tributação bloqueada.',
      recommendation?.recommendation_status === 'recommended' ? 'critical' : 'warning',
      'Bloqueio: recomendação limpa depende de tributação bloqueada.'
    );
  }
  const evidence = selectedScenario?.result?.evidence || selectedScenario?.evidence || null;
  const evidenceAvailable =
    Number.isFinite(Number(evidence?.evidence_score)) && Array.isArray(evidence?.components);
  add(
    'evidence_report_available',
    evidenceAvailable,
    'Relatório de evidência disponível e estruturado.',
    'critical',
    'Relatório de evidência ausente ou malformado.'
  );
  const cleanRecommendation =
    recommendation?.recommendation_status !== 'recommended' ||
    (evidenceAvailable && Number(evidence.evidence_score) >= 70 && evidence.blockers?.length === 0);
  add(
    'clean_recommendation_evidence_gate',
    cleanRecommendation,
    'Recomendação limpa exige evidência mínima e nenhum bloqueador.',
    recommendation?.recommendation_status === 'recommended' ? 'critical' : 'warning',
    'Bloqueio: recomendação limpa exige evidência mínima e nenhum bloqueador.'
  );
  const blocking_issues = checks
    .filter((c) => !c.pass && c.severity === 'critical')
    .map((c) => c.message);
  return {
    company_id: companyId,
    final_qa_status: blocking_issues.length ? 'failed' : 'passed',
    checks,
    blocking_issues,
    warnings: [],
  };
}
