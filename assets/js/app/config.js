export const APP_CONFIG = Object.freeze({
  default_runtime_mode: 'project',
  default_company_id: 'empresa_mock',
  default_route: '#/network/overview/summary',
  project_module_base: '../',
  app_build: 'network-intelligence-public-demo',
  debug_default: false,
  mock_query_key: 'mock',
});

const MOCK_DEFINITION = Object.freeze({
  id: 'empresa_mock', label: 'Empresa demonstrativa', kind: 'mock', provider: 'mock',
  data_access: 'embedded', encrypted: false, requires_project: false, requires_crypto: false,
  release_policy: 'demo_only', calculation_profile: 'synthetic_fixture',
  default_route: APP_CONFIG.default_route,
});

export function readRuntimeRequest() {
  return { company_id: 'empresa_mock', runtime_mode: 'project', mock_disabled: false, debug_requested: false };
}
export function resolveRuntimeMode() { return 'project'; }
export function resolveInitialCompany() { return 'empresa_mock'; }
export function buildAppConfig() {
  return Object.freeze({ ...APP_CONFIG, runtime_mode: 'project', company_id: 'empresa_mock',
    company_definition: MOCK_DEFINITION, debug_enabled: false, mock_disabled: false });
}
