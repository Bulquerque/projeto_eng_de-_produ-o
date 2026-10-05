export function findNearestCd({ destination, activeCds, distanceMatrix = [] }) {
  if (!activeCds || activeCds.length === 0) return null;
  if (activeCds.length === 1) return activeCds[0];

  // Filter matrix for the specific destination
  const candidates = distanceMatrix.filter(
    (row) =>
      (row.DESTINO === destination || row.UF_DESTINO === destination) &&
      activeCds.includes(row.ORIGEM || row.UF_ORIGEM)
  );

  if (candidates.length === 0) {
    // Fallback to UF match if specific destination city not found in matrix
    return activeCds[0];
  }

  // Sort by distance
  candidates.sort((a, b) => Number(a['Distancia(KM)'] || 0) - Number(b['Distancia(KM)'] || 0));

  return candidates[0].ORIGEM || candidates[0].UF_ORIGEM;
}
