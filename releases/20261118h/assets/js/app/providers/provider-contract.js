export const PROVIDER_METHODS = Object.freeze([
  'init',
  'dispose',
  'loadBaseline',
  'loadScenarioLibrary',
  'runScenario',
  'runRiskSuite',
  'runOptimization',
  'buildDecisionPackage',
  'getDomainContext',
  'getHealth',
  'getSnapshot',
]);

export function assertProviderContract(provider, providerKind) {
  const missing = PROVIDER_METHODS.filter((method) => typeof provider?.[method] !== 'function');
  if (missing.length) {
    throw new Error(
      `Provider ${providerKind || 'desconhecido'} incompleto: ${missing.join(', ')}.`
    );
  }
  return provider;
}

export function assertProviderResult(result, companyId, label = 'resultado') {
  if (!result || result.company_id !== companyId) {
    throw new Error(`Contrato inválido em ${label}: company_id divergente.`);
  }
  return result;
}

export function assertTenantProvenance(value, { companyId, providerKind } = {}) {
  if (!value) throw new Error('Proveniência ausente.');
  if (value.company_id && value.company_id !== companyId) {
    throw new Error('Proveniência de tenant divergente.');
  }
  if (providerKind && value.provider_kind && value.provider_kind !== providerKind) {
    throw new Error('Proveniência de provider divergente.');
  }
  return value;
}
