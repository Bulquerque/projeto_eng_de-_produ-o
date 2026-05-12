let activeCompanyId = null;

export function setActiveCompany(companyId) {
  if (!['empresa1', 'empresa2'].includes(companyId)) {
    const error = new Error(`Empresa inválida: ${companyId}`);
    error.code = 'CRYPTO_007';
    throw error;
  }
  if (activeCompanyId && activeCompanyId !== companyId) {
    window.dispatchEvent(new CustomEvent('visagio:company-change', { detail: { from: activeCompanyId, to: companyId } }));
  }
  activeCompanyId = companyId;
}

export function getActiveCompany() {
  return activeCompanyId;
}

export function assertCompanyPath(companyId, path) {
  if (!String(path).startsWith(`data/${companyId}/`)) {
    const error = new Error(`Tentativa de carregar path fora da empresa atual: ${path}`);
    error.code = 'CRYPTO_007';
    throw error;
  }
}
