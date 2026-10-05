import { selectBaseline, selectDecision, selectEvidence } from '../selectors/business-selectors.js';
import {
  evidenceClassLabel,
  robustnessPresentation,
  userStatusLabel,
} from '../charts/trust-analytics.js';
import {
  card,
  emptyState,
  escapeHtml,
  formatNumber,
  formatPct,
  kpi,
  safeJson,
  sectionTabs,
  statusChip,
  table,
} from '../view-helpers.js';

function auditForPresentation(audit) {
  if (!audit) return null;
  const sanitize = (value, key = '') => {
    if (/^(?:data_sources|source_ref|source_path|file_path|path|uri|url)$/i.test(key))
      return Array.isArray(value)
        ? value.map(() => 'Fonte protegida (detalhes no pacote de exportação)')
        : 'Fonte protegida (detalhes no pacote de exportação)';
    if (Array.isArray(value)) {
      return value.map((item) => sanitize(item));
    }
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([name, item]) => [name, sanitize(item, name)])
      );
    if (typeof value === 'string') {
      if (
        /^(?:[a-z]:[\\/]|\/)|(?:^|[\\/])(?:data|raw_exports|source_exports|\.env)(?:[\\/]|$)/i.test(
          value
        )
      )
        return 'Referência protegida';
      if (/^(?:data_sources|source_ref|source_path|file_path|path|uri)$/i.test(key))
        return 'Referência protegida';
    }
    return value;
  };
  return sanitize(audit);
}

function safeSourceLabel(source) {
  const text =
    typeof source === 'string'
      ? source
      : [source?.source_type, source?.category, source?.dataset, source?.table_name, source?.role]
          .filter((part) => typeof part === 'string')
          .join(' ');
  const key = text.toLowerCase().replace(/[_-]+/g, ' ');
  if (/data demo|synthetic|fixture|demonstr/.test(key)) return 'Dados sintéticos de demonstração';
  if (/tax|tribut|fiscal/.test(key)) return 'Dados fiscais';
  if (/baseline|phase 2|phase2/.test(key)) return 'Baseline da rede';
  if (/scenario|cen.rio|phase 3|phase3/.test(key)) return 'Cenários';
  if (/stress|robust|sensitivity|monte carlo|phase 4|phase4/.test(key)) return 'Análise de risco';
  if (/evidence|quality|qualidade|phase 5|phase5/.test(key)) return 'Qualidade e evidências';
  if (/demand|demanda/.test(key)) return 'Dados de demanda';
  if (/distance|dist.ncia|route|rota|network|malha|flow|fluxo/.test(key))
    return 'Fluxos, distâncias e rotas';
  if (/cost|custo/.test(key)) return 'Custos logísticos';
  return 'Dados estruturados da empresa';
}

function safeSourceTreatment(source, state, audit) {
  const provenance = `${audit?.provenance || ''} ${source?.provenance || ''}`.toLowerCase();
  if (state.context.provider_kind === 'mock' || /synthetic|fixture|demo/.test(provenance))
    return 'Demonstração sintética';
  return 'Dados da empresa';
}

function cleanWarning(value) {
  return String(value || '')
    .replace(/release_policy\s*=\s*demo_only/gi, 'Política restrita à demonstração')
    .replace(/decision_use\s*=\s*demo_only/gi, 'Uso permitido apenas para demonstração')
    .replace(/demo_only/gi, 'apenas demonstração');
}

function showTechnicalJson(value) {
  return `<details class="ni-chart-method"><summary>Registro técnico</summary><pre class="ni-json">${safeJson(value)}</pre></details>`;
}

function formatCoverage(value) {
  if (value == null || value === '') return '—';
  const ratio = Number(value);
  return Number.isFinite(ratio) && ratio >= 0 && ratio <= 1 ? formatPct(ratio * 100) : '—';
}

export function renderTrustOverview(state) {
  const decision = selectDecision(state);
  const evidence = selectEvidence(state);
  const robustness = robustnessPresentation(decision.risk.robustness);
  const tax = selectBaseline(state)?.tax_results?.tax_results || {};
  const coverageRatio = Number(tax.tax_coverage?.complete_fiscal_coverage_ratio);
  const coverageIsReported =
    tax.tax_coverage?.complete_fiscal_coverage_ratio != null &&
    Number.isFinite(coverageRatio) &&
    coverageRatio >= 0 &&
    coverageRatio <= 1;
  const use = decision.recommendation?.decision_use || tax.decision_use;
  const limitations = [];
  if (robustness.label === 'Robustez condicional') limitations.push(robustness.note);
  if (coverageIsReported && coverageRatio < 1)
    limitations.push(`Cobertura fiscal declarada: ${formatPct(coverageRatio * 100)}.`);
  else if (!coverageIsReported)
    limitations.push('A proporção de cobertura fiscal não foi informada pela fonte.');
  if (decision.optimizer?.result_scope === 'conditional_declared_catalog')
    limitations.push('A busca do otimizador está limitada ao catálogo declarado.');
  if (use === 'demo_only') limitations.push('Resultados disponíveis apenas para demonstração.');
  const qaStatus = userStatusLabel(decision.final_qa?.final_qa_status, 'Não calculada');
  const releaseStatus = userStatusLabel(decision.release?.release_status, 'Não avaliada');
  const limitationsBody = limitations.length
    ? `<ul class="ni-list">${limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p class="ni-note">Nenhuma ressalva foi registrada nos campos desta avaliação.</p>';
  return `<div class="ni-page-heading" data-testid="page-trust-overview"><p class="ni-eyebrow">Confiança</p><h1>Dados e confiança</h1><p>Evidência, risco e qualidade da decisão selecionada.</p></div>${sectionTabs('trust', state.ui.route)}<div class="ni-kpi-grid">${kpi('Evidência', evidence?.evidence_score == null ? '—' : `${evidence.evidence_score}/100`)}${kpi(robustness.label, robustness.value == null ? '—' : `${formatNumber(robustness.value, 1)}/100`, robustness.note)}${kpi('Verificação de qualidade', qaStatus)}${kpi('Prontidão de entrega', releaseStatus)}</div><div class="ni-grid two">${card('Estado da recomendação', decision.recommendation ? `<p>${statusChip(decision.recommendation.recommendation_status, userStatusLabel(decision.recommendation.recommendation_status))}</p><p>${escapeHtml(decision.recommendation.executive_summary || '—')}</p>` : emptyState('Nenhuma recomendação calculada.'))}${card('Limites desta leitura', limitationsBody)}</div><div class="ni-card ni-chart-section"><h2>Verificações executadas</h2><canvas id="niQaStatusChart" class="ni-chart" aria-label="Verificações de qualidade por status"></canvas><p class="ni-chart-summary">Verificações · status</p><details class="ni-chart-method"><summary>Dados e premissas</summary><p class="ni-note">A contagem resume verificações registradas; não certifica os dados da empresa nem a decisão.</p></details></div>`;
}

export function renderTrustEvidence(state) {
  const evidence = selectEvidence(state);
  if (!evidence)
    return `<div class="ni-page-heading" data-testid="page-trust-evidence"><h1>Evidências</h1></div>${sectionTabs('trust', state.ui.route)}${emptyState('Nenhum relatório de evidência disponível.')}`;
  const componentCount = Array.isArray(evidence.components)
    ? evidence.components.length
    : undefined;
  const blockerCount = Array.isArray(evidence.blockers) ? evidence.blockers.length : undefined;
  return `<div class="ni-page-heading" data-testid="page-trust-evidence"><p class="ni-eyebrow">Confiança · Evidências</p><h1>Evidências</h1><p>Classificação e cobertura informadas por componente.</p></div>${sectionTabs('trust', state.ui.route)}<div class="ni-kpi-grid">${kpi('Score de evidência', evidence.evidence_score == null ? '—' : `${evidence.evidence_score}/100`)}${kpi('Status', userStatusLabel(evidence.evidence_status))}${kpi('Componentes', formatNumber(componentCount))}${kpi('Impedimentos', formatNumber(blockerCount))}</div><div class="ni-card"><h2>Componentes</h2>${table(
    ['Componente', 'Classe', 'Cobertura'],
    (evidence.components || []).map(
      (component) =>
        `<tr><td>${escapeHtml(component.label || component.name || component.id || '—')}</td><td>${escapeHtml(evidenceClassLabel(component.classification || component.status))}</td><td>${formatCoverage(component.coverage)}</td></tr>`
    ),
    'Nenhum componente informado.'
  )}</div><div class="ni-grid two"><div class="ni-card ni-chart-section"><h2>Classes de evidência</h2><canvas id="niEvidenceStatusChart" class="ni-chart" aria-label="Componentes agrupados pela classificação de evidência publicada"></canvas><p class="ni-chart-summary">Classes · quantidade</p><details class="ni-chart-method"><summary>Dados e premissas</summary><p class="ni-note">Classificação publicada; quando ausente, usa o status informado.</p></details></div><div class="ni-card ni-chart-section"><h2>Cobertura por componente</h2><canvas id="niEvidenceCoverageChart" class="ni-chart" aria-label="Cobertura publicada por componente em registros pertinentes" hidden></canvas><p class="ni-chart-summary" data-chart-summary="niEvidenceCoverageChart">Cobertura não informada</p><details class="ni-chart-method"><summary>Dados e premissas</summary><p class="ni-note" data-chart-caption="niEvidenceCoverageChart">A cobertura se refere aos registros pertinentes, não à confiança ou precisão estatística.</p></details></div></div>`;
}

export function renderTrustSources(state) {
  const decision = selectDecision(state);
  const sources = Array.isArray(decision.audit?.data_sources) ? decision.audit.data_sources : [];
  const grouped = new Map();
  sources.forEach((source) => {
    const label = safeSourceLabel(source);
    grouped.set(label, (grouped.get(label) || 0) + 1);
  });
  return `<div class="ni-page-heading" data-testid="page-trust-sources"><p class="ni-eyebrow">Confiança · Fontes</p><h1>Fontes</h1><p>Tipos de fonte usados nesta avaliação; caminhos e identificadores protegidos ficam ocultos.</p></div>${sectionTabs('trust', state.ui.route)}<div class="ni-card"><h2>Fontes utilizadas</h2>${table(
    ['Tipo de fonte', 'Registros', 'Base'],
    [...grouped.entries()].map(
      ([label, count]) =>
        `<tr><td>${escapeHtml(label)}</td><td>${formatNumber(count)}</td><td>${escapeHtml(
          safeSourceTreatment(
            sources.find((source) => safeSourceLabel(source) === label),
            state,
            decision.audit
          )
        )}</td></tr>`
    ),
    'Nenhuma fonte registrada.'
  )}</div>`;
}

export function renderTrustValidation(state) {
  const decision = selectDecision(state);
  const qa = decision.final_qa;
  const release = decision.release;
  const exportFiles = decision.export_package?.files || [];
  const qaBody = qa
    ? `<p>${statusChip(qa.final_qa_status, userStatusLabel(qa.final_qa_status))}</p>${table(
        ['Verificação', 'Status', 'Resultado'],
        (qa.checks || []).map(
          (check) =>
            `<tr><td>${escapeHtml(userStatusLabel(check.check))}</td><td>${escapeHtml(userStatusLabel(check.status || (check.pass === true ? 'passed' : check.pass === false ? 'failed' : null)))}</td><td>${escapeHtml(cleanWarning(check.message))}</td></tr>`
        ),
        'Nenhum check executado.'
      )}${qa.blocking_issues?.length ? `<h3>Impedimentos</h3><ul class="ni-list">${qa.blocking_issues.map((issue) => `<li>${escapeHtml(cleanWarning(typeof issue === 'string' ? issue : issue.message || issue.code || JSON.stringify(issue)))}</li>`).join('')}</ul>` : ''}${qa.warnings?.length ? `<h3>Ressalvas</h3><ul class="ni-list">${qa.warnings.map((warning) => `<li>${escapeHtml(cleanWarning(warning))}</li>`).join('')}</ul>` : ''}`
    : emptyState('Final QA ainda não executado.');
  const releaseBody = release
    ? `<p>${statusChip(release.release_status, userStatusLabel(release.release_status))}</p><p>${escapeHtml((release.warnings || []).map(cleanWarning).join(' ') || 'Sem avisos.')}</p>`
    : emptyState('Release ainda não validado.');
  const auditBody = decision.audit
    ? showTechnicalJson(auditForPresentation(decision.audit))
    : emptyState('Audit trail ainda não disponível.');
  const exportBody = exportFiles.length
    ? `<p>Arquivos da execução atual.</p><div class="ni-export-list">${exportFiles
        .map(
          (file, index) =>
            `<div class="ni-export-row"><div><strong>${escapeHtml(file.filename || `arquivo-${index + 1}`)}</strong><small>${escapeHtml(file.type || 'application/octet-stream')}</small></div><button type="button" class="ni-button secondary" data-action="download-export" data-export-index="${index}">Baixar</button></div>`
        )
        .join('')}</div>`
    : emptyState('Pacote de exportação ainda não disponível.');
  return `<div class="ni-page-heading" data-testid="page-trust-validation"><p class="ni-eyebrow">Confiança · Validação</p><h1>Validação e entrega</h1><p>Verificações da execução e prontidão do pacote.</p></div>${sectionTabs('trust', state.ui.route)}<div class="ni-grid two">${card('Verificação da execução', qaBody, { testId: 'qa-status' })}${card('Prontidão para entrega', releaseBody, { testId: 'release-status' })}</div><div class="ni-card"><h2>Registro da avaliação</h2>${auditBody}</div>${card('Central de exportação', exportBody, { testId: 'export-center-panel' })}`;
}

export function renderTrustMethodology(state) {
  const decision = selectDecision(state);
  return `<div class="ni-page-heading" data-testid="page-trust-methodology"><p class="ni-eyebrow">Confiança · Metodologia</p><h1>Metodologia</h1><p>Como ler evidência, robustez, qualidade e prontidão.</p></div>${sectionTabs('trust', state.ui.route)}<div class="ni-card"><h2>Como interpretar</h2><ul class="ni-list"><li><strong>Evidência</strong> resume as classificações e coberturas registradas por componente.</li><li><strong>Robustez</strong> é condicional quando depende das premissas e cenários avaliados; só é certificada quando a fonte declara essa condição.</li><li><strong>Qualidade</strong> conta verificações executadas, sem certificar a origem dos dados.</li><li><strong>Prontidão</strong> depende dos resultados de QA, das regras de entrega e do pacote disponível.</li><li>Campos ausentes permanecem sem valor; não são estimados nesta leitura.</li></ul>${showTechnicalJson({ company_id: state.context.company_id, status: userStatusLabel(state.meta.status), recommendation: decision.recommendation, release: decision.release })}</div>`;
}
