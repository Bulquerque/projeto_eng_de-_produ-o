import { sameCdLabel } from '../../assets/js/core/cd-utils.js';

const normalizeUf = (value) =>
  String(value ?? '')
    .trim()
    .toUpperCase();

/**
 * Resolve the unique active Empresa 2 CD whose observed factory-to-CD flows
 * declare destination UF ES. The returned CD identifier is intended for
 * in-memory scenario construction; this helper never logs or serializes it.
 */
export function resolveEmpresa2EsCd({ activeCds = [], flows = [] } = {}) {
  const cds = [...new Set((Array.isArray(activeCds) ? activeCds : []).filter(Boolean))];
  const factoryFlows = (Array.isArray(flows) ? flows : []).filter(
    (flow) => flow?.flow_type === 'factory_to_cd'
  );
  const esFlows = factoryFlows.filter((flow) => normalizeUf(flow?.cd_uf) === 'ES');
  const candidates = new Map();

  for (const flow of esFlows) {
    const matches = cds.filter((cd) => sameCdLabel(cd, flow?.cd));
    if (matches.length > 1) {
      return {
        status: 'blocked',
        reason_code: 'AMBIGUOUS_CD_LABEL_JOIN',
        candidate_count: 0,
        matched_flow_count: esFlows.length,
      };
    }
    if (matches.length === 1) {
      const key = String(matches[0]);
      const current = candidates.get(key) || { cd: matches[0], flowCount: 0 };
      current.flowCount += 1;
      candidates.set(key, current);
    }
  }

  if (candidates.size === 0) {
    return {
      status: 'blocked',
      reason_code: 'NO_ES_FACTORY_TO_CD_MATCH',
      candidate_count: 0,
      matched_flow_count: 0,
    };
  }

  if (candidates.size > 1) {
    return {
      status: 'blocked',
      reason_code: 'MULTIPLE_ES_FACTORY_TO_CD_MATCHES',
      candidate_count: candidates.size,
      matched_flow_count: esFlows.length,
    };
  }

  const candidate = [...candidates.values()][0];
  const candidateFlows = factoryFlows.filter((flow) => sameCdLabel(candidate.cd, flow?.cd));
  if (
    candidateFlows.some((flow) => {
      const uf = normalizeUf(flow?.cd_uf);
      return !uf || uf !== 'ES';
    })
  ) {
    return {
      status: 'blocked',
      reason_code: 'CONFLICTING_CD_UF_METADATA',
      candidate_count: 1,
      matched_flow_count: candidate.flowCount,
    };
  }

  return {
    status: 'resolved',
    reason_code: 'UNIQUE_ES_FACTORY_TO_CD_MATCH',
    cd: candidate.cd,
    candidate_count: 1,
    matched_flow_count: candidate.flowCount,
  };
}
