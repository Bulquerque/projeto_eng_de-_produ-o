import { readStorageJSON, writeStorageJSON, removeStorageKey } from './browser-storage.js';

const OPTIMIZATION_CONFIG_KEY = 'visagio_optimization_config_v1';
const OPTIMIZATION_PRESETS_KEY = 'visagio_optimization_presets_v1';

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

export function clearOptimizationConfig() {
  return removeStorageKey('session', OPTIMIZATION_CONFIG_KEY);
}

export function loadOptimizationPresets(companyId) {
  const presets = readStorageJSON('session', OPTIMIZATION_PRESETS_KEY, []);
  return Array.isArray(presets) ? presets.filter((preset) => preset?.company_id === companyId) : [];
}

export function saveOptimizationPreset(companyId, preset) {
  const current = readStorageJSON('session', OPTIMIZATION_PRESETS_KEY, []);
  const presets = Array.isArray(current) ? current : [];
  const record = {
    ...preset,
    company_id: companyId,
    preset_id: preset.preset_id || `custom_${Date.now().toString(36)}`,
    saved_at: new Date().toISOString(),
  };
  const next = [
    ...presets.filter(
      (item) => item?.company_id !== companyId || item?.preset_id !== record.preset_id
    ),
    record,
  ];
  return writeStorageJSON('session', OPTIMIZATION_PRESETS_KEY, next) ? record : null;
}
