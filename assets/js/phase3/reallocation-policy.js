export function defaultReallocationRule(companyId) {
  return companyId === 'empresa1' ? 'lowest_freight_available_cd' : 'nearest_available_cd';
}
