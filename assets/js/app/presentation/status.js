const STATUS_LABELS = Object.freeze({
  pass: 'Aprovado',
  passed: 'Aprovado',
  success: 'Aprovado',
  ok: 'Aprovado',
  fail: 'Reprovado',
  failed: 'Reprovado',
  error: 'Erro',
  warning: 'Com ressalvas',
  warn: 'Com ressalvas',
  blocked: 'Bloqueado',
  pending: 'Pendente',
  not_run: 'Não executado',
  skipped: 'Ignorado',
  ready: 'Pronto',
  not_ready: 'Não pronto',
  draft: 'Em elaboração',
  released: 'Liberado',
  observed: 'Observado',
  partially_observed: 'Parcialmente observado',
  proxy: 'Proxy',
  fallback: 'Alternativo',
  parameter: 'Parâmetro',
  projection: 'Projeção',
  reconciled: 'Reconciliado',
  unknown: 'Não classificado',
  synthetic: 'Sintético',
  synthetic_fixture: 'Demonstrativo sintético',
  recommended: 'Recomendado',
  recommended_with_warnings: 'Recomendado com ressalvas',
  not_recommended: 'Não recomendado',
  baseline_ready: 'Baseline carregado',
  demo_only: 'Apenas demonstração',
  exploratory_only: 'Apenas exploratório',
  decision_support: 'Apoio à decisão',
  mock_policy: 'Isolamento da demonstração',
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  critical: 'Crítico',
  conditional: 'Condicional',
  certified: 'Certificado',
  not_applicable: 'Não se aplica',
  unavailable: 'Indisponível',
  partial: 'Parcial',
  complete: 'Completo',
  source_missing: 'Fonte ausente',
  scenario_ready: 'Cenário calculado',
});

export function userStatusLabel(value, fallback = 'Não informado') {
  if (value == null || value === '') return fallback;
  const key = String(value).trim().toLowerCase();
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  return key.replace(/[_-]+/g, ' ').replace(/^./, (letter) => letter.toLocaleUpperCase('pt-BR'));
}

export function evidenceClassLabel(value) {
  return (
    {
      observed: 'Observado',
      partially_observed: 'Parcialmente observado',
      proxy: 'Proxy',
      fallback: 'Fallback',
      parameter: 'Parâmetro',
      projection: 'Projeção',
      reconciled: 'Reconciliado',
      unknown: 'Não classificado',
      synthetic: 'Sintético',
    }[value] ||
    value ||
    'Não informado'
  );
}

export function robustnessPresentation(robustness) {
  const score = (value) =>
    value == null ||
    value === '' ||
    !Number.isFinite(Number(value)) ||
    Number(value) < 0 ||
    Number(value) > 100
      ? null
      : Number(value);
  const certified = score(robustness?.certified_robustness_score);
  if (certified != null) {
    return {
      label: 'Robustez certificada',
      value: certified,
      note: 'Escopo certificado na origem',
    };
  }
  const conditional = score(robustness?.conditional_robustness_score);
  if (conditional != null) {
    return {
      label: 'Robustez condicional',
      value: conditional,
      note: 'Válida sob as premissas e cenários avaliados; não certificada',
    };
  }
  const reported = score(robustness?.robustness_score);
  if (reported != null) {
    const interpretation = robustness?.robustness_interpretation;
    return {
      label: 'Robustez informada',
      value: reported,
      note: interpretation ? userStatusLabel(interpretation) : 'Escopo conforme registro de origem',
    };
  }
  return { label: 'Robustez', value: null, note: 'Não calculada' };
}
