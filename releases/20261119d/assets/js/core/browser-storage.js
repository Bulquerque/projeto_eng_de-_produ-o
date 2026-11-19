function resolveStorage(scope) {
  if (typeof window === 'undefined') return null;
  try {
    return scope === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function canUseStorage(scope = 'local') {
  const storage = resolveStorage(scope);
  if (!storage) return false;

  const probeKey = '__visagio_storage_probe__';
  try {
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

export function readStorageValue(scope, key, fallback = null) {
  const storage = resolveStorage(scope);
  if (!storage) return fallback;

  try {
    const value = storage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writeStorageValue(scope, key, value) {
  const storage = resolveStorage(scope);
  if (!storage) return false;

  try {
    if (value === null || value === undefined) storage.removeItem(key);
    else storage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorageKey(scope, key) {
  const storage = resolveStorage(scope);
  if (!storage) return false;

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function listStorageKeys(scope, prefix = '') {
  const storage = resolveStorage(scope);
  if (!storage) return [];

  try {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && (!prefix || key.startsWith(prefix))) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

export function readStorageJSON(scope, key, fallback) {
  const raw = readStorageValue(scope, key, null);
  if (raw === null) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStorageJSON(scope, key, value) {
  try {
    return writeStorageValue(scope, key, JSON.stringify(value));
  } catch {
    return false;
  }
}
