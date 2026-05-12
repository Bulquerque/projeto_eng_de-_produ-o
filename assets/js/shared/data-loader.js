import { parseDecryptedJson, CryptoDataError } from './data-decryptor.js';
import { decryptWithSession, installLockButton } from './crypto-session.js';
import { assertCompanyPath, setActiveCompany } from './company-context.js';
import { buildBundleReconciliation } from './reconciliation-engine.js';

let encryptedManifest = null;

function requestPrefix(path) {
  return String(path).startsWith('../') ? '../' : '';
}

function normalizeDataPath(path) {
  return String(path).replace(/^\.\.\//, '').replace(/^\.\//, '').replace(/^\/+/, '');
}

function requestPathFor(path, prefix = '../') {
  const normalized = normalizeDataPath(path);
  return `${prefix}${normalized}`;
}

function isCompanyDataPath(path) {
  return /^data\/empresa[12]\//.test(normalizeDataPath(path));
}

export async function fetchJson(path) {
  if (isCompanyDataPath(path)) return fetchEncryptedJson(path);
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

export async function fetchText(path) {
  if (isCompanyDataPath(path)) return fetchEncryptedText(path);
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.text();
}

export async function loadEncryptedManifest(prefix = '../') {
  if (encryptedManifest) return encryptedManifest;
  const response = await fetch(`${prefix}data/encrypted_manifest.json`, { cache: 'no-store' });
  if (!response.ok) throw new CryptoDataError('CRYPTO_001', 'encrypted_manifest.json não encontrado.');
  encryptedManifest = await response.json();
  return encryptedManifest;
}

async function findEncryptedEntry(path, prefix = '../') {
  const originalPath = normalizeDataPath(path);
  const manifest = await loadEncryptedManifest(prefix);
  const entry = (manifest.entries || []).find((item) => item.original_path === originalPath);
  if (!entry) throw new CryptoDataError('CRYPTO_002', `Arquivo criptografado não mapeado: ${originalPath}`);
  return entry;
}

async function fetchEncryptedText(path) {
  const prefix = requestPrefix(path) || '../';
  const entry = await findEncryptedEntry(path, prefix);
  const response = await fetch(requestPathFor(entry.encrypted_path, prefix), { cache: 'no-store' });
  if (!response.ok) throw new CryptoDataError('CRYPTO_002', `Arquivo .enc não encontrado: ${entry.encrypted_path}`);
  const envelope = await response.json();
  return decryptWithSession(entry, envelope);
}

async function fetchEncryptedJson(path) {
  const text = await fetchEncryptedText(path);
  return parseDecryptedJson(text, normalizeDataPath(path));
}

export async function loadCatalog() { return fetchJson('../data/catalog.json'); }
export async function loadPhase2Bundle(companyId) {
  setActiveCompany(companyId);
  const path = `data/${companyId}/phase2/phase2_bundle.json`;
  assertCompanyPath(companyId, path);
  const bundle = await fetchEncryptedJson(`../${path}`);
  if (bundle?.model?.company_id !== companyId) throw new CryptoDataError('CRYPTO_006', `Bundle descriptografado não pertence a ${companyId}.`);
  
  // REAL FORMULA FIX: Attach core data for physical simulation
  bundle.core_data = bundle.core_data || {};
  const loadCore = async (id, fileName) => {
    try {
      bundle.core_data[id] = await fetchEncryptedJson(`../data/${companyId}/core/${fileName}`);
    } catch (e) {
      console.warn(`[data-loader] Could not load core ${id} for real formulas:`, e.message);
    }
  };

  if (companyId === 'empresa1') {
    await loadCore('distance_matrix', 'distance_matrix.json');
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

  bundle.reconciliation = buildBundleReconciliation(bundle);
  installLockButton();
  return bundle;
}
export async function loadPhase2Report() { return fetchJson('../data/validation/phase2_implementation_report.json'); }
export async function loadPhase3Report() { return fetchJson('../data/validation/phase3_implementation_report.json'); }
export async function loadPhase3Samples(companyId) {
  setActiveCompany(companyId);
  const path = `data/${companyId}/phase3/sample_scenarios.json`;
  assertCompanyPath(companyId, path);
  return fetchEncryptedJson(`../${path}`);
}
