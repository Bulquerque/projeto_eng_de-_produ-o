function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

export function canonicalCdLabel(value) {
  const normalized = normalizeText(value);
  const match = normalized.match(/^([A-Z]{2})\s*[/\-|]\s*(.+)$/);
  return match ? match[2].trim() : normalized;
}

export function sameCdLabel(left, right) {
  return canonicalCdLabel(left) === canonicalCdLabel(right);
}

export function findMatchingCdLabel(candidate, options = []) {
  const target = canonicalCdLabel(candidate);
  return (options || []).find((option) => canonicalCdLabel(option) === target) || null;
}
