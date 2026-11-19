import { readStorageJSON, writeStorageJSON } from './browser-storage.js';

const OPTIMIZATION_CONFIG_KEY = 'visagio_optimization_config_v1';

export function saveOptimizationConfig(config = {}) {
  return writeStorageJSON('session', OPTIMIZATION_CONFIG_KEY, {
    ...config,
    saved_at: new Date().toISOString(),
  });
}

export function loadOptimizationConfig(companyId) {
  const config = readStorageJSON('session', OPTIMIZATION_CONFIG_KEY, null);
  return config?.company_id === companyId ? config : null;
}
