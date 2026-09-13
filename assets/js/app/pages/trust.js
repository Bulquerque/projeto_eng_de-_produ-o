import { selectDecision, selectEvidence } from '../selectors/business-selectors.js';
import {
  card,
  emptyState,
  escapeHtml,
  formatNumber,
  kpi,
  safeJson,
  statusChip,
  table,
} from '../view-helpers.js';

function auditForPresentation(audit) {
  if (!audit) return null;
  return {
    ...audit,
    data_sources: (audit.data_sources || []).map(
      () => 'Fonte protegida (detalhes no pacote de exportação)'
    ),
  };
}

export function renderTrustOverview(state) {
  const decision = selectDecision(state);
  const evidence = selectEvidence(state);
  return `<div class="ni-page-heading" data-testid="page-trust-overview"><p class="ni-eyebrow">Trust</p><h1>Dados e confiança</h1><p>Evidence, robustez, cobertura fiscal, busca e release aparecem como dimensões independentes.</p></div><div class="ni-kpi-grid">${kpi('Evidence', evidence?.evidence_score == null ? '—' : `${evidence.evidence_score}/100`)}${kpi('Robustez', decision.risk.robustness?.robustness_score == null ? '—' : `${decision.risk.robustness.robustness_score.toFixed(0)}/100`)}${kpi('QA', decision.final_qa?.final_qa_status || '—')}${kpi('Release', decision.release?.release_status || '—')}</div><div class="ni-grid two">${card('Estado da recomendação', decision.recommendation ? `<p>${statusChip(decision.recommendation.recommendation_status)}</p><p>${escapeHtml(decision.recommendation.executive_summary || '—')}</p>` : emptyState('Nenhuma recomendação calculada.'))}${card('Limitações', `<ul class="ni-list"><li>Robustez pode ser condicional.</li><li>Cobertura fiscal parcial permanece exploratória.</li><li>Busca limitada não é ótimo global.</li></ul>`)}</div>`;
}

export function renderTrustEvidence(state) {
  const evidence = selectEvidence(state);
  if (!evidence)
    return `<div class="ni-page-heading" data-testid="page-trust-evidence"><h1>Evidence</h1></div>${emptyState('Nenhum relatório de evidência disponível.')}`;
  return `<div class="ni-page-heading" data-testid="page-trust-evidence"><p class="ni-eyebrow">Trust · Evidence</p><h1>Evidence report</h1></div><div class="ni-kpi-grid">${kpi('Score', evidence.evidence_score == null ? '—' : `${evidence.evidence_score}/100`)}${kpi('Status', evidence.evidence_status || '—')}${kpi('Componentes', formatNumber(evidence.components?.length || 0))}${kpi('Blockers', formatNumber(evidence.blockers?.length || 0))}</div><div class="ni-card"><h2>Componentes</h2>${table(
    ['Componente', 'Status'],
    (evidence.components || []).map(
      (component) =>
        `<tr><td>${escapeHtml(component.name || component.id || '—')}</td><td>${escapeHtml(component.status || '—')}</td></tr>`
    ),
    'Nenhum componente informado.'
  )}</div>`;
}

export function renderTrustSources(state) {
  const decision = selectDecision(state);
  const sources = decision.audit?.data_sources || [];
  return `<div class="ni-page-heading" data-testid="page-trust-sources"><p class="ni-eyebrow">Trust · Sources</p><h1>Lineage e fontes</h1><p>Paths protegidos não são expostos como arquivos públicos na interface.</p></div><div class="ni-card"><h2>Fontes utilizadas</h2>${table(
    ['Fonte', 'Tratamento'],
    sources.map(
      (source) =>
        `<tr><td>Fonte protegida</td><td>${escapeHtml(source.includes('data-demo') ? 'fixture sintética' : 'carregada pelo provider do projeto')}</td></tr>`
    ),
    'Nenhuma fonte registrada.'
  )}</div>`;
}

export function renderTrustValidation(state) {
  const decision = selectDecision(state);
  const qa = decision.final_qa;
  const release = decision.release;
  const qaBody = qa
    ? `<p>${statusChip(qa.final_qa_status, qa.final_qa_status)}</p>${table(
        ['Check', 'Status', 'Mensagem'],
        (qa.checks || []).map(
          (check) =>
            `<tr><td>${escapeHtml(check.check)}</td><td>${escapeHtml(check.status)}</td><td>${escapeHtml(check.message)}</td></tr>`
        ),
        'Nenhum check executado.'
      )}`
    : emptyState('Final QA ainda não executado.');
  const releaseBody = release
    ? `<p>${statusChip(release.release_status, release.release_status)}</p><p>${escapeHtml((release.warnings || []).join(' ') || 'Sem avisos.')}</p>`
    : emptyState('Release ainda não validado.');
  const auditBody = decision.audit
    ? `<pre class="ni-json">${safeJson(auditForPresentation(decision.audit))}</pre>`
    : emptyState('Audit trail ainda não disponível.');
  return `<div class="ni-page-heading" data-testid="page-trust-validation"><p class="ni-eyebrow">Trust · Validation</p><h1>QA e release</h1></div><div class="ni-grid two">${card('Final QA', qaBody, { testId: 'qa-status' })}${card('Release', releaseBody, { testId: 'release-status' })}</div><div class="ni-card"><h2>Audit trail</h2>${auditBody}</div>`;
}

export function renderTrustMethodology(state) {
  const decision = selectDecision(state);
  return `<div class="ni-page-heading" data-testid="page-trust-methodology"><p class="ni-eyebrow">Trust · Methodology</p><h1>Metodologia</h1></div><div class="ni-card"><h2>Contrato de interpretação</h2><ul class="ni-list"><li>Engine atual é a fonte dos cálculos.</li><li>Monte Carlo mede incerteza paramétrica, não histórico automaticamente.</li><li>Evidence não é sinônimo de robustez.</li><li>Dados ausentes são exibidos como —.</li><li>O release depende do Final QA e do pacote de exportação.</li></ul><details><summary>Snapshot técnico</summary><pre class="ni-json">${safeJson({ company_id: state.context.company_id, status: state.meta.status, recommendation: decision.recommendation, release: decision.release })}</pre></details></div>`;
}
