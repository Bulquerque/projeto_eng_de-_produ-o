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
    <button class="network-skip-link" type="button" data-action="skip-to-content">Pular para o conteúdo</button>
    <aside class="network-sidebar" aria-label="Navegação principal">
      <div class="network-brand"><span class="network-brand-mark" aria-hidden="true">V</span><div><strong>visagio</strong><small>Network Intelligence</small></div></div>
      <nav class="network-nav" aria-label="Seções principais">
        <a href="#/network/overview/summary" data-route="#/network/overview/summary" data-section="overview"><span class="network-nav-number" aria-hidden="true">01</span><span>Visão geral</span></a>
        <a href="#/network/scenarios/build" data-route="#/network/scenarios/build" data-section="scenarios"><span class="network-nav-number" aria-hidden="true">02</span><span>Simulação</span></a>
        <a href="#/network/optimizer/configure" data-route="#/network/optimizer/configure" data-section="optimizer"><span class="network-nav-number" aria-hidden="true">03</span><span>Otimização</span></a>
        <a href="#/network/results/summary" data-route="#/network/results/summary" data-section="results"><span class="network-nav-number" aria-hidden="true">04</span><span>Resultados</span></a>
      </nav>
      <div class="network-sidebar-tools">
        <a href="#/network/trust/overview" data-route="#/network/trust/overview" data-section="trust">Dados e metodologia</a>
        <button type="button" data-action="open-help"><img class="network-tool-icon" src="assets/icons/bootstrap-icons/question-circle.svg" alt="">Ajuda</button>
        ${debugEnabled ? '<a href="#/network/dev/console" data-route="#/network/dev/console" data-section="dev">Desenvolvimento</a>' : ''}
      </div>
    </aside>
    <div class="network-content">
      <header class="network-topbar" data-testid="network-topbar">
        <div class="network-context">
          <label><span>Empresa</span><select id="niCompanySelect" data-testid="company-selector" aria-label="Selecionar empresa">${companies}</select></label>
          <label><span>Cenário ativo</span><select id="niScenarioSelect" data-testid="scenario-selector" aria-label="Selecionar cenário"><option value="">Referência</option></select></label>
        </div>
        <div class="network-topbar-actions">
          <span id="niDemoBadge" class="ni-status status-neutral" hidden>Demonstração</span>
          <span id="niDraftBadge" class="ni-note" hidden>Alterações não simuladas</span>
          <button id="niLockButton" type="button" class="ni-button secondary" data-action="lock-crypto" hidden>Bloquear dados</button>
        </div>
      </header>
      <main id="networkPage" class="network-page" data-route-current="${escapeHtml(route || '')}" tabindex="-1"></main>
      <div id="networkRouteAnnouncement" class="ni-workspace-sr-only" role="status" aria-live="polite"></div>
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
  const currentSection = currentPath?.match(/^\/network\/([^/]+)/)?.[1];
  root.querySelectorAll('[data-section][data-route]').forEach((link) => {
    const active = link.dataset.section === currentSection;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

export function updateGlobalContext(root, state) {
  const companySelect = root.querySelector('#niCompanySelect');
  const scenarioSelect = root.querySelector('#niScenarioSelect');
  if (companySelect) companySelect.value = state.context.company_id || '';
  const demo = state.context.provider_kind === 'mock';
  root.querySelector('#niDemoBadge').hidden = !demo;
  root.querySelector('#niLockButton').hidden = demo || !state.data.baseline;
  root.querySelector('#niDraftBadge').hidden = !state.ui.scenario_dirty;
  if (scenarioSelect) {
    scenarioSelect.disabled = Boolean(state.ui.loading || !state.data.baseline);
    const baselineId = state.data.baseline?.model?.scenario_id;
    const scenarios = new Map();
    for (const entry of [
      ...(state.data.scenarios || []),
      ...(state.data.saved_scenarios || []),
      ...(state.data.optimizer?.scored_scenarios || []),
      ...(state.data.optimizer?.best_scenarios || []),
      state.ui.scenario_draft,
      state.data.selected_scenario,
    ]) {
      const scenario = entry?.scenario || entry;
      if (
        scenario?.scenario_id &&
        scenario.scenario_id !== baselineId &&
        scenario.scenario_type !== 'baseline'
      ) {
        scenarios.set(scenario.scenario_id, scenario);
      }
    }
    const options = `<option value="">Referência</option>${[...scenarios.values()]
      .map(
        (scenario) =>
          `<option value="${escapeHtml(scenario.scenario_id)}">${escapeHtml(scenario.scenario_name || 'Cenário salvo')}</option>`
      )
      .join('')}`;
    if (scenarioSelect.dataset.options !== options) {
      scenarioSelect.innerHTML = options;
      scenarioSelect.dataset.options = options;
    }
    scenarioSelect.value =
      state.context.selected_scenario_id === baselineId
        ? ''
        : state.context.selected_scenario_id || '';
  }
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
  root.querySelector('#networkToastRoot')?.replaceChildren(toast);
  window.setTimeout(() => toast.remove(), 4200);
}
