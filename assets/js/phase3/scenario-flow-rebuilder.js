import { findNearestCd } from '../core/geo-utils.js';
import { findMatchingCdLabel, sameCdLabel } from '../core/cd-utils.js';

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
  return (
    Number(
      flow.annual_revenue ?? flow.revenue ?? flow.annual_weight_kg ?? flow.volume ?? flow.batch ?? 0
    ) || 0
  );
}
function getCdUf(cd) {
  const match = String(cd || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .match(/^([A-Z]{2})\s*[/\-|]\s*(.+)$/);
  return match ? match[1].trim() : '';
}

function pickActiveCd(flow, activeCds, rule, distanceMatrix) {
  if (!activeCds.length) return null;
  const current = normalizeCd(flow);
  const matchedCurrent = findMatchingCdLabel(current, activeCds);
  if (matchedCurrent) return matchedCurrent;

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
  const exact = findMatchingCdLabel(normalizeCd(flow), activeCds);
  if (exact) return exact;
  const uf = String(flow.cd_uf || flow.destination_uf || '').toUpperCase();
  if (!uf) return null;
  return activeCds.find((cd) => getCdUf(cd) === uf) || null;
}

export function rebuildScenarioFlows({ scenario, baselineFlows = [], distanceMatrix }) {
  const c = scenario?.changes || {};
  const activeCds = c.active_cds || [];
  const closedCds = c.closed_cds || [];
  const rule = c.reallocation_rule || 'nearest_available_cd';
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
      message: `${uncovered} fluxos ficaram sem CD ativo.`,
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
    },
    warnings,
    errors,
  };
}
export function flowMeasure(flow) {
  return getFlowMeasure(flow);
}
