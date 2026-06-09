const PROJECT_ROOT_URL = new URL('../../../', import.meta.url);

function normalizeProjectPath(path) {
  let value = String(path || '').trim();
  while (value.startsWith('../')) value = value.slice(3);
  while (value.startsWith('./')) value = value.slice(2);
  return value.replace(/^\/+/, '');
}

export function resolveProjectUrl(path) {
  return new URL(normalizeProjectPath(path), PROJECT_ROOT_URL).href;
}

export function resolveProjectPath(path) {
  return normalizeProjectPath(path);
}
