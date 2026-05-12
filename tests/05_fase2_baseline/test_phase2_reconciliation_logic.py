from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tests.crypto_helpers import NODE_DECRYPT_HELPER

ROOT = Path(__file__).resolve().parents[2]

code = NODE_DECRYPT_HELPER + r'''
import {buildBundleReconciliation} from './assets/js/shared/reconciliation-engine.js';
for (const companyId of ['empresa1','empresa2']) {
  const bundle = decryptJson(`data/${companyId}/phase2/phase2_bundle.json`);
  const reconciliation = buildBundleReconciliation(bundle);
  if (companyId === 'empresa1') {
    if (reconciliation.overall.status !== 'pending') throw new Error('empresa1 should remain pending');
    if (reconciliation.operational.status !== 'pending') throw new Error('empresa1 operational should be pending');
  } else {
    if (reconciliation.operational.status !== 'aligned') throw new Error('empresa2 operational should be aligned');
    if (reconciliation.tax.status !== 'within_tolerance') throw new Error('empresa2 tax should be within_tolerance');
    if (reconciliation.overall.status !== 'fully_reconciled') throw new Error('empresa2 overall should be fully_reconciled');
  }
}
console.log('PHASE2_RECONCILIATION_OK');
'''

result = subprocess.run(
    ['node', '--input-type=module', '-e', code],
    cwd=ROOT,
    text=True,
    capture_output=True,
    timeout=120,
)

assert result.returncode == 0, result.stderr + result.stdout
print(result.stdout.strip())
