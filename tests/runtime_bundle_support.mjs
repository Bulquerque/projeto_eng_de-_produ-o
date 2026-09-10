import fs from 'fs';

import { recomputePhase2Baseline } from '../assets/js/phase2/baseline-deriver.js';
import {
  getCoreDataPaths,
  SHARED_TAX_REFERENCE_PATH,
} from '../assets/js/core/runtime-bundle-contract.js';
import { buildComplementPackage, normalizeTenantId } from '../assets/js/core/complements.js';

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function readComplementJson(relativePath) {
  return readJson(`data/complements/${relativePath}`);
}

function loadRuntimeComplements(companyId) {
  const tenantId = normalizeTenantId(companyId);
  return buildComplementPackage({
    companyId,
    manifest: readComplementJson('complementos_manifest.json'),
    companyProfile: readComplementJson('frontend_api_complementos/company_profiles.json').find(
      (profile) => String(profile.tenant_id || '') === tenantId
    ),
    sourceLegend: readComplementJson('frontend_api_complementos/source_confidence_legend.json'),
    readinessSummary: readComplementJson('frontend_api_complementos/readiness_summary.json'),
    tenantManifest: readComplementJson(`complementos/${tenantId}/tenant_manifest.json`),
    taxManifest: readComplementJson(`complementos/${tenantId}/tax/tax_manifest.json`),
    taxAssumptions: readComplementJson(`complementos/${tenantId}/tax/tax_assumptions.json`),
    taxSourceMap: readComplementJson(`complementos/${tenantId}/tax/tax_source_map.json`),
    taxScenarioBridge: readComplementJson(`complementos/${tenantId}/tax/tax_scenario_bridge.json`),
    sourceCatalog: readComplementJson('shared/tax_reference/source_catalog.json'),
    taxReformTimeline: readComplementJson('shared/tax_reference/tax_reform_timeline.json'),
    ufReference: readComplementJson('shared/tax_reference/uf_reference.json'),
    validationChecklist: readComplementJson(
      `complementos/${tenantId}/validation/validation_checklist.json`
    ),
    proxyRegistry: readComplementJson(`complementos/${tenantId}/validation/proxy_registry.json`),
    scenarioRegistry: readComplementJson(
      `complementos/${tenantId}/scenarios/scenario_registry.json`
    ),
  });
}

/**
 * Reproduz o bundle que o navegador entrega aos motores de cálculo.
 *
 * A auditoria Node não deve usar apenas o JSON bruto: o navegador anexa as
 * tabelas core e recalcula o baseline antes de qualquer cenário. Manter esta
 * preparação em um único helper evita que testes e UI validem modelos
 * diferentes.
 */
export function loadRuntimeBundle({ companyId, decryptJson, bundle = null } = {}) {
  if (!companyId || typeof decryptJson !== 'function') {
    throw new Error('companyId e decryptJson são obrigatórios para carregar o bundle de runtime.');
  }

  const runtimeBundle = bundle || decryptJson(`data/${companyId}/phase2/phase2_bundle.json`);
  runtimeBundle.core_data = { ...(runtimeBundle.core_data || {}) };

  for (const [key, relativePath] of Object.entries(getCoreDataPaths(companyId))) {
    runtimeBundle.core_data[key] = decryptJson(relativePath);
  }

  if (companyId === 'empresa1') {
    runtimeBundle.core_data.tax_data = readJson(SHARED_TAX_REFERENCE_PATH);
  }

  runtimeBundle.complements = loadRuntimeComplements(companyId);

  return recomputePhase2Baseline(runtimeBundle, companyId);
}
