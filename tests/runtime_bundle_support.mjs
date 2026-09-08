import fs from 'fs';

import { recomputePhase2Baseline } from '../assets/js/phase2/baseline-deriver.js';
import {
  getCoreDataPaths,
  SHARED_TAX_REFERENCE_PATH,
} from '../assets/js/core/runtime-bundle-contract.js';

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
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

  return recomputePhase2Baseline(runtimeBundle, companyId);
}
