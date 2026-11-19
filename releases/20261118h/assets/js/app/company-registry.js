const COMPANY_REGISTRY = Object.freeze({
  empresa_mock: Object.freeze({
    id: 'empresa_mock', label: 'Empresa demonstrativa', kind: 'mock', provider: 'mock',
    data_access: 'embedded', encrypted: false, requires_project: false, requires_crypto: false,
    release_policy: 'demo_only', calculation_profile: 'synthetic_fixture',
    default_route: '#/network/overview/summary',
  }),
});
export { COMPANY_REGISTRY };
export function getCompanyDefinition(companyId) { return COMPANY_REGISTRY[companyId] || null; }
export function assertKnownCompany(companyId) {
  const definition = getCompanyDefinition(companyId);
  if (!definition) throw new Error('Somente a empresa demonstrativa está disponível nesta publicação.');
  return definition;
}
export function resolveProviderKind(companyId) { return assertKnownCompany(companyId).provider; }
export function isMockTenant(companyId) { return assertKnownCompany(companyId).kind === 'mock'; }
export function isRealTenant() { return false; }
export function assertCompanyPolicy(companyId, { providerKind } = {}) {
  const definition = assertKnownCompany(companyId);
  if (providerKind && providerKind !== 'mock') throw new Error('Provider real desabilitado nesta demonstração.');
  return definition;
}
