import { COMPANY_REGISTRY } from './company-registry.js';
import { escapeHtml } from './view-helpers.js';

export function renderShell({ companyId, route, debugEnabled = false } = {}) {
  const companies = Object.values(COMPANY_REGISTRY)
    .map(
      (company) =>
        `<option value="${escapeHtml(company.id)}" ${company.id === companyId ? 'selected' : ''}>${escapeHtml(company.label)}</option>`
    )
    .join('');
  return `<div id="networkAppRoot" class="network-app" data-testid="network-shell" data-runtime="network-intelligence">
    <aside class="network-sidebar" aria-label="Navegação Network Intelligence">
      <div class="network-brand"><span class="network-brand-mark" aria-hidden="true">V</span><div><strong>visagio</strong><small>Network Intelligence</small></div></div>
      <nav class="network-nav" aria-label="Seções principais">
        <a href="#/network/overview/summary" data-route="#/network/overview/summary" data-section="overview"><span>01</span>Visão executiva</a>
        <a href="#/network/scenarios/build" data-route="#/network/scenarios/build" data-section="scenarios"><span>02</span>Cenários</a>
        <a href="#/network/optimizer/configure" data-route="#/network/optimizer/configure" data-section="optimizer"><span>03</span>Otimizador</a>
        <a href="#/network/trust/overview" data-route="#/network/trust/overview" data-section="trust"><span>04</span>Dados & confiança</a>
        <a href="#/network/dev/console" data-route="#/network/dev/console" data-section="dev">Debug</a>
      </nav>
      <div class="network-sidebar-tools"><button type="button" data-action="open-help">Ajuda</button><button type="button" data-action="open-settings">Configurações</button><button type="button" data-action="open-styleguide">◫ Style guide</button></div>
      <div class="network-sidebar-foot"><small>Decision workspace</small><span data-testid="mode-badge">runtime</span></div>
    </aside>
    <div class="network-content">
      <header class="network-topbar" data-testid="network-topbar">
        <div class="network-product"><strong>Network Intelligence</strong><small>Decision workspace</small></div>
        <div class="network-context">
          <label>Empresa<select id="niCompanySelect" data-testid="company-selector" aria-label="Selecionar empresa">${companies}</select></label>
          <label>Cenário<select id="niScenarioSelect" data-testid="scenario-selector" aria-label="Selecionar cenário"><option value="">Baseline</option></select></label>
          <button type="button" class="ni-button secondary ni-demo-return" data-action="switch-demo-company" data-testid="return-to-demo">Voltar à Empresa Falsa</button>
        </div>
        <div class="network-topbar-actions">
          <span id="niEvidenceTopbar" data-testid="evidence-topbar" class="ni-status status-neutral">Evidence —</span>
          <span id="niCompanyBadge" data-testid="company-badge" class="ni-context-badge">${escapeHtml(companyId || '—')}</span>
          <span class="ni-runtime-badge" data-testid="runtime-badge">RUNTIME</span>
          <button type="button" class="ni-button secondary" data-action="open-export" data-testid="export-center">Exportar</button>
          <button type="button" class="ni-button primary" data-action="open-dev" data-testid="dev-console">&lt;/&gt; Dev</button>
          <span class="ni-avatar" aria-hidden="true">UI</span>
        </div>
      </header>
      <main id="networkPage" class="network-page" data-route-current="${escapeHtml(route || '')}" tabindex="-1" aria-live="polite"></main>
    </div>
    <div id="networkDrawerBackdrop" class="network-drawer-backdrop" data-action="close-drawer" hidden></div>
    <aside id="networkDrawer" class="network-drawer" role="dialog" aria-modal="true" aria-labelledby="networkDrawerTitle" hidden>
      <button type="button" class="network-drawer-close" data-action="close-drawer" aria-label="Fechar detalhes">×</button>
      <h2 id="networkDrawerTitle" tabindex="-1">Detalhes</h2><div id="networkDrawerBody"></div>
    </aside>
    <div id="networkToastRoot" class="network-toast-root" aria-live="polite"></div>
    <div id="networkLoadingOverlay" class="network-loading" role="status" aria-live="polite" aria-busy="true" hidden><div><strong id="networkLoadingTitle">Carregando</strong><p id="networkLoadingNote">Aguarde.</p></div></div>
  </div>`;
}

export function setActiveNav(root, route) {
  const currentPath = route?.path || route?.hash?.split('?')[0];
  root.querySelectorAll('[data-route]').forEach((link) => {
    const linkPath = link.getAttribute('data-route')?.split('?')[0].replace(/^#/, '');
    const active = linkPath === currentPath;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

export function updateGlobalContext(root, state) {
  const companySelect = root.querySelector('#niCompanySelect');
  const scenarioSelect = root.querySelector('#niScenarioSelect');
  const companyBadge = root.querySelector('#niCompanyBadge');
  const runtimeBadge = root.querySelector('[data-testid="runtime-badge"]');
  const evidence = root.querySelector('#niEvidenceTopbar');
  if (companySelect) companySelect.value = state.context.company_id || '';
  const company = COMPANY_REGISTRY[state.context.company_id];
  if (companyBadge)
    companyBadge.textContent = company
      ? `${company.label} · ${company.kind === 'mock' ? 'MOCK' : 'PROTECTED'}`
      : state.context.company_id || '—';
  if (runtimeBadge)
    runtimeBadge.textContent = String(state.context.runtime_mode || 'project').toUpperCase();
  if (scenarioSelect) {
    scenarioSelect.disabled = Boolean(state.ui.loading);
    const selected = state.context.selected_scenario_id || '';
    scenarioSelect.innerHTML = `<option value="">Baseline</option>${(state.data.scenarios || [])
      .map(
        (scenario) =>
          `<option value="${escapeHtml(scenario.scenario_id)}">${escapeHtml(scenario.scenario_name || scenario.scenario_id)}</option>`
      )
      .join('')}`;
    scenarioSelect.value = selected;
  }
  const evidenceScore = state.data.scenario_result?.evidence?.evidence_score;
  if (evidence)
    evidence.textContent = `Evidence ${evidenceScore == null ? '—' : `${evidenceScore}/100`}`;
}

export function showLoading(root, visible, title = 'Carregando', note = 'Aguarde.') {
  const overlay = root.querySelector('#networkLoadingOverlay');
  if (!overlay) return;
  overlay.hidden = !visible;
  root.setAttribute('aria-busy', visible ? 'true' : 'false');
  overlay.setAttribute('aria-busy', visible ? 'true' : 'false');
  root.querySelector('#networkLoadingTitle').textContent = title;
  root.querySelector('#networkLoadingNote').textContent = note;
}

export function showToast(root, message, kind = 'neutral') {
  const toast = document.createElement('div');
  toast.className = `network-toast ${kind}`;
  toast.textContent = message;
  root.querySelector('#networkToastRoot')?.append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}
