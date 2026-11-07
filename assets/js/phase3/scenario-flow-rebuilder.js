import { findNearestCd } from '../core/geo-utils.js';
import { findMatchingCdLabel, sameCdLabel } from '../core/cd-utils.js';
import { defaultReallocationRule } from './reallocation-policy.js';

function normalizeCd(flow) {
  return flow.cd || flow.origin || flow.destination || '';
}

const NON_ASSIGNABLE_ORIGIN_CODES = new Set([1001, 3001]);

function isAssignableCdFlow(flow) {
  // A factory→CD row ends at a CD and can be reallocated. Filial and
  // factory→destination rows are source-side evidence and stay untouched.
  return (
    !NON_ASSIGNABLE_ORIGIN_CODES.has(Number(flow?.origin_code)) &&
    flow?.flow_type !== 'factory_to_destination'
  );
}
function getFlowMeasure(flow) {
  if (flow?.flow_type === 'factory_to_cd') {
    return Number(flow.annual_weight_kg ?? flow.weight_kg ?? 0) || 0;
  }
  return (
    Number(flow.annual_revenue ?? flow.revenue ?? flow.annual_weight_kg ?? flow.weight_kg ?? 0) || 0
  );
}
function getCdUf(cd) {
  const normalized = String(cd || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  const redMatch = normalized.match(/^RED\s*[/\-|]\s*([A-Z]{2})(?:\s*[/\-|].*)?$/);
  if (redMatch) return redMatch[1];
  const ufOnly = normalized.match(/^([A-Z]{2})$/);
  if (ufOnly) return ufOnly[1];
  const match = normalized.match(/^([A-Z]{2})\s*[/\-|]\s*(.+)$/);
  return match ? match[1].trim() : '';
}

function pickActiveCd(flow, activeCds, rule, distanceMatrix) {
  if (!activeCds.length) return null;
  const current = normalizeCd(flow);
  const matchedCurrent = findMatchingCdLabel(current, activeCds);
  if (matchedCurrent) return matchedCurrent;

  if (rule === 'lowest_freight_available_cd') {
    if (!Array.isArray(distanceMatrix)) return null;
    const destination =
      flow.centroid || flow.destination || flow.destination_city || flow.destination_uf;
    const exactRows = distanceMatrix.filter(
      (row) =>
        row.DESTINO === destination ||
        (!String(row.DESTINO ?? '').trim() && row.UF_DESTINO === destination)
    );
    const rows = exactRows.length
      ? exactRows
      : distanceMatrix.filter(
          (row) =>
            !String(row.DESTINO ?? '').trim() &&
            String(row.UF_DESTINO ?? '')
              .trim()
              .toUpperCase() ===
              String(flow.destination_uf ?? '')
                .trim()
                .toUpperCase() &&
            String(flow.destination_uf ?? '').trim() !== ''
        );
    const candidates = rows
      .map((row) => {
        const label = row.UF_ORIGEM && row.ORIGEM ? `${row.UF_ORIGEM} / ${row.ORIGEM}` : row.ORIGEM;
        const activeCd =
          findMatchingCdLabel(label, activeCds) || findMatchingCdLabel(row.ORIGEM, activeCds);
        const freightPerKg = Number(row['Frete (R$/Kg)'] ?? row.frete_por_kg);
        const distanceKm = Number(row['Distancia(KM)'] ?? row.distance_km);
        return {
          activeCd,
          freightPerKg,
          distanceKm: Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : Infinity,
        };
      })
      .filter(
        (candidate) =>
          candidate.activeCd &&
          Number.isFinite(candidate.freightPerKg) &&
          candidate.freightPerKg > 0
      )
      .sort(
        (left, right) =>
          left.freightPerKg - right.freightPerKg ||
          left.distanceKm - right.distanceKm ||
          left.activeCd.localeCompare(right.activeCd, 'pt-BR')
      );
    return candidates[0]?.activeCd || null;
  }

  if (rule === 'nearest_available_cd' && distanceMatrix) {
    const destination =
      flow.centroid || flow.destination || flow.destination_city || flow.destination_uf;
    const candidates = distanceMatrix
      .filter((row) => row.DESTINO === destination || row.UF_DESTINO === destination)
      .sort(
        (left, right) => Number(left['Distancia(KM)'] || 0) - Number(right['Distancia(KM)'] || 0)
      );
    for (const row of candidates) {
      const label = row.UF_ORIGEM && row.ORIGEM ? `${row.UF_ORIGEM} / ${row.ORIGEM}` : row.ORIGEM;
      const match =
        findMatchingCdLabel(label, activeCds) || findMatchingCdLabel(row.ORIGEM, activeCds);
      if (match) return match;
    }
    return findNearestCd({ destination, activeCds, distanceMatrix });
  }

  if (rule === 'first_available_cd') return activeCds[0];
  const destUf = flow.destination_uf || flow.cd_uf || flow.origin_uf || '';
  const sameUf = activeCds.find((cd) => getCdUf(cd) === String(destUf).toUpperCase());
  return sameUf || activeCds[0];
}

function findActiveCdForFlow(flow, activeCds) {
  const originalCd = normalizeCd(flow);
  const exact = findMatchingCdLabel(originalCd, activeCds);
  if (exact) return exact;
  // A named CD that is no longer active must follow the selected rule,
  // even when another active CD happens to be in the same state.
  if (originalCd) return null;
  const uf = String(flow.cd_uf || flow.destination_uf || '').toUpperCase();
  if (!uf) return null;
  return activeCds.find((cd) => getCdUf(cd) === uf) || null;
}

export function rebuildScenarioFlows({ scenario, baselineFlows = [], distanceMatrix }) {
  const c = scenario?.changes || {};
  const activeCds = c.active_cds || [];
  const closedCds = c.closed_cds || [];
  const rule = c.reallocation_rule || defaultReallocationRule(scenario?.company_id);
  const warnings = [];
  const errors = [];
  let reallocated = 0,
    unchanged = 0,
    uncovered = 0;
  const flows = baselineFlows.map((flow, idx) => {
    const baseCd = normalizeCd(flow);
    const assignable = isAssignableCdFlow(flow);
    const baseMatch = assignable ? findActiveCdForFlow(flow, activeCds) : baseCd;
    const isClosed = closedCds.some((cd) => sameCdLabel(cd, baseCd));
    const shouldMove = assignable && (isClosed || !baseMatch);
    const target = shouldMove
      ? pickActiveCd(flow, activeCds, rule, distanceMatrix)
      : baseMatch || baseCd;
    if (!target) {
      uncovered++;
      return {
        ...flow,
        flow_id: `${scenario.scenario_id}_flow_${idx + 1}`,
        previous_cd: baseCd,
        previous_cd_uf: flow.cd_uf || flow.destination_uf || null,
        cd: null,
        assigned_cd: null,
        assigned_cd_uf: null,
        reallocation_status: 'uncovered',
        reallocation_rule: rule,
      };
    }
    if (shouldMove) reallocated++;
    else unchanged++;
    return {
      ...flow,
      flow_id: `${scenario.scenario_id}_flow_${idx + 1}`,
      previous_cd: shouldMove ? baseCd : undefined,
      previous_cd_uf: shouldMove ? flow.cd_uf || flow.destination_uf || null : undefined,
      cd: target,
      cd_uf: shouldMove ? getCdUf(target) || flow.cd_uf || null : flow.cd_uf,
      assigned_cd: target,
      assigned_cd_uf: getCdUf(target) || flow.cd_uf || flow.destination_uf || null,
      reallocation_status: shouldMove ? 'reallocated' : 'unchanged',
      reallocation_rule: rule,
      scenario_id: scenario.scenario_id,
      company_id: scenario.company_id,
    };
  });
  if (reallocated)
    warnings.push({
      code: 'FLOWS_REALLOCATED',
      message: `${reallocated} fluxos foram realocados por mudança de CDs ativos.`,
      severity: 'warning',
    });
  if (uncovered)
    errors.push({
      code: 'UNCOVERED_FLOWS',
      message: `${uncovered} fluxos não puderam ser atribuídos pela regra ${rule}; verifique se há dados aplicáveis para um CD ativo.`,
      severity: 'error',
    });
  const totalMeasure = flows.reduce((a, f) => a + getFlowMeasure(f), 0);
  const byCd = {};
  flows.forEach((f) => {
    const cd = f.cd || 'SEM_CD';
    byCd[cd] = (byCd[cd] || 0) + getFlowMeasure(f);
  });
  return {
    scenario_id: scenario.scenario_id,
    company_id: scenario.company_id,
    flows,
    flow_summary: {
      total_flows: flows.length,
      reallocated_flows: reallocated,
      unchanged_flows: unchanged,
      uncovered_flows: uncovered,
      total_measure: totalMeasure,
      measure_by_cd: byCd,
      measure_basis:
        'annual_revenue_for_destination_flows; annual_weight_kg_only_for_factory_flows; undocumented_volume_excluded',
    },
    warnings,
    errors,
  };
}
export function flowMeasure(flow) {
  return getFlowMeasure(flow);
}
