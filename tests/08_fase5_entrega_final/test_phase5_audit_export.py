from pathlib import Path
import subprocess
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tests.crypto_helpers import NODE_DECRYPT_HELPER
ROOT=Path(__file__).resolve().parents[2]
code=NODE_DECRYPT_HELPER + r'''
import fs from 'fs';
import {buildObjective} from './assets/js/phase4/objective-builder.js';
import {runOptimization} from './assets/js/phase4/scenario-optimizer.js';
import {selectFinalScenario} from './assets/js/phase5/final-scenario-selector.js';
import {runStressTests} from './assets/js/phase5/stress-test-engine.js';
import {calculateRobustness} from './assets/js/phase5/robustness-scorer.js';
import {buildRecommendation} from './assets/js/phase5/recommendation-engine.js';
import {buildAuditTrail,validateAuditTrail} from './assets/js/phase5/audit-trail-engine.js';
import {buildWorkbookParitySummary} from './assets/js/phase5/workbook-parity.js';
import {buildExecutiveReportHtml} from './assets/js/phase5/executive-report-builder.js';
import {buildExportPackage} from './assets/js/phase5/export-center.js';
for (const companyId of ['empresa1','empresa2']) {
 const bundle=decryptJson(`data/${companyId}/phase2/phase2_bundle.json`);
 const objective=buildObjective({companyId,objectiveName:'Teste',weights:{total_cost:30,service_quality:25,operational_risk:20,tax_impact:15,inventory_efficiency:10}});
 const opt=runOptimization({companyId,baselineBundle:bundle,objective,constraints:{min_active_cds:1,max_active_cds:999,max_cd_volume_share:1,max_risk_level:'high',allow_tax_disabled:true},optimizerConfig:{method:'exact_discrete',max_candidates:5000,seed:11}});
 const selected=selectFinalScenario({companyId,optimizerResult:opt,selectionMode:'best_by_score'}).selected_scenario;
 const stress=runStressTests({companyId,selectedScenario:selected.scenario,baselineBundle:bundle});
 const robustness=calculateRobustness({companyId,scenarioId:selected.scenario_id,stressResults:stress.stress_results,quality:selected.quality});
 const rec=buildRecommendation({companyId,selectedScenario:selected,comparison:{saving_pct:1,saving_abs:1},quality:selected.quality,robustness,objective});
 const audit=buildAuditTrail({companyId,selectedScenario:selected,baselineBundle:bundle,objective,recommendation:rec});
 const valid=validateAuditTrail(audit); if(!valid.valid) throw new Error(valid.errors.join(';'));
 const workbookParity=buildWorkbookParitySummary(bundle.base_fit);
 const html=buildExecutiveReportHtml({companyId,selectedScenario:selected,recommendation:rec,stress,robustness,audit,comparison:{saving_abs:1},workbookParity});
 if(!html.includes('Relatório executivo') || !html.includes(companyId)) throw new Error('bad report html');
 if(!html.includes('Paridade com workbook')) throw new Error('workbook parity missing');
 const pkg=buildExportPackage({companyId,decisionPackage:{company_id:companyId},stress,audit,recommendation:rec,selectedScenario:selected,robustness,comparison:{saving_abs:1},workbookParity});
 if(pkg.files.length<4) throw new Error('bad export count');
 JSON.parse(pkg.files.find(f=>f.filename.endsWith('.json')).content);
 if(!JSON.parse(pkg.files.find(f=>f.filename.endsWith('.json')).content).workbook_parity) throw new Error('workbook parity missing from json');
 if(!pkg.files.find(f=>f.filename.endsWith('stress_results.csv')).content.includes('case_id')) throw new Error('stress csv missing header');
 if(!pkg.files.find(f=>f.filename.endsWith('sensitivity_results.csv'))) throw new Error('sensitivity csv missing');
 if(!pkg.files.find(f=>f.filename.endsWith('.html')).content.includes('Relatório executivo')) throw new Error('html missing report');
}
console.log('PHASE5_NODE_AUDIT_EXPORT_OK');
'''
res=subprocess.run(['node','--input-type=module','-e',code],cwd=ROOT,text=True,capture_output=True,timeout=120)
assert res.returncode==0, res.stderr+res.stdout
print(res.stdout.strip())
print('PHASE5_AUDIT_EXPORT_OK')
