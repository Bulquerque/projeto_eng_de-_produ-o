import { escapeHtml, formatBRL, formatNumber, formatPct, statusClass } from '../core/common.js';

export { escapeHtml, formatBRL, formatNumber, formatPct, statusClass };

export function safeJson(value) {
  return escapeHtml(JSON.stringify(value ?? {}, null, 2));
}

export function statusChip(status, label = businessLabel(status) || '—') {
  return `<span class="ni-status ${statusClass(status)}">${escapeHtml(label)}</span>`;
}

export function emptyState(message = 'Dados ainda não disponíveis.') {
  return `<div class="ni-empty"><strong>Sem dados para exibir</strong><p>${escapeHtml(message)}</p></div>`;
}

export function routeFallback(route = '') {
  return `<div class="ni-page-heading" data-testid="page-route-fallback"><p class="ni-eyebrow">Network Intelligence</p><h1>Rota não encontrada</h1><p>A rota <code>${escapeHtml(route || '—')}</code> não está disponível nesta versão do workspace.</p><div class="ni-actions"><a class="ni-button primary" href="#/network/overview/summary" data-route="#/network/overview/summary">Voltar à visão executiva</a></div></div>`;
}

export function card(title, body, { eyebrow = '', testId = '' } = {}) {
  const attr = testId ? ` data-testid="${escapeHtml(testId)}"` : '';
  return `<article class="ni-card"${attr}>${eyebrow ? `<p class="ni-eyebrow">${escapeHtml(eyebrow)}</p>` : ''}<h2>${escapeHtml(title)}</h2>${body}</article>`;
}

export function kpi(label, value, note = '', testId = '') {
  const attr = testId ? ` data-testid="${escapeHtml(testId)}"` : '';
  return `<article class="ni-kpi"${attr}><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${note ? `<small>${escapeHtml(note)}</small>` : ''}</article>`;
}

export function table(headers, rows, empty = 'Nenhuma linha disponível.') {
  if (!rows.length) return emptyState(empty);
  return `<div class="ni-table-wrap"><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

export function metricValue(value, formatter = String) {
  return value === null || value === undefined || value === '' ? '—' : formatter(value);
}

export function sectionTabs(section, currentPath) {
  const tabs =
    {
      overview: [
        ['Resumo', '#/network/overview/summary'],
        ['Malha', '#/network/overview/network'],
        ['Custos', '#/network/overview/costs'],
        ['Tributário', '#/network/overview/tax'],
      ],
      scenarios: [['Construir', '#/network/scenarios/build']],
      results: [
        ['Resumo', '#/network/results/summary'],
        ['Comparação', '#/network/results/comparison'],
        ['Risco e sensibilidade', '#/network/results/risk'],
      ],
      optimizer: [
        ['Configurar', '#/network/optimizer/configure'],
        ['Ranking', '#/network/optimizer/results'],
        ['Custo × pontuação', '#/network/optimizer/tradeoffs'],
      ],
      trust: [
        ['Visão geral', '#/network/trust/overview'],
        ['Evidências', '#/network/trust/evidence'],
        ['Fontes', '#/network/trust/sources'],
        ['Validação', '#/network/trust/validation'],
        ['Metodologia', '#/network/trust/methodology'],
      ],
    }[section] || [];
  const normalizedPath = String(currentPath || '').split('?')[0];
  const activeRoute = (route) =>
    route === normalizedPath ||
    (route === '#/network/scenarios/risk' && normalizedPath.startsWith(`${route}/`)) ||
    (route === '#/network/results/risk' && normalizedPath.startsWith(`${route}/`));
  return `<nav class="ni-section-tabs" aria-label="Navegação da seção">${tabs
    .map(
      ([label, route]) =>
        `<a href="${route}" data-route="${route}" class="${activeRoute(route) ? 'active' : ''}"${activeRoute(route) ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a>`
    )
    .join('')}</nav>`;
}

export function businessLabel(value) {
  const labels = {
    low: 'Baixo',
    medium: 'Moderado',
    high: 'Alto',
    unknown: 'Não informado',
    passed: 'Verificado',
    failed: 'Falhou',
    warning: 'Com ressalvas',
    ready: 'Concluído',
    completed: 'Concluído',
    success: 'Concluído',
    simulated: 'Calculado',
    valid: 'Válido',
    blocked: 'Bloqueado',
    partial: 'Parcial',
    current: 'Atual',
    reform: 'Reforma',
    baseline: 'Referência',
    demo_fixture: 'Amostra pré-calculada',
    synthetic_fixture: 'Dados de demonstração',
    demo_only: 'Demonstração',
    decision_support: 'Apoio à decisão',
    exploratory_only: 'Exploratório',
    recommended: 'Recomendado',
    recommended_with_warnings: 'Recomendado com ressalvas',
    not_recommended: 'Não recomendado',
    not_available: 'Não disponível',
    analytical_full: 'Cobertura analítica completa',
    analytical_partial: 'Cobertura analítica parcial',
    observed: 'Observado',
    estimated: 'Estimado',
  };
  return labels[value] || String(value || '—').replaceAll('_', ' ');
}
