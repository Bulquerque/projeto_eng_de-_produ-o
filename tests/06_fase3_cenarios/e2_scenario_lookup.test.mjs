import assert from 'node:assert/strict';

import { resolveEmpresa2EsCd } from '../../scripts/audit/e2_scenario_lookup.mjs';

const activeCds = ['CD Norte', 'CD Centro', 'CD ES'];

function flow(cd, cdUf = 'ES', flowType = 'factory_to_cd') {
  return { flow_id: 'private-fixture-id', cd, cd_uf: cdUf, flow_type: flowType };
}

assert.deepEqual(resolveEmpresa2EsCd({ activeCds, flows: [flow('CD Norte', 'RJ')] }), {
  status: 'blocked',
  reason_code: 'NO_ES_FACTORY_TO_CD_MATCH',
  candidate_count: 0,
  matched_flow_count: 0,
});

assert.deepEqual(
  resolveEmpresa2EsCd({
    activeCds,
    flows: [
      flow('ES / CD ES'),
      flow('ES / CD ES', 'es'),
      flow('CD Norte', 'ES', 'branch_to_destination'),
    ],
  }),
  {
    status: 'resolved',
    reason_code: 'UNIQUE_ES_FACTORY_TO_CD_MATCH',
    cd: 'CD ES',
    candidate_count: 1,
    matched_flow_count: 2,
  }
);

const multiple = resolveEmpresa2EsCd({
  activeCds: ['CD A', 'CD B'],
  flows: [flow('CD A'), flow('CD B')],
});
assert.equal(multiple.status, 'blocked');
assert.equal(multiple.reason_code, 'MULTIPLE_ES_FACTORY_TO_CD_MATCHES');
assert.equal(multiple.candidate_count, 2);

const conflictingMetadata = resolveEmpresa2EsCd({
  activeCds: ['CD A'],
  flows: [flow('CD A'), flow('CD A', 'RJ')],
});
assert.equal(conflictingMetadata.status, 'blocked');
assert.equal(conflictingMetadata.reason_code, 'CONFLICTING_CD_UF_METADATA');

console.log('E2_SCENARIO_LOOKUP_OK');
