function clone(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

export function createInitialState(config = {}) {
  return {
    context: {
      company_id: config.company_id || null,
      provider_kind: config.company_definition?.provider || null,
      runtime_mode: config.runtime_mode || null,
      selected_scenario_id: null,
      generation: 0,
    },
    data: {
      baseline: null,
      scenarios: [],
      saved_scenarios: [],
      selected_scenario: null,
      scenario_result: null,
      scenario_quality: null,
      comparison: null,
      monte_carlo: null,
      stress: null,
      sensitivity: null,
      sensitivity_matrix: null,
      robustness: null,
      optimizer: null,
      recommendation: null,
      audit: null,
      final_qa: null,
      release: null,
      export_package: null,
    },
    ui: {
      route: config.default_route || '#/network/overview/summary',
      loading: false,
      loading_message: '',
      error: null,
      drawer: null,
      mobile_menu: false,
      selected_metric: null,
      selected_tradeoff: null,
      scenario_draft: null,
    },
    dev: {
      enabled: Boolean(config.debug_enabled),
      events: [],
      checks: [],
      metrics: [],
      modules: [],
      compatibility: null,
    },
    meta: {
      status: 'idle',
      last_updated: null,
      provider_snapshot: null,
    },
  };
}

export function resetCompanyScopedState(state, companyId) {
  state.context.company_id = companyId;
  state.context.selected_scenario_id = null;
  state.context.generation += 1;
  state.data = {
    baseline: null,
    scenarios: [],
    saved_scenarios: [],
    selected_scenario: null,
    scenario_result: null,
    scenario_quality: null,
    comparison: null,
    monte_carlo: null,
    stress: null,
    sensitivity: null,
    sensitivity_matrix: null,
    robustness: null,
    optimizer: null,
    recommendation: null,
    audit: null,
    final_qa: null,
    release: null,
    export_package: null,
  };
  state.meta.provider_snapshot = null;
  state.meta.status = 'switching_company';
  state.ui.error = null;
  state.ui.scenario_draft = null;
  return state.context.generation;
}

export function beginLoading(state, message = 'Carregando dados…') {
  state.ui.loading = true;
  state.ui.loading_message = message;
  state.ui.error = null;
  state.meta.status = 'loading';
  return state.context.generation;
}

export function commitProviderSnapshot(state, snapshot) {
  if (!snapshot?.company_id || snapshot.company_id !== state.context.company_id) {
    throw new Error('Snapshot rejeitado: empresa divergente do contexto ativo.');
  }
  state.data = {
    ...state.data,
    ...(snapshot.data || {}),
  };
  state.context.provider_kind = snapshot.provider_kind || state.context.provider_kind;
  state.meta.provider_snapshot = clone(snapshot.meta || null);
  state.meta.status = snapshot.status || 'ready';
  state.meta.last_updated = new Date().toISOString();
  state.ui.loading = false;
  state.ui.loading_message = '';
  state.ui.error = null;
  return state;
}

export function failLoading(state, error) {
  state.ui.loading = false;
  state.ui.loading_message = '';
  state.ui.error = {
    code: error?.code || 'APP_LOAD_ERROR',
    message: error?.message || String(error || 'Falha desconhecida.'),
  };
  state.meta.status = 'error';
  return state;
}

export function setRoute(state, route) {
  state.ui.route = route;
  return state;
}

export function setSelectedScenario(state, scenarioId) {
  state.context.selected_scenario_id = scenarioId || null;
  return state;
}

export function createStateStore(initialState) {
  let state = initialState;
  const listeners = new Set();
  return {
    getState() {
      return state;
    },
    replace(nextState) {
      state = nextState;
      listeners.forEach((listener) => listener(state));
      return state;
    },
    update(mutator) {
      const nextState = mutator(state) || state;
      state = nextState;
      listeners.forEach((listener) => listener(state));
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function getSafeStateSnapshot(state) {
  const snapshot = clone(state) || {};
  return {
    context: snapshot.context || {},
    ui: {
      route: snapshot.ui?.route || null,
      loading: Boolean(snapshot.ui?.loading),
      error: snapshot.ui?.error || null,
    },
    dev: {
      enabled: Boolean(snapshot.dev?.enabled),
    },
    meta: {
      status: snapshot.meta?.status || null,
      last_updated: snapshot.meta?.last_updated || null,
      provider_snapshot: snapshot.meta?.provider_snapshot
        ? {
            company_id: snapshot.meta.provider_snapshot.company_id || null,
            provider_kind: snapshot.meta.provider_snapshot.provider_kind || null,
            status: snapshot.meta.provider_snapshot.status || null,
            encrypted: Boolean(snapshot.meta.provider_snapshot.encrypted),
            release_policy: snapshot.meta.provider_snapshot.release_policy || null,
            synthetic: Boolean(snapshot.meta.provider_snapshot.synthetic),
            scenario_count: snapshot.meta.provider_snapshot.scenario_count || 0,
            warnings: Array.isArray(snapshot.meta.provider_snapshot.warnings)
              ? snapshot.meta.provider_snapshot.warnings
              : [],
          }
        : null,
    },
  };
}
