import { buildScenarioFromForm } from '../phase3/scenario-builder.js';
import { MODEL_DEFAULTS } from '../core/model-configuration.js';
import { uniqueByChanges } from './optimizer-utils.js';
function combinations(arr, k, limit = 80) {
  const out = [];
  function rec(start, cur) {
    if (out.length >= limit) return;
    if (cur.length === k) {
      out.push([...cur]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      cur.push(arr[i]);
      rec(i + 1, cur);
      cur.pop();
    }
  }
  rec(0, []);
  return out;
}
function seededShuffle(list, seed = 42) {
  const out = [...list];
  let state = Math.trunc(Number(seed)) >>> 0;
  for (let index = out.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state ^ (state >>> 16), 2246822519) + 3266489917) >>> 0;
    const swapIndex = state % (index + 1);
    [out[index], out[swapIndex]] = [out[swapIndex], out[index]];
  }
  return out;
}
function uniqueSets(sets) {
  const seen = new Set();
  const out = [];
  for (const set of sets) {
    const normalizedSet = [...new Set(set || [])].sort();
    const key = JSON.stringify(normalizedSet);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalizedSet);
  }
  return out;
}
export function generateCandidateScenarios({ companyId, baselineBundle, generationConfig = {} }) {
  const baseCds = baselineBundle?.model?.active_cds || [];
  const maxCandidates = Number(generationConfig.max_candidates ?? 120);
  const freight = generationConfig.freight_multipliers || [0.95, 1, 1.1];
  const inv = generationConfig.inventory_days_options || [30, MODEL_DEFAULTS.inventory_days, 60];
  const baseTaxMode = generationConfig.base_tax_mode || 'current';
  const baseTaxRegime = generationConfig.base_tax_regime || null;
  const tax = generationConfig.allow_tax_disabled ? [baseTaxMode, 'disabled'] : [baseTaxMode];
  const demand = generationConfig.demand_multipliers || [0.95, 1, 1.05];
  const exhaustiveSubsets = generationConfig.exhaustive_subsets === true || baseCds.length <= 4;
  const cdSets = [];
  if (exhaustiveSubsets) {
    for (let k = 1; k <= baseCds.length; k += 1)
      for (const c of combinations(baseCds, k, Number.POSITIVE_INFINITY)) cdSets.push(c);
  } else {
    if (baseCds.length) cdSets.push(baseCds);
    for (const cd of baseCds.slice(0, Math.min(baseCds.length, 10))) cdSets.push([cd]);
    for (let i = 0; i < baseCds.length && cdSets.length < 50; i++)
      cdSets.push(baseCds.filter((_, idx) => idx !== i));
    const maxPairBase = baseCds.slice(0, Math.min(4, baseCds.length));
    for (const c of combinations(maxPairBase, 2, 40)) cdSets.push(c);
    const maxTripleBase = baseCds.slice(0, Math.min(4, baseCds.length));
    for (const c of combinations(maxTripleBase, 3, 30)) cdSets.push(c);
  }
  const cdSetsUnique = seededShuffle(uniqueSets(cdSets), generationConfig.seed ?? 42);
  const candidates = [];
  let idx = 1;
  outer: for (const cds of cdSetsUnique) {
    for (const fm of freight) {
      for (const days of inv) {
        for (const tm of tax) {
          for (const dm of demand) {
            const name = `Candidato ${String(idx).padStart(3, '0')} · ${cds.length} CD(s)`;
            const s = buildScenarioFromForm({
              companyId,
              baselineBundle,
              scenarioId: `${companyId}_candidate_${String(idx).padStart(3, '0')}`,
              formValues: {
                scenario_name: name,
                active_cds: cds,
                freight_multiplier: fm,
                demand_multiplier: dm,
                inventory_days: days,
                wacc: MODEL_DEFAULTS.reference_wacc,
                tax_mode: tm,
                tax_regime: baseTaxRegime,
                reallocation_rule: 'nearest_available_cd',
                scenario_type: 'candidate',
              },
            });
            candidates.push(s);
            idx++;
            if (Number.isFinite(maxCandidates) && candidates.length >= maxCandidates) break outer;
          }
        }
      }
    }
  }
  const candidate_scenarios = uniqueByChanges(candidates);
  const fullCdSetCount = baseCds.length > 30 ? null : 2 ** baseCds.length - 1;
  const fullCandidateSpaceSize = fullCdSetCount
    ? fullCdSetCount * freight.length * inv.length * tax.length * demand.length
    : null;
  const coveredCandidateSpaceSize =
    cdSetsUnique.length * freight.length * inv.length * tax.length * demand.length;
  const limited_by_max_candidates =
    Number.isFinite(maxCandidates) && candidates.length >= maxCandidates;
  return {
    company_id: companyId,
    candidate_scenarios: Number.isFinite(maxCandidates)
      ? candidate_scenarios.slice(0, maxCandidates)
      : candidate_scenarios,
    generation_summary: {
      generated: candidate_scenarios.length,
      candidate_space_size: fullCandidateSpaceSize ?? coveredCandidateSpaceSize,
      covered_candidate_space_size: coveredCandidateSpaceSize,
      cd_set_count: cdSetsUnique.length,
      full_cd_set_count: fullCdSetCount,
      search_space_complete: Boolean(fullCdSetCount && cdSetsUnique.length === fullCdSetCount),
      search_space_strategy: exhaustiveSubsets ? 'exhaustive_subsets' : 'bounded_subset_catalog',
      limited_by_max_candidates,
      max_candidates: maxCandidates,
    },
    warnings: [],
    errors: [],
  };
}
