import fs from 'node:fs';
import crypto from 'node:crypto';
import { runScenario } from '../assets/js/phase3/scenario-simulator.js';
import { runMonteCarloSimulation } from '../assets/js/phase3/monte-carlo-engine.js';
import { buildBaselineScenario } from '../assets/js/phase4/optimizer-utils.js';
import { runOptimization } from '../assets/js/phase4/scenario-optimizer.js';
import { buildObjective } from '../assets/js/phase4/objective-builder.js';
import { buildBundleReconciliation } from '../assets/js/core/reconciliation-engine.js';
import { MODEL_DEFAULTS, calculateInventoryCost } from '../assets/js/core/model-configuration.js';
import { loadRuntimeBundle } from '../tests/runtime_bundle_support.mjs';

function readPassword() {
  if (process.env.VISAGIO_DATA_PASSWORD) return process.env.VISAGIO_DATA_PASSWORD;
  const env = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/);
  for (const line of env) if (line.startsWith('VISAGIO_DATA_PASSWORD=')) return line.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  throw new Error('VISAGIO_DATA_PASSWORD missing');
}
function decryptJson(relPath) {
  const manifest = JSON.parse(fs.readFileSync('data/encrypted_manifest.json', 'utf8'));
  const entry = manifest.entries.find((item) => item.original_path === relPath);
  if (!entry) throw new Error(`missing encrypted entry ${relPath}`);
  const envelope = JSON.parse(fs.readFileSync(entry.encrypted_path, 'utf8'));
  const key = crypto.pbkdf2Sync(readPassword(), Buffer.from(envelope.salt, 'base64'), Number(envelope.iterations), 32, 'sha256');
  const payload = Buffer.from(envelope.ciphertext, 'base64');
  const tag = payload.subarray(payload.length - 16);
  const ciphertext = payload.subarray(0, payload.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(Buffer.from(relPath, 'utf8'));
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
}
const n = (v) => Number.isFinite(Number(v)) ? Number(v) : null;
const pickResult = (r) => ({
  scenario_id: r.scenario_id, scenario_name: r.scenario?.scenario_name || r.scenario_name,
  company_id: r.company_id, active_cds: r.scenario?.changes?.active_cds || r.active_cds || [],
  active_cds_count: (r.scenario?.changes?.active_cds || r.active_cds || []).length,
  freight_multiplier: n(r.scenario?.changes?.freight_multiplier ?? r.changes?.freight_multiplier ?? 1),
  demand_multiplier: n(r.scenario?.changes?.demand_multiplier ?? r.changes?.demand_multiplier ?? 1),
  inventory_days: n(r.scenario?.changes?.inventory_days ?? r.changes?.inventory_days ?? 45),
  wacc: n(r.scenario?.changes?.wacc ?? r.changes?.wacc ?? 0.15),
  tax_mode: r.scenario?.changes?.tax_mode ?? r.changes?.tax_mode ?? 'current',
  costs: r.costs || {}, total_with_tax: n(r.total_with_tax), saving_pct: n(r.saving_pct),
  quality: r.quality || null, diagnostics: r.diagnostics || r.costs?.diagnostics || null,
});
function makeScenario(companyId, bundle, overrides = {}) {
  const base = buildBaselineScenario(companyId, bundle);
  return { ...base, scenario_id: `${companyId}_evidence_${overrides.label || 'scenario'}`, scenario_name: overrides.label || 'evidence scenario', changes: { ...base.changes, ...overrides } };
}
const output = { generated_at: new Date().toISOString(), model_defaults: MODEL_DEFAULTS, companies: {}, methodology: {
  package_purpose: 'Evidence package for updating the academic report and work plan review.',
  protected_data_policy: 'Aggregated outputs only; encrypted source data and password are not exported.',
}};
for (const companyId of ['empresa1', 'empresa2']) {
  const bundle = loadRuntimeBundle({ companyId, decryptJson });
  const baseScenario = buildBaselineScenario(companyId, bundle);
  const baseline = runScenario({ companyId, scenario: baseScenario, baselineBundle: bundle });
  const sampleScenarios = decryptJson(`data/${companyId}/phase3/sample_scenarios.json`);
  const sampleList = Array.isArray(sampleScenarios) ? sampleScenarios : (sampleScenarios.scenarios || sampleScenarios.sample_scenarios || []);
  const published_scenarios = sampleList.map((scenario) => pickResult(runScenario({ companyId, scenario, baselineBundle: bundle })));
  const reconciliation = buildBundleReconciliation(bundle);
  const sameDrivers1 = makeScenario(companyId, bundle, { label: 'inventory_test_1_cd', active_cds: [bundle.model.active_cds[0]] });
  const sameDriversN = makeScenario(companyId, bundle, { label: 'inventory_test_all_cds', active_cds: bundle.model.active_cds });
  const inventory1 = runScenario({ companyId, scenario: sameDrivers1, baselineBundle: bundle });
  const inventoryN = runScenario({ companyId, scenario: sameDriversN, baselineBundle: bundle });
  const mcScenario = makeScenario(companyId, bundle, { label: 'monte_carlo_evidence' });
  const mcDet = runScenario({ companyId, scenario: mcScenario, baselineBundle: bundle });
  const mc = runMonteCarloSimulation({ companyId, selectedScenario: mcScenario, baselineBundle: bundle, deterministicResult: mcDet, iterations: 300, seed: 42, config: { profile: 'balanced', scatter_driver: 'freight_multiplier' } });
  const profiles = {
    custo: { total_cost: 0.60, service_quality: 0.05, operational_risk: 0.10, tax_impact: 0.15, inventory_efficiency: 0.10 },
    equilibrado: { total_cost: 0.30, service_quality: 0.20, operational_risk: 0.20, tax_impact: 0.15, inventory_efficiency: 0.15 },
    servico: { total_cost: 0.15, service_quality: 0.45, operational_risk: 0.20, tax_impact: 0.10, inventory_efficiency: 0.10 },
    tributo: { total_cost: 0.20, service_quality: 0.10, operational_risk: 0.10, tax_impact: 0.50, inventory_efficiency: 0.10 },
  };
  const optimization = {};
  for (const [name, weights] of Object.entries(profiles)) {
    const objective = buildObjective({ companyId, objectiveName: name, weights });
    const opt = runOptimization({ companyId, baselineBundle: bundle, objective, constraints: { min_active_cds: 1, max_active_cds: 999, max_cd_volume_share: 1, max_risk_level: 'high', allow_tax_disabled: true }, optimizerConfig: { method: 'exact_discrete', max_candidates: 5000, seed: 42 }});
    optimization[name] = { optimizer_status: opt.optimizer_status, decision_use: opt.decision_use, result_scope: opt.result_scope, search_log: opt.search_log, best: opt.best_scenarios?.slice(0, 3).map((x) => ({ scenario_id: x.scenario_id, scenario_name: x.scenario?.scenario_name, active_cds: x.scenario?.changes?.active_cds, score: x.score, total_with_tax: x.result?.total_with_tax, saving_pct: x.result?.saving_pct, risk_level: x.quality?.risk_level })) };
  }
  output.companies[companyId] = {
    source_counts: { flows: bundle.flows?.length || 0, active_cds: bundle.model?.active_cds?.length || 0, core_data_keys: Object.keys(bundle.core_data || {}) },
    baseline: pickResult(baseline),
    published_scenarios,
    reconciliation,
    inventory_independence_test: { one_cd: pickResult(inventory1), all_cds: pickResult(inventoryN), equal_inventory_cost: Math.abs(n(inventory1.costs?.inventory_cost) - n(inventoryN.costs?.inventory_cost)) < 1e-8, direct_formula_check: calculateInventoryCost({ baseInventoryCost: baseline.costs?.inventory_cost, demandMultiplier: 1, inventoryDays: 45, wacc: 0.15 }) },
    monte_carlo: { iterations: mc.iterations, seed: mc.seed, profile: mc.config?.profile, scatter_driver: mc.config?.scatter_driver, summary: mc.summary, provenance: mc.provenance, data_quality: mc.data_quality },
    optimization,
  };
}
fs.mkdirSync('entregaveis', { recursive: true });
fs.writeFileSync('entregaveis/evidence.json', JSON.stringify(output, null, 2));
console.log(JSON.stringify({ companies: Object.fromEntries(Object.entries(output.companies).map(([k,v]) => [k, { baseline_total: v.baseline.total_with_tax, reconciliation: v.reconciliation, inventory_equal: v.inventory_independence_test.equal_inventory_cost, mc_iterations: v.monte_carlo.iterations, optimizer_best: Object.fromEntries(Object.entries(v.optimization).map(([p,x]) => [p, x.best?.[0]?.scenario_id || null])) }])) }, null, 2));
