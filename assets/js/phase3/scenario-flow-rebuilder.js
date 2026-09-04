import { findNearestCd } from '../shared/geo-utils.js';
import { findMatchingCdLabel, sameCdLabel } from '../shared/cd-utils.js';

function normalizeCd(flow) {
  return flow.cd || flow.origin || flow.destination || '';
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
    return findNearestCd({ destination, activeCds, distanceMatrix });
  }

  if (rule === 'first_available_cd') return activeCds[0];
  const destUf = flow.destination_uf || flow.cd_uf || flow.origin_uf || '';
  const sameUf = activeCds.find((cd) => getCdUf(cd) === String(destUf).toUpperCase());
  return sameUf || activeCds[0];
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
    const isClosed = closedCds.some((cd) => sameCdLabel(cd, baseCd));
    // A source that is not a distribution centre (for example, supplier or
    // factory flows in Empresa 2) must not be reassigned merely because it is
    // absent from the active-CD list. Only a CD explicitly closed by the
    // scenario triggers reallocation.
    const shouldMove = isClosed;
    // Preserve the source label when the flow stays in its current CD. Replacing
    // a city label with the UI label "UF / city" changes exact matrix matches
    // and makes the baseline simulation diverge from the displayed baseline.
    const target = shouldMove ? pickActiveCd(flow, activeCds, rule, distanceMatrix) : baseCd;
    if (!target) {
      uncovered++;
      return {
        ...flow,
        flow_id: `${scenario.scenario_id}_flow_${idx + 1}`,
        previous_cd: baseCd,
        cd: null,
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
      cd: target,
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
