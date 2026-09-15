import {
  assertCompanyPolicy,
  assertKnownCompany,
  getCompanyDefinition,
} from './company-registry.js';

export const APP_CONFIG = Object.freeze({
  default_runtime_mode: 'auto',
  default_company_id: 'empresa1',
  default_route: '#/network/overview/summary',
  project_module_base: '../',
  app_build: 'network-intelligence-6.2-modular',
  debug_default: true,
  mock_query_key: 'mock',
  network_ui_query_key: 'ui',
});

export function readRuntimeRequest(location = window.location) {
  const params = new URLSearchParams(location.search);
  const requestedCompany = params.get('company');
  const requestedMode = params.get('runtime') || params.get('mode');
  const requestedUi = params.get(APP_CONFIG.network_ui_query_key);
  const mockDisabled = params.get(APP_CONFIG.mock_query_key) === 'off';
  const debugRequested = params.get('dev') === '1';
  return {
    company_id: requestedCompany || APP_CONFIG.default_company_id,
    runtime_mode: requestedMode || APP_CONFIG.default_runtime_mode,
    network_ui: requestedUi === 'network-intelligence',
    mock_disabled: mockDisabled,
    debug_requested: debugRequested,
  };
}

export function resolveRuntimeMode(request, location = window.location) {
  if (request.runtime_mode === 'project' || request.runtime_mode === 'standalone') {
    return request.runtime_mode;
  }
  if (location.protocol === 'file:') return 'standalone';
  return 'project';
}

export function resolveInitialCompany(request, runtimeMode) {
  const requested = getCompanyDefinition(request.company_id)
    ? request.company_id
    : APP_CONFIG.default_company_id;
  const companyId = request.mock_disabled && requested === 'empresa_mock' ? 'empresa1' : requested;
  assertCompanyPolicy(companyId, { runtimeMode });
  return companyId;
}

export function buildAppConfig({
  request = readRuntimeRequest(),
  location = window.location,
} = {}) {
  const runtimeMode = resolveRuntimeMode(request, location);
  const companyId = resolveInitialCompany(request, runtimeMode);
  const definition = assertKnownCompany(companyId);
  return Object.freeze({
    ...APP_CONFIG,
    runtime_mode: runtimeMode,
    company_id: companyId,
    company_definition: definition,
    network_ui: request.network_ui,
    debug_enabled: runtimeMode === 'project',
    mock_disabled: request.mock_disabled,
  });
}
