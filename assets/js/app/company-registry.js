const COMPANY_REGISTRY = Object.freeze({
  empresa_mock: Object.freeze({
    id: 'empresa_mock',
    label: 'Empresa Falsa',
    kind: 'mock',
    provider: 'mock',
    data_access: 'embedded',
    encrypted: false,
    requires_project: false,
    requires_crypto: false,
    release_policy: 'demo_only',
    calculation_profile: 'synthetic_fixture',
    default_route: '#/network/overview/summary',
  }),
  empresa1: Object.freeze({
    id: 'empresa1',
    label: 'Empresa 1',
    kind: 'real',
    provider: 'project',
    data_access: 'protected',
    encrypted: true,
    requires_project: true,
    requires_crypto: true,
    release_policy: 'protected_project',
    calculation_profile: 'project_provider',
    default_route: '#/network/overview/summary',
  }),
  empresa2: Object.freeze({
    id: 'empresa2',
    label: 'Empresa 2',
    kind: 'real',
    provider: 'project',
    data_access: 'protected',
    encrypted: true,
    requires_project: true,
    requires_crypto: true,
    release_policy: 'protected_project',
    calculation_profile: 'cif_observed',
    default_route: '#/network/overview/summary',
  }),
});

export { COMPANY_REGISTRY };

export function getCompanyDefinition(companyId) {
  return COMPANY_REGISTRY[companyId] || null;
}

export function assertKnownCompany(companyId) {
  const definition = getCompanyDefinition(companyId);
  if (!definition) throw new Error(`Empresa não registrada: ${companyId || 'ausente'}.`);
  return definition;
}

export function resolveProviderKind(companyId) {
  return assertKnownCompany(companyId).provider;
}

export function isMockTenant(companyId) {
  return assertKnownCompany(companyId).kind === 'mock';
}

export function isRealTenant(companyId) {
  return assertKnownCompany(companyId).kind === 'real';
}

export function assertCompanyPolicy(companyId, { providerKind, runtimeMode } = {}) {
  const definition = assertKnownCompany(companyId);
  if (providerKind && providerKind !== definition.provider) {
    throw new Error(
      `Provider incompatível para ${companyId}: esperado ${definition.provider}, recebido ${providerKind}.`
    );
  }
  if (definition.requires_project && runtimeMode === 'standalone') {
    throw new Error(`${companyId} exige runtime de projeto; modo standalone bloqueado.`);
  }
  if (definition.kind === 'mock' && definition.release_policy !== 'demo_only') {
    throw new Error('Empresa Falsa precisa permanecer com release_policy=demo_only.');
  }
  return definition;
}
