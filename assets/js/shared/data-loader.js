import { parseDecryptedJson, CryptoDataError } from './data-decryptor.js';
import { decryptWithSession, installLockButton } from './crypto-session.js';
import { assertCompanyPath, setActiveCompany } from './company-context.js';
import { loadComplementPackage } from './complements.js';
import { requireHttpRuntime } from './runtime-env.js';
import { resolveProjectPath, resolveProjectUrl } from './project-paths.js';
import { recomputePhase2Baseline } from './phase2-baseline-deriver.js';

let encryptedManifest = null;

function isCompanyDataPath(path) {
  return /^data\/empresa[12]\//.test(resolveProjectPath(path));
}

async function fetchResource(path) {
  requireHttpRuntime('Carregamento de dados');
  const response = await fetch(resolveProjectUrl(path), { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response;
}

export async function fetchJson(path) {
  if (isCompanyDataPath(path)) return fetchEncryptedJson(path);
  return (await fetchResource(path)).json();
}

export async function fetchText(path) {
  if (isCompanyDataPath(path)) return fetchEncryptedText(path);
  return (await fetchResource(path)).text();
}

export async function loadEncryptedManifest() {
  requireHttpRuntime('Manifesto criptografado');
  if (encryptedManifest) return encryptedManifest;
  const response = await fetch(resolveProjectUrl('data/encrypted_manifest.json'), {
    cache: 'no-store',
  });
  if (!response.ok)
    throw new CryptoDataError('CRYPTO_001', 'encrypted_manifest.json não encontrado.');
  encryptedManifest = await response.json();
  return encryptedManifest;
}

async function findEncryptedEntry(path) {
  const originalPath = resolveProjectPath(path);
  const manifest = await loadEncryptedManifest();
  const entry = (manifest.entries || []).find((item) => item.original_path === originalPath);
  if (!entry)
    throw new CryptoDataError('CRYPTO_002', `Arquivo criptografado não mapeado: ${originalPath}`);
  return entry;
}

async function fetchEncryptedText(path) {
  const entry = await findEncryptedEntry(path);
  const response = await fetch(resolveProjectUrl(entry.encrypted_path), { cache: 'no-store' });
  if (!response.ok)
    throw new CryptoDataError('CRYPTO_002', `Arquivo .enc não encontrado: ${entry.encrypted_path}`);
  const envelope = await response.json();
  return decryptWithSession(entry, envelope);
}

async function fetchEncryptedJson(path) {
  const text = await fetchEncryptedText(path);
  return parseDecryptedJson(text, resolveProjectPath(path));
}

let catalogCache = null;
export async function loadCatalog() {
  requireHttpRuntime('Catálogo do pacote');
  if (catalogCache) return catalogCache;
  catalogCache = await fetchJson('data/catalog.json');
  return catalogCache;
}
let bundleCache = {};
let bundlePromises = {};
window.addEventListener('visagio:crypto-lock', () => {
  bundleCache = {};
  bundlePromises = {};
});

export async function loadPhase2Bundle(companyId) {
  setActiveCompany(companyId);
  if (bundleCache[companyId]) return bundleCache[companyId];
  if (bundlePromises[companyId]) return bundlePromises[companyId];

  bundlePromises[companyId] = (async () => {
    try {
      const path = `data/${companyId}/phase2/phase2_bundle.json`;
      assertCompanyPath(companyId, path);
      const bundle = await fetchEncryptedJson(path);
      if (bundle?.model?.company_id !== companyId)
        throw new CryptoDataError(
          'CRYPTO_006',
          `Bundle descriptografado não pertence a ${companyId}.`
        );

      // Attach derived core data needed by the physical simulation path.
      bundle.core_data = bundle.core_data || {};
      const loadCore = async (id, fileName) => {
        try {
          bundle.core_data[id] = await fetchEncryptedJson(`data/${companyId}/core/${fileName}`);
        } catch (e) {
          console.warn(`[data-loader] Could not load core ${id} for real formulas:`, e.message);
        }
      };

      if (companyId === 'empresa1') {
        await Promise.all([
          loadCore('distance_matrix', 'distance_matrix.json'),
          (async () => {
            try {
              bundle.core_data.aux_custo_transferencia = await fetchEncryptedJson(
                'data/empresa2/core/aux_custo_transferencia.json'
              );
            } catch (e) {
              console.warn(
                '[data-loader] Could not load proxy aux_custo_transferencia for Empresa 1:',
                e.message
              );
            }
          })(),
          (async () => {
            try {
              bundle.core_data.tax_data = await fetchJson(
                'data/complements/shared/tax_reference/icms_interstate_matrix.json'
              );
            } catch (e) {
              console.warn(
                '[data-loader] Could not load proxy icms_interstate_matrix for Empresa 1:',
                e.message
              );
            }
          })(),
        ]);
      } else if (companyId === 'empresa2') {
        await Promise.all([
          loadCore('lat_long', 'lat_long.json'),
          loadCore('rotas_mapa', 'rotas_mapa.json'),
          loadCore('tax_data', 'dados_tributario.json'),
          // Physical cost engine tables
          loadCore('tabelas_cif_dist', 'tabelas_cif_dist.json'),
          loadCore('aux_custo_transferencia', 'aux_custo_transferencia.json'),
          loadCore('aux_custo_armazenagem', 'aux_custo_armazenagem.json'),
        ]);
      }

      try {
        bundle.complements = { available: true, ...(await loadComplementPackage(companyId)) };
        bundle.tax_source_context =
          bundle.complements?.field_sources || bundle.complements?.source_summary || null;
      } catch (e) {
        console.warn(
          `[data-loader] Could not load complement package for ${companyId}:`,
          e.message
        );
        bundle.complements = {
          company_id: companyId,
          tenant_id:
            companyId === 'empresa1'
              ? 'empresa_1'
              : companyId === 'empresa2'
                ? 'empresa_2'
                : companyId,
          available: false,
          error: e.message,
          source_summary: [],
          field_sources: {},
          audit_sources: [],
        };
        bundle.tax_source_context = null;
      }

      recomputePhase2Baseline(bundle, companyId);

      installLockButton();
      bundleCache[companyId] = bundle;
      return bundle;
    } finally {
      delete bundlePromises[companyId];
    }
  })();

  return bundlePromises[companyId];
}
export async function loadPhase2Report() {
  return fetchJson('data/validation/phase2_implementation_report.json');
}
export async function loadPhase3Report() {
  return fetchJson('data/validation/phase3_implementation_report.json');
}
export async function loadPhase3Samples(companyId) {
  setActiveCompany(companyId);
  const path = `data/${companyId}/phase3/sample_scenarios.json`;
  assertCompanyPath(companyId, path);
  return fetchEncryptedJson(path);
}
