from pathlib import Path
import subprocess, textwrap
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tests.crypto_helpers import NODE_DECRYPT_HELPER
ROOT=Path(__file__).resolve().parents[2]
code = NODE_DECRYPT_HELPER + r'''
import fs from 'fs';
import {buildScenarioFromForm} from './assets/js/phase3/scenario-builder.js';
import {validateScenario} from './assets/js/phase3/scenario-validator.js';
import {rebuildScenarioFlows} from './assets/js/phase3/scenario-flow-rebuilder.js';
import {runScenario} from './assets/js/phase3/scenario-simulator.js';
import {compareScenarios} from './assets/js/phase3/scenario-comparator.js';
import {evaluateScenarioQuality} from './assets/js/phase3/scenario-quality-check.js';
import {resolveTaxRegime} from './assets/js/shared/tax-reform-config.js';
import {getRegimeTaxRates} from './assets/js/shared/tax/tax-reform-parameters.js';
const testRates2026 = getRegimeTaxRates('reform_2026');
if (testRates2026.cbs !== 0.009 || testRates2026.ibs !== 0.001) throw new Error('reform_2026 rates mismatch');
const cbsRates2028 = getRegimeTaxRates('reform_2027_2028');
if (cbsRates2028.cbs !== 0.088 || cbsRates2028.ibs !== 0) throw new Error('reform_2027_2028 rates mismatch');
for (const companyId of ['empresa1','empresa2']) {
  const bundle = decryptJson(`data/${companyId}/phase2/phase2_bundle.json`);
  const cds = bundle.model.active_cds;
  const active = cds.slice(0, Math.max(1, cds.length - 1));
  const scenario = buildScenarioFromForm({companyId, baselineBundle: bundle, formValues: {scenario_name:'Teste lógica', active_cds: active, freight_multiplier:1.1, demand_multiplier:1, inventory_days:35, wacc:0.15, tax_mode:'disabled'}});
  if (scenario.company_id !== companyId) throw new Error('company_id mismatch');
  if (!scenario.changes.closed_cds.length && cds.length > 1) throw new Error('closed_cds not detected');
  const validation = validateScenario({companyId, scenario, baselineBundle: bundle});
  if (!validation.valid) throw new Error('valid scenario rejected');
  const bad = buildScenarioFromForm({companyId, baselineBundle: bundle, formValues: {scenario_name:'bad', active_cds:[], freight_multiplier:-1, demand_multiplier:1, inventory_days:45, wacc:0.15, tax_mode:'current'}});
  const badValidation = validateScenario({companyId, scenario: bad, baselineBundle: bundle});
  if (badValidation.valid) throw new Error('invalid scenario accepted');
  const rebuilt = rebuildScenarioFlows({scenario, baselineFlows: bundle.flows});
  if (rebuilt.flows.length !== bundle.flows.length) throw new Error('flow count not preserved');
  if ((rebuilt.flow_summary.uncovered_flows || 0) !== 0) throw new Error('unexpected uncovered flows');
  const result = runScenario({companyId, scenario, baselineBundle: bundle});
  if (result.simulation_status !== 'success') throw new Error('scenario did not run');
  if (result.costs.tax_impact !== 0) throw new Error('tax disabled did not zero tax impact');
  if (result.tax_results.tax_regime !== 'disabled') throw new Error('disabled regime not preserved');
  const reformScenario = buildScenarioFromForm({companyId, baselineBundle: bundle, formValues: {scenario_name:'reforma', active_cds: active, freight_multiplier:1, demand_multiplier:1, inventory_days:45, wacc:0.15, tax_mode:'reform_2028'}});
  const reformValidation = validateScenario({companyId, scenario: reformScenario, baselineBundle: bundle});
  if (!reformValidation.valid) throw new Error('reform scenario rejected');
  if (reformScenario.changes.tax_regime !== 'reform_2027_2028') throw new Error('canonical tax regime not resolved');
  const reformResult = runScenario({companyId, scenario: reformScenario, baselineBundle: bundle});
  if (reformResult.simulation_status !== 'success') throw new Error('reform scenario did not run');
  if (reformResult.tax_results.tax_regime !== 'reform_2027_2028') throw new Error('reform regime not preserved');
  if (!reformResult.tax_results.calculation_mode) throw new Error('reform calculation mode missing');
  if (resolveTaxRegime({taxMode:'reform_2028'}) !== 'reform_2027_2028') throw new Error('reform 2028 alias not resolved');
  const comp = compareScenarios({companyId, baselineBundle: bundle, scenarioResults:[result]});
  const base = comp.comparison.find(r => r.scenario_id === bundle.model.scenario_id);
  if (Math.abs(base.saving_abs) > 0.01) throw new Error('baseline saving not zero');
  const quality = evaluateScenarioQuality({scenarioResult:result, baselineBundle:bundle});
  if (quality.quality_score < 0 || quality.quality_score > 100) throw new Error('quality out of range');
}
console.log('PHASE3_NODE_LOGIC_OK');
'''
res=subprocess.run(['node','--input-type=module','-e',code],cwd=ROOT,text=True,capture_output=True)
assert res.returncode==0, res.stderr + res.stdout
print(res.stdout.strip())
print('PHASE3_LOGIC_OK')
