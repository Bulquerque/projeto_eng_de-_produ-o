import { selectDecision, selectEvidence } from '../selectors/business-selectors.js';
import { renderRiskAnalysis } from './results.js';
import {
  businessLabel,
  emptyState,
  escapeHtml,
  formatNumber,
  kpi,
  safeJson,
  sectionTabs,
  statusChip,
  table,
} from '../view-helpers.js';

function page(title, testId, body, state) {
  return `<section class="ni-workspace ni-workspace-page ni-trust" data-testid="${testId}"><header class="ni-page-heading"><h1>${title}</h1></header>${sectionTabs('trust', state.ui?.route)}${body}</section>`;
}

function evidenceScore(state) {
  if (state.context?.provider_kind === 'mock') return '—';
  const score = selectEvidence(state)?.evidence_score;
  return score == null ? '—' : `${formatNumber(score)}/100`;
}

function auditForPresentation(audit) {
  if (!audit) return null;
  return {
    ...audit,
    data_sources: (audit.data_sources || []).map(
      () => 'Fonte protegida (detalhes no pacote de exportação)'
    ),
  };
}

function trustStatusLabel(status) {
  const labels = {
    'scenario ready': 'Resultado calculado',
    success: 'Validado',
    'success with tax limits': 'Validado com limites fiscais',
    failed: 'Falhou',
    blocked: 'Bloqueada',
    not_recommended: 'Não recomendado',
  };
  return labels[status] || businessLabel(status || 'indisponível');
}

export function renderTrustOverview(state) {
  const decision = selectDecision(state);
  const evidence = selectEvidence(state);
  const mock = state.context?.provider_kind === 'mock';
  const risk = decision.risk || {};
  const scenario = decision.scenario;
  const recommendation = decision.recommendation;
  const blockers = [
    ...(recommendation?.blockers || []),
    ...(recommendation?.warnings || []),
    ...(decision.final_qa?.blocking_issues || []),
    ...(evidence?.blockers || []),
  ].filter(Boolean);
  const status =
    recommendation?.recommendation_status ||
    decision.final_qa?.final_qa_status ||
    state.meta?.status;
  const decisionSummary = decision.result
    ? `<section class="ni-trust-decision" data-testid="trust-decision-summary"><div><span class="ni-eyebrow">Decisão da análise</span><h2>${escapeHtml(scenario?.scenario_name || 'Cenário avaliado')}</h2><p>${escapeHtml(recommendation?.executive_summary || 'Resultado calculado a partir das premissas selecionadas.')}</p></div><div class="ni-trust-decision-status">${statusChip(status, trustStatusLabel(status))}<a class="ni-button secondary" href="#/network/results/summary" data-route="#/network/results/summary">Ver resultado</a></div>${
        blockers.length
          ? `<div class="ni-trust-blockers"><strong>Ressalvas que acompanham esta decisão</strong><ul>${[
              ...new Set(blockers),
            ]
              .slice(0, 4)
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join('')}</ul></div>`
          : ''
      }</section>`
    : `<section class="ni-trust-decision ni-trust-decision--empty" data-testid="trust-decision-summary"><div><span class="ni-eyebrow">Decisão da análise</span><h2>Nenhum resultado confirmado</h2><p>Execute uma simulação ou otimização para reunir aqui a conclusão, as ressalvas e a base de dados usada.</p></div><a class="ni-button primary" href="#/network/scenarios/build" data-route="#/network/scenarios/build">Iniciar análise</a></section>`;
  const body = `${decisionSummary}<section class="ni-trust-metrics"><div class="ni-trust-metric"><span>Evidência</span><strong>${evidenceScore(state)}</strong><small>${mock ? 'Demonstração sem fonte protegida' : trustStatusLabel(evidence?.evidence_status || 'indisponível')}</small></div><div class="ni-trust-metric"><span>Robustez</span><strong>${mock || risk.robustness?.robustness_score == null ? '—' : `${formatNumber(risk.robustness.robustness_score, 0)}/100`}</strong><small>Variação entre cenários</small></div><div class="ni-trust-metric"><span>Validação</span><strong>${trustStatusLabel(decision.final_qa?.final_qa_status || 'indisponível')}</strong><small>Verificações finais</small></div><div class="ni-trust-metric"><span>Cobertura fiscal</span><strong>${mock ? 'Demonstração' : businessLabel(decision.result?.tax_results?.tax_coverage?.decision_use || 'indisponível')}</strong><small>Períodos e regras elegíveis</small></div></section><div class="ni-trust-grid"><section class="ni-workspace-panel"><span class="ni-eyebrow">Dados considerados</span><h2>O que entrou no cálculo</h2><ul class="ni-trust-list"><li>${mock ? 'Amostra sintética demonstrativa' : 'Fonte protegida carregada pela empresa'}</li><li>${escapeHtml(scenario?.scenario_name || 'Cenário ainda não selecionado')}</li><li>${formatNumber(decision.audit?.data_sources?.length || 0)} origem(ns) registrada(s) no pacote</li></ul><a class="ni-text-link" href="#/network/trust/sources" data-route="#/network/trust/sources">Ver fontes e cobertura →</a></section><section class="ni-workspace-panel"><span class="ni-eyebrow">Como a análise foi resolvida</span><h2>Leitura para decisão</h2><ul class="ni-trust-list"><li>Custos e restrições foram comparados com a referência.</li><li>Risco e robustez entram como qualificação da economia.</li><li>Campos sem base elegível permanecem sem valor calculado.</li></ul><a class="ni-text-link" href="#/network/trust/methodology" data-route="#/network/trust/methodology">Abrir método e análise →</a></section></div><details class="ni-trust-limits"><summary>Limites que devem acompanhar a conclusão</summary><ul><li>A robustez depende dos cenários e premissas analisados.</li><li>A cobertura tributária deve ser lida junto dos períodos disponíveis.</li><li>Uma busca restrita às regras informadas não garante ótimo global.</li></ul></details>`;
  return page('Dados e metodologia', 'page-trust-overview', body, state);
}

export function renderTrustEvidence(state) {
  const evidence = selectEvidence(state);
  if (!evidence)
    return page(
      'Evidências',
      'page-trust-evidence',
      emptyState('Evidências indisponíveis para o resultado atual.'),
      state
    );
  const components = (evidence.components || []).map(
    (component) =>
      `<tr><th scope="row">${escapeHtml(component.name || component.label || 'Componente')}</th><td>${escapeHtml(businessLabel(component.status))}</td></tr>`
  );
  const body = `<div class="ni-workspace-kpis">${kpi('Pontuação', evidenceScore(state))}${kpi('Estado', state.context?.provider_kind === 'mock' ? 'Demonstração' : businessLabel(evidence.evidence_status))}${kpi('Componentes', formatNumber(evidence.components?.length || 0))}${kpi('Ressalvas', formatNumber(evidence.blockers?.length || 0))}</div>${table(['Componente', 'Estado'], components, 'Detalhes de evidência indisponíveis.')}${evidence.blockers?.length ? `<section class="ni-workspace-panel"><h2>Ressalvas</h2><ul>${evidence.blockers.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>` : ''}`;
  return page('Evidências', 'page-trust-evidence', body, state);
}

export function renderTrustSources(state) {
  const sources = selectDecision(state).audit?.data_sources || [];
  const rows = sources.map((source) => {
    const sourceText = String(source || '');
    const label =
      sourceText.toLowerCase().includes('demo') || sourceText.toLowerCase().includes('synthetic')
        ? 'Amostra demonstrativa'
        : 'Fonte carregada pela empresa';
    return `<tr><td>${label}</td><td>${state.context?.provider_kind === 'mock' ? 'Dados sintéticos' : 'Fonte protegida'}</td></tr>`;
  });
  return page(
    'Fontes e cobertura',
    'page-trust-sources',
    table(['Origem', 'Tratamento'], rows, 'Fontes não informadas para este resultado.'),
    state
  );
}

export function renderTrustValidation(state) {
  const decision = selectDecision(state);
  const qa = decision.final_qa;
  const release = decision.release;
  const exportFiles = decision.export_package?.files || [];
  const checks = (qa?.checks || []).map(
    (check) =>
      `<tr><th scope="row">${escapeHtml(check.label || businessLabel(check.check))}</th><td>${escapeHtml(businessLabel(check.status))}</td><td>${escapeHtml(check.message || '—')}</td></tr>`
  );
  const files = exportFiles
    .map(
      (file, index) =>
        `<div class="ni-export-row"><div><strong>${escapeHtml(file.filename || `arquivo-${index + 1}`)}</strong><small>${escapeHtml(file.description || 'Arquivo de resultado')}</small></div><button type="button" class="ni-button secondary" data-action="download-export" data-export-index="${index}">Baixar</button></div>`
    )
    .join('');
  const body = `<section class="ni-workspace-panel"><h2>Verificações</h2>${qa ? `<p>${statusChip(qa.final_qa_status, businessLabel(qa.final_qa_status))}</p>${table(['Verificação', 'Estado', 'Observação'], checks, 'Nenhuma verificação disponível.')}` : emptyState('Verificações finais indisponíveis.')}</section><section class="ni-workspace-panel"><h2>Pacote de entrega</h2>${release ? `<p>${statusChip(release.release_status, businessLabel(release.release_status))}</p><p>${escapeHtml((release.warnings || []).join(' ') || 'Sem ressalvas registradas.')}</p>` : emptyState('Estado de entrega indisponível.')}${files ? `<div class="ni-export-list">${files}</div>` : ''}</section><details class="ni-workspace-secondary-analytics"><summary>Trilha de auditoria</summary>${decision.audit ? `<pre class="ni-json">${safeJson(auditForPresentation(decision.audit))}</pre>` : emptyState('Trilha de auditoria indisponível.')}</details>`;
  return page('Validação e entrega', 'page-trust-validation', body, state);
}

export function renderTrustMethodology(state) {
  const mock = state.context?.provider_kind === 'mock';
  const note = mock
    ? '<p class="ni-note" role="note">A demonstração compara custos logísticos de uma amostra sintética. Sem receita fiscal elegível, tributos ficam fora da economia apresentada.</p>'
    : '';
  const body = `<section class="ni-workspace-panel"><span class="ni-eyebrow">Método</span><h2>Como interpretar os resultados</h2><ul><li>A simulação calcula efeitos das premissas selecionadas.</li><li>A análise de risco varia as premissas definidas e não presume comportamento histórico.</li><li>Evidência, robustez e cobertura fiscal medem aspectos diferentes.</li><li>Campos ausentes permanecem sem valor calculado.</li></ul>${note}</section>${state.data?.scenario_result ? `<section class="ni-trust-analysis"><div class="ni-workspace-section-heading"><div><span class="ni-eyebrow">Resolução da análise</span><h2>Risco, sensibilidade e estresse</h2></div><p>Use estes sinais para qualificar a economia antes de decidir.</p></div>${renderRiskAnalysis(state, true)}</section>` : emptyState('A análise de risco aparece aqui depois de um resultado ser calculado.')}<details class="ni-workspace-secondary-analytics"><summary>Dados da execução</summary><pre class="ni-json">${safeJson({ company_id: state.context?.company_id, status: state.meta?.status, result_kind: state.meta?.result_kind, capabilities: state.meta?.capabilities })}</pre></details>`;
  return page('Metodologia', 'page-trust-methodology', body, state);
}
