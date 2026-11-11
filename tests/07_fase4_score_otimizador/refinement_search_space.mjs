import assert from 'node:assert/strict';
import {
  classifyRefinementCandidates,
  scenarioChangesKey,
} from '../../assets/js/phase4/optimizer-utils.js';

const cds = ['CD-A', 'CD-B', 'CD-C', 'CD-D'];
const domain = {
  active_cd_ids: cds,
  dimensions: {
    freight_multipliers: [1],
    demand_multipliers: [1],
    inventory_days_options: [45],
    tax_modes: ['current'],
  },
  fixed_changes: {
    wacc: 0.12,
    tax_regime: 'current',
    tax_year: undefined,
    reallocation_rule: 'default_rule',
  },
};

function makeCandidate(activeCds, freightMultiplier = 1) {
  const active = new Set(activeCds);
  return {
    changes: {
      active_cds: activeCds,
      closed_cds: cds.filter((cd) => !active.has(cd)),
      freight_multiplier: freightMultiplier,
      demand_multiplier: 1,
      inventory_days: 45,
      tax_mode: 'current',
      wacc: 0.12,
      tax_regime: 'current',
      reallocation_rule: 'default_rule',
    },
  };
}

const catalogCandidate = makeCandidate(['CD-A', 'CD-B']);
const overlapFromUnvisitedSubset = makeCandidate(['CD-A', 'CD-C']);
const outsideDeclaredFreight = makeCandidate(['CD-A', 'CD-C'], 0.95);
const baseKeys = new Set([scenarioChangesKey(catalogCandidate.changes)]);

const overlapCounts = classifyRefinementCandidates({
  candidates: [catalogCandidate, overlapFromUnvisitedSubset],
  baseScenarioKeys: baseKeys,
  domain,
  baseCandidateSpaceSize: 15,
});
assert.deepEqual(
  {
    unique: overlapCounts.uniqueCandidateCount,
    newToCatalog: overlapCounts.newToCatalogCount,
    within: overlapCounts.withinDeclaredSpaceCount,
    outside: overlapCounts.outsideDeclaredSpaceCount,
    space: overlapCounts.candidateSpaceSize,
  },
  { unique: 2, newToCatalog: 1, within: 1, outside: 0, space: 15 },
  'a new-to-catalog CD subset still belongs to the theoretical 2^n-1 domain'
);

const extendedCounts = classifyRefinementCandidates({
  candidates: [overlapFromUnvisitedSubset, outsideDeclaredFreight],
  baseScenarioKeys: baseKeys,
  domain,
  baseCandidateSpaceSize: 15,
});
assert.deepEqual(
  {
    unique: extendedCounts.uniqueCandidateCount,
    newToCatalog: extendedCounts.newToCatalogCount,
    within: extendedCounts.withinDeclaredSpaceCount,
    outside: extendedCounts.outsideDeclaredSpaceCount,
    space: extendedCounts.candidateSpaceSize,
  },
  { unique: 2, newToCatalog: 2, within: 1, outside: 1, space: 16 },
  'only a refinement introducing a parameter outside the declared domain extends the count'
);

console.log('REFINEMENT_SEARCH_SPACE_OK');
