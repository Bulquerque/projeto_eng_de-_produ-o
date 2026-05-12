from pathlib import Path
import subprocess
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tests.crypto_helpers import NODE_DECRYPT_HELPER
ROOT=Path(__file__).resolve().parents[2]
code=NODE_DECRYPT_HELPER + r'''
import fs from 'fs';
import {runFinalQAChecks} from './assets/js/phase5/final-qa-checker.js';
import {validateRelease} from './assets/js/phase5/release-validator.js';
for (const companyId of ['empresa1','empresa2']) {
 const bundle=decryptJson(`data/${companyId}/phase2/phase2_bundle.json`);
 const selectedScenario={final_score:88, scenario_id:`${companyId}_fake`, result:{company_id:companyId}, quality:{risk_level:'low'}};
 const stress={stress_results:[{case_id:'a'}]}; const recommendation={recommendation_status:'recommended'}; const audit={company_id:companyId,selected_scenario_id:selectedScenario.scenario_id,baseline_scenario_id:bundle.model.scenario_id};
 const qa=runFinalQAChecks({companyId,bundle,selectedScenario,stress,recommendation,audit});
 if(qa.final_qa_status!=='passed') throw new Error('qa should pass');
 const release=validateRelease({finalQA:qa}); if(release.release_status!=='ready' || !release.ready_to_deliver) throw new Error('release should be ready');
 const bad=validateRelease({finalQA:{final_qa_status:'failed',blocking_issues:['x']}}); if(bad.release_status!=='blocked') throw new Error('bad release should block');
}
console.log('PHASE5_NODE_FINAL_QA_OK');
'''
res=subprocess.run(['node','--input-type=module','-e',code],cwd=ROOT,text=True,capture_output=True,timeout=120)
assert res.returncode==0, res.stderr+res.stdout
print(res.stdout.strip())
print('PHASE5_FINAL_QA_OK')
