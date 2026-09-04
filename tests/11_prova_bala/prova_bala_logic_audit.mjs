import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildScenarioFromForm } from '../../assets/js/phase3/scenario-builder.js';
import { validateScenario } from '../../assets/js/phase3/scenario-validator.js';
import { runScenario } from '../../assets/js/phase3/scenario-simulator.js';
import { runMonteCarloSimulation } from '../../assets/js/phase3/monte-carlo-engine.js';
import {
  exportScenarioJson,
  parseImportedScenario,
  validateImportedScenario,
} from '../../assets/js/phase3/scenario-import-export.js';
import { buildObjective } from '../../assets/js/phase4/objective-builder.js';
import { validateObjective } from '../../assets/js/phase4/objective-validator.js';
import { validateConstraintConfig } from '../../assets/js/phase4/constraint-engine.js';
import { runOptimization } from '../../assets/js/phase4/scenario-optimizer.js';
import { normalizeMetrics } from '../../assets/js/phase4/metric-normalizer.js';
import { scoreScenarios } from '../../assets/js/phase4/scenario-scoring.js';
import {
  compareExactRanking,
  buildBaselineScenario,
} from '../../assets/js/phase4/optimizer-utils.js';
import { selectFinalScenario } from '../../assets/js/phase5/final-scenario-selector.js';
import { buildStressCaseLibrary } from '../../assets/js/phase5/stress-case-library.js';
import {
  applyStressCaseToScenario,
  runStressTests,
} from '../../assets/js/phase5/stress-test-engine.js';
import { runSensitivity, runSensitivityMatrix } from '../../assets/js/phase5/sensitivity-engine.js';
import { buildRecommendation } from '../../assets/js/phase5/recommendation-engine.js';
import { calculateRobustness } from '../../assets/js/phase5/robustness-scorer.js';
import { buildAuditTrail, validateAuditTrail } from '../../assets/js/phase5/audit-trail-engine.js';
import { buildExportPackage } from '../../assets/js/phase5/export-center.js';
import { runFinalQAChecks } from '../../assets/js/phase5/final-qa-checker.js';
import { MODEL_ASSUMPTIONS } from '../../assets/js/shared/model-assumptions.js';
import { recomputePhase2Baseline } from '../../assets/js/shared/phase2-baseline-deriver.js';
import { buildBundleReconciliation } from '../../assets/js/shared/reconciliation-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'data', 'validation', 'prova_bala_evidence');

function readPassword() {
  if (process.env.VISAGIO_DATA_PASSWORD) return process.env.VISAGIO_DATA_PASSWORD;
  const envPath = path.join(ROOT, '.env.local');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      if (line.startsWith('VISAGIO_DATA_PASSWORD=')) {
        return line
          .split('=')
          .slice(1)
          .join('=')
          .trim()
          .replace(/^['"]|['"]$/g, '');
      }
    }
  }
  throw new Error('VISAGIO_DATA_PASSWORD missing');
}

function decryptJson(relPath) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'encrypted_manifest.json'), 'utf8')
  );
  const entry = manifest.entries.find((item) => item.original_path === relPath);
  if (!entry) throw new Error(`missing encrypted entry ${relPath}`);
  const envelope = JSON.parse(fs.readFileSync(path.join(ROOT, entry.encrypted_path), 'utf8'));
  const key = crypto.pbkdf2Sync(
    readPassword(),
    Buffer.from(envelope.salt, 'base64'),
    Number(envelope.iterations),
    32,
    'sha256'
  );
  const payload = Buffer.from(envelope.ciphertext, 'base64');
  const tag = payload.subarray(payload.length - 16);
  const ciphertext = payload.subarray(0, payload.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(Buffer.from(relPath, 'utf8'));
  decipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  );
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
}

function loadRuntimeBundle(companyId) {
  const bundle = decryptJson(`data/${companyId}/phase2/phase2_bundle.json`);
  bundle.core_data = bundle.core_data || {};
  if (companyId === 'empresa1') {
    bundle.core_data.distance_matrix = decryptJson('data/empresa1/core/distance_matrix.json');
    bundle.core_data.aux_custo_transferencia = decryptJson(
      'data/empresa2/core/aux_custo_transferencia.json'
    );
    bundle.core_data.tax_data = readJson(
      'data/complements/shared/tax_reference/icms_interstate_matrix.json'
    );
  } else {
    bundle.core_data.lat_long = decryptJson('data/empresa2/core/lat_long.json');
    bundle.core_data.rotas_mapa = decryptJson('data/empresa2/core/rotas_mapa.json');
    bundle.core_data.tax_data = decryptJson('data/empresa2/core/dados_tributario.json');
    bundle.core_data.tabelas_cif_dist = decryptJson('data/empresa2/core/tabelas_cif_dist.json');
    bundle.core_data.aux_custo_transferencia = decryptJson(
      'data/empresa2/core/aux_custo_transferencia.json'
    );
    bundle.core_data.aux_custo_armazenagem = decryptJson(
      'data/empresa2/core/aux_custo_armazenagem.json'
    );
  }
  return recomputePhase2Baseline(bundle, companyId);
}

function ensure(condition, message, details = null) {
  if (condition) return;
  const suffix = details ? ` :: ${JSON.stringify(details)}` : '';
  throw new Error(`${message}${suffix}`);
}

function finiteNumber(value, label) {
  ensure(Number.isFinite(Number(value)), `${label} precisa ser numérico`, { value });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueSets(sets) {
  const seen = new Set();
  const out = [];
  for (const set of sets) {
    const key = JSON.stringify([...new Set((set || []).filter(Boolean))]);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([...new Set((set || []).filter(Boolean))]);
  }
  return out;
}

function makeScenario({ companyId, baselineBundle, overrides = {} }) {
  const base = baselineBundle?.model || {};
  const activeCds = overrides.active_cds || base.active_cds || [];
  const scenario = buildScenarioFromForm({
    companyId,
    baselineBundle,
    scenarioId: overrides.scenario_id || null,
    formValues: {
      scenario_name: overrides.scenario_name || 'Auditoria adversarial',
      active_cds: activeCds,
      freight_multiplier: overrides.freight_multiplier ?? 1,
      demand_multiplier: overrides.demand_multiplier ?? 1,
      inventory_days: overrides.inventory_days ?? 45,
      wacc: overrides.wacc ?? 0.15,
      tax_mode: overrides.tax_mode ?? 'current',
      tax_regime: overrides.tax_regime,
      tax_year: overrides.tax_year,
      reallocation_rule: overrides.reallocation_rule || 'nearest_available_cd',
      scenario_type: overrides.scenario_type || 'adversarial',
    },
  });
  if (overrides.mutate) return overrides.mutate(scenario);
  return scenario;
}

function validateAndRunScenario({ companyId, baselineBundle, scenario, expectValid = true }) {
  const validation = validateScenario({ companyId, scenario, baselineBundle });
  const run = runScenario({ companyId, scenario, baselineBundle });
  if (expectValid) {
    ensure(validation.valid, 'scenario deveria ser válido', {
      companyId,
      scenario_id: scenario?.scenario_id,
      errors: validation.errors?.map((e) => e.message || e),
    });
    ensure(run.simulation_status === 'success', 'scenario válido deveria simular com sucesso', {
      companyId,
      scenario_id: scenario?.scenario_id,
      simulation_status: run.simulation_status,
      errors: run.errors,
    });
    finiteNumber(run.total_with_tax, 'total_with_tax');
    finiteNumber(run.costs?.total_logistics_cost, 'total_logistics_cost');
    finiteNumber(run.costs?.tax_impact, 'tax_impact');
    ensure(
      Math.abs(
        Number(run.costs.total_logistics_cost) +
          Number(run.costs.tax_impact) -
          Number(run.total_with_tax)
      ) < 0.1,
      'totais do cenário não fecham',
      {
        companyId,
        scenario_id: scenario?.scenario_id,
        total_logistics_cost: run.costs.total_logistics_cost,
        tax_impact: run.costs.tax_impact,
        total_with_tax: run.total_with_tax,
      }
    );
  } else {
    ensure(!validation.valid, 'scenario deveria ser inválido', {
      companyId,
      scenario_id: scenario?.scenario_id,
    });
    ensure(run.simulation_status === 'invalid', 'scenario inválido deveria bloquear simulação', {
      companyId,
      scenario_id: scenario?.scenario_id,
      simulation_status: run.simulation_status,
      errors: run.errors,
    });
  }
  return { validation, run };
}

function hasMessage(messages, pattern) {
  const text = messages
    .map((msg) => String(msg?.message || msg))
    .join(' | ')
    .toLowerCase();
  return text.includes(pattern.toLowerCase());
}

function assertInvalidCase({ validation, run, expectedPattern, companyId, scenarioId, caseName }) {
  ensure(!validation.valid, `${caseName}: caso deveria ser inválido`, { companyId, scenarioId });
  ensure(run.simulation_status === 'invalid', `${caseName}: simulação deveria bloquear`, {
    companyId,
    scenarioId,
    simulation_status: run.simulation_status,
  });
  ensure(
    hasMessage(validation.errors || [], expectedPattern),
    `${caseName}: erro esperado não encontrado`,
    { companyId, scenarioId, expectedPattern, errors: validation.errors }
  );
}

function monotonicNonDecreasing(values, label, meta) {
  for (let i = 1; i < values.length; i += 1) {
    ensure(values[i] >= values[i - 1] - 1e-6, `${label} não é monotônico`, {
      ...meta,
      values,
    });
  }
}

async function runPhaseCompanyAudit(companyId) {
  const baselineBundle = loadRuntimeBundle(companyId);
  const companyReport = {
    company_id: companyId,
    phase2: {},
    adversarial_validation: [],
    brute_force: {},
    phase3: {},
    phase4: {},
    phase5: {},
  };

  ensure(baselineBundle?.model?.company_id === companyId, 'bundle da empresa incorreto', {
    companyId,
    bundle_company_id: baselineBundle?.model?.company_id,
  });
  ensure(baselineBundle?.model?.baseline_ready === true, 'baseline deveria estar pronto', {
    companyId,
  });
  ensure(
    baselineBundle?.base_fit?.status === 'benchmark_pending',
    'Base Fit não deveria ser inventado',
    {
      companyId,
      base_fit: baselineBundle?.base_fit,
    }
  );
  ensure(
    baselineBundle?.base_fit?.base_fit_score === null ||
      baselineBundle?.base_fit?.base_fit_score === undefined,
    'Base Fit Score deveria continuar pendente',
    { companyId, base_fit: baselineBundle?.base_fit }
  );
  finiteNumber(baselineBundle?.costs?.costs?.total_logistics_cost, 'baseline total_logistics_cost');
  finiteNumber(baselineBundle?.costs?.costs?.total_with_tax, 'baseline total_with_tax');
  ensure(
    Math.abs(
      Number(baselineBundle.costs.costs.total_logistics_cost) +
        Number(baselineBundle.costs.costs.tax_impact) -
        Number(baselineBundle.costs.costs.total_with_tax)
    ) < 0.1,
    'baseline não fecha',
    {
      companyId,
      total_logistics_cost: baselineBundle.costs.costs.total_logistics_cost,
      tax_impact: baselineBundle.costs.costs.tax_impact,
      total_with_tax: baselineBundle.costs.costs.total_with_tax,
    }
  );

  const baselineScenario = buildBaselineScenario(companyId, baselineBundle);
  const baselineValidation = validateScenario({
    companyId,
    scenario: baselineScenario,
    baselineBundle,
  });
  const baselineRun = runScenario({ companyId, scenario: baselineScenario, baselineBundle });
  ensure(baselineValidation.valid, 'baseline deveria ser válido', {
    companyId,
    errors: baselineValidation.errors,
  });
  ensure(baselineRun.simulation_status === 'success', 'baseline deveria simular com sucesso', {
    companyId,
    simulation_status: baselineRun.simulation_status,
    errors: baselineRun.errors,
  });
  ensure(
    Math.abs(
      Number(baselineRun.total_with_tax) - Number(baselineBundle.costs.costs.total_with_tax)
    ) < 0.1,
    'execução do baseline deve reproduzir o total apresentado pela aplicação',
    {
      companyId,
      runtime_bundle_total: baselineBundle.costs.costs.total_with_tax,
      baseline_run_total: baselineRun.total_with_tax,
      baseline_flow_summary: baselineRun.flow_summary,
      baseline_cd_normalization: baselineRun.flows.map((flow, index) => ({
        source_cd: baselineBundle.flows[index]?.cd,
        source_origin: baselineBundle.flows[index]?.origin,
        rebuilt_cd: flow.cd,
      })),
      runtime_bundle_components: baselineBundle.costs.costs,
      baseline_run_components: baselineRun.costs,
    }
  );

  companyReport.phase2 = {
    active_cds: baselineBundle.model.active_cds.length,
    flows: baselineBundle.flows.length,
    baseline_total_with_tax: baselineBundle.costs.costs.total_with_tax,
    baseline_total_logistics_cost: baselineBundle.costs.costs.total_logistics_cost,
    tax_impact: baselineBundle.costs.costs.tax_impact,
    base_fit_status: baselineBundle.base_fit.status,
    base_fit_score: baselineBundle.base_fit.base_fit_score,
    operational_reference_results: baselineBundle.costs?.reference_results || null,
    source_tax_reconciliation:
      baselineBundle.tax_results?.tax_reconciliation ||
      baselineBundle.tax_results?.tax_results?.tax_reconciliation ||
      null,
    reconciliation: buildBundleReconciliation(baselineBundle),
  };
  if (companyId === 'empresa2') {
    companyReport.phase2.workbook_scenario_totals = decryptJson(
      'data/empresa2/core/scenario_totals.json'
    );
  }

  const invalidCases = [
    {
      case_id: 'wrong_company',
      expected: 'empresa',
      scenario: clone({
        ...baselineScenario,
        company_id: companyId === 'empresa1' ? 'empresa2' : 'empresa1',
      }),
    },
    {
      case_id: 'empty_active_cds',
      expected: 'CD',
      scenario: makeScenario({
        companyId,
        baselineBundle,
        overrides: {
          active_cds: [],
          scenario_name: 'Active CDs vazios',
        },
      }),
    },
    {
      case_id: 'negative_freight',
      expected: 'frete',
      scenario: makeScenario({
        companyId,
        baselineBundle,
        overrides: {
          freight_multiplier: -1,
          scenario_name: 'Frete negativo',
        },
      }),
    },
    {
      case_id: 'invalid_tax_mode',
      expected: 'tribut',
      scenario: makeScenario({
        companyId,
        baselineBundle,
        overrides: {
          tax_mode: 'boom',
          tax_regime: 'boom',
          scenario_name: 'Tributário inválido',
        },
      }),
    },
    {
      case_id: 'invalid_tax_regime',
      expected: 'regime',
      scenario: makeScenario({
        companyId,
        baselineBundle,
        overrides: {
          tax_mode: 'current',
          scenario_name: 'Regime inválido',
          mutate: (scenario) => {
            scenario.changes.tax_regime = 'unknown_regime';
            return scenario;
          },
        },
      }),
    },
    {
      case_id: 'invalid_reallocation',
      expected: 'realoc',
      scenario: makeScenario({
        companyId,
        baselineBundle,
        overrides: {
          reallocation_rule: 'teleport',
          scenario_name: 'Realocação inválida',
        },
      }),
    },
    {
      case_id: 'missing_base_scenario',
      expected: 'baseline',
      scenario: (() => {
        const s = makeScenario({
          companyId,
          baselineBundle,
          overrides: {
            scenario_name: 'Sem base_scenario_id',
          },
        });
        delete s.base_scenario_id;
        return s;
      })(),
    },
  ];

  for (const testCase of invalidCases) {
    const validation = validateScenario({ companyId, scenario: testCase.scenario, baselineBundle });
    const run = runScenario({ companyId, scenario: testCase.scenario, baselineBundle });
    assertInvalidCase({
      validation,
      run,
      expectedPattern: testCase.expected,
      companyId,
      scenarioId: testCase.scenario.scenario_id,
      caseName: testCase.case_id,
    });
    companyReport.adversarial_validation.push({
      case_id: testCase.case_id,
      status: 'blocked',
      error_count: validation.errors.length,
      run_status: run.simulation_status,
    });
  }

  const activeCds = baselineBundle.model.active_cds || [];
  const activeSets = uniqueSets([activeCds, [activeCds[0]]]);
  const freightValues = [0.85, 1, 1.15];
  const demandValues = [0.9, 1, 1.1];
  const inventoryValues = [30, 45, 60];
  const waccValues = [0, 0.15, 0.3];
  const taxModes = ['current', 'disabled'];
  const bruteForceSamples = [];

  function sweep(variable, values, fixed) {
    const totals = [];
    for (const value of values) {
      const scenario = makeScenario({
        companyId,
        baselineBundle,
        overrides: {
          active_cds: fixed.active_cds,
          freight_multiplier: fixed.freight_multiplier,
          demand_multiplier: fixed.demand_multiplier,
          inventory_days: fixed.inventory_days,
          wacc: fixed.wacc,
          tax_mode: fixed.tax_mode,
          tax_regime: fixed.tax_regime,
          scenario_name: `${companyId} ${variable} ${value}`,
          [variable]: value,
        },
      });
      const validation = validateScenario({ companyId, scenario, baselineBundle });
      const run = runScenario({ companyId, scenario, baselineBundle });
      ensure(validation.valid, `sweep de ${variable} deveria gerar cenário válido`, {
        companyId,
        variable,
        value,
        errors: validation.errors,
      });
      ensure(run.simulation_status === 'success', `sweep de ${variable} deveria simular`, {
        companyId,
        variable,
        value,
        run_status: run.simulation_status,
        errors: run.errors,
      });
      finiteNumber(run.total_with_tax, `${variable} total_with_tax`);
      finiteNumber(run.costs?.total_logistics_cost, `${variable} total_logistics_cost`);
      ensure(
        Math.abs(
          Number(run.costs.total_logistics_cost) +
            Number(run.costs.tax_impact) -
            Number(run.total_with_tax)
        ) < 0.1,
        `sweep de ${variable} não fecha`,
        { companyId, variable, value, run }
      );
      totals.push(Number(run.total_with_tax));
      if (bruteForceSamples.length < 12) {
        bruteForceSamples.push({
          variable,
          value,
          scenario_id: scenario.scenario_id,
          total_with_tax: run.total_with_tax,
          total_logistics_cost: run.costs.total_logistics_cost,
          tax_impact: run.costs.tax_impact,
        });
      }
    }
    monotonicNonDecreasing(totals, `${variable} monotonic`, { companyId, fixed });
    return totals;
  }

  let freightChecks = 0;
  let demandChecks = 0;
  let inventoryChecks = 0;
  let waccChecks = 0;

  for (const activeSet of activeSets) {
    for (const demandMultiplier of [1]) {
      for (const inventoryDays of [30, 60]) {
        for (const wacc of [0, 0.3]) {
          for (const taxMode of taxModes) {
            sweep('freight_multiplier', freightValues, {
              active_cds: activeSet,
              freight_multiplier: 1,
              demand_multiplier: demandMultiplier,
              inventory_days: inventoryDays,
              wacc,
              tax_mode: taxMode,
              tax_regime: taxMode === 'disabled' ? 'disabled' : 'legacy_current',
            });
            freightChecks += 1;
          }
        }
      }
    }
  }

  for (const activeSet of activeSets) {
    for (const freightMultiplier of [1]) {
      for (const inventoryDays of [30, 60]) {
        for (const wacc of [0, 0.3]) {
          for (const taxMode of taxModes) {
            sweep('demand_multiplier', demandValues, {
              active_cds: activeSet,
              freight_multiplier: freightMultiplier,
              demand_multiplier: 1,
              inventory_days: inventoryDays,
              wacc,
              tax_mode: taxMode,
              tax_regime: taxMode === 'disabled' ? 'disabled' : 'legacy_current',
            });
            demandChecks += 1;
          }
        }
      }
    }
  }

  for (const activeSet of activeSets) {
    for (const freightMultiplier of [1]) {
      for (const demandMultiplier of [1]) {
        for (const wacc of [0, 0.3]) {
          for (const taxMode of taxModes) {
            sweep('inventory_days', inventoryValues, {
              active_cds: activeSet,
              freight_multiplier: freightMultiplier,
              demand_multiplier: demandMultiplier,
              inventory_days: 45,
              wacc,
              tax_mode: taxMode,
              tax_regime: taxMode === 'disabled' ? 'disabled' : 'legacy_current',
            });
            inventoryChecks += 1;
          }
        }
      }
    }
  }

  for (const activeSet of activeSets) {
    for (const freightMultiplier of [1]) {
      for (const demandMultiplier of [1]) {
        for (const inventoryDays of [45]) {
          for (const taxMode of taxModes) {
            sweep('wacc', waccValues, {
              active_cds: activeSet,
              freight_multiplier: freightMultiplier,
              demand_multiplier: demandMultiplier,
              inventory_days: inventoryDays,
              wacc: 0.15,
              tax_mode: taxMode,
              tax_regime: taxMode === 'disabled' ? 'disabled' : 'legacy_current',
            });
            waccChecks += 1;
          }
        }
      }
    }
  }

  const deterministicScenario = makeScenario({
    companyId,
    baselineBundle,
    overrides: {
      active_cds: activeCds.slice(0, 1),
      freight_multiplier: 1.1,
      demand_multiplier: 0.9,
      inventory_days: 60,
      wacc: 0.2,
      tax_mode: 'disabled',
      tax_regime: 'disabled',
      scenario_name: 'Determinismo',
    },
  });
  const firstDeterministic = runScenario({
    companyId,
    scenario: deterministicScenario,
    baselineBundle,
  });
  const secondDeterministic = runScenario({
    companyId,
    scenario: deterministicScenario,
    baselineBundle,
  });
  ensure(
    JSON.stringify({
      total_with_tax: firstDeterministic.total_with_tax,
      costs: firstDeterministic.costs,
      flows: firstDeterministic.flow_summary,
    }) ===
      JSON.stringify({
        total_with_tax: secondDeterministic.total_with_tax,
        costs: secondDeterministic.costs,
        flows: secondDeterministic.flow_summary,
      }),
    'runScenario deveria ser determinístico',
    { companyId, scenario_id: deterministicScenario.scenario_id }
  );

  companyReport.brute_force = {
    freight_monotonic_checks: freightChecks,
    demand_monotonic_checks: demandChecks,
    inventory_monotonic_checks: inventoryChecks,
    wacc_monotonic_checks: waccChecks,
    samples: bruteForceSamples,
    deterministic_repeat_ok: true,
  };

  const exportScenario = makeScenario({
    companyId,
    baselineBundle,
    overrides: {
      active_cds: activeCds.slice(0, 1),
      freight_multiplier: 1,
      demand_multiplier: 1,
      inventory_days: 45,
      wacc: 0.15,
      tax_mode: 'current',
      tax_regime: 'legacy_current',
      scenario_name: 'Roundtrip de exportação',
    },
  });
  const exportedScenario = exportScenarioJson(exportScenario);
  const parsedScenario = JSON.parse(exportedScenario.content);
  ensure(
    validateImportedScenario(companyId, parsedScenario).valid,
    'cenário exportado deveria validar na importação',
    { companyId, scenario_id: exportScenario.scenario_id }
  );
  const importedScenario = await parseImportedScenario({
    text: async () => exportedScenario.content,
  });
  ensure(
    JSON.stringify(importedScenario) === JSON.stringify(parsedScenario),
    'roundtrip de export/import deveria preservar conteúdo',
    { companyId, scenario_id: exportScenario.scenario_id }
  );
  let invalidJsonRejected = false;
  try {
    await parseImportedScenario({ text: async () => '{broken' });
  } catch (error) {
    invalidJsonRejected = String(error.message || error).includes('JSON inválido');
  }
  ensure(invalidJsonRejected, 'JSON corrompido deveria ser rejeitado', { companyId });
  ensure(
    !validateImportedScenario(companyId === 'empresa1' ? 'empresa2' : 'empresa1', parsedScenario)
      .valid,
    'cenário importado deveria rejeitar empresa errada',
    { companyId }
  );
  const baselineTotalForSamples = Number(baselineBundle.costs.costs.total_with_tax);
  const sampleResults = decryptJson(`data/${companyId}/phase3/sample_scenarios.json`).map(
    (sampleScenario) => {
      const sampleRun = runScenario({ companyId, scenario: sampleScenario, baselineBundle });
      ensure(sampleRun.simulation_status === 'success', 'cenário amostral deveria simular', {
        companyId,
        scenario_id: sampleScenario.scenario_id,
        errors: sampleRun.errors,
      });
      const total = Number(sampleRun.total_with_tax);
      return {
        scenario_id: sampleScenario.scenario_id,
        scenario_name: sampleScenario.scenario_name,
        active_cds_count: sampleScenario.changes?.active_cds?.length ?? null,
        changes: sampleScenario.changes,
        total_with_tax: total,
        saving_abs: baselineTotalForSamples - total,
        saving_pct: baselineTotalForSamples
          ? ((baselineTotalForSamples - total) / baselineTotalForSamples) * 100
          : null,
        cost_components: {
          transfer_cost: sampleRun.costs?.transfer_cost ?? null,
          distribution_cost: sampleRun.costs?.distribution_cost ?? null,
          storage_cost: sampleRun.costs?.storage_cost ?? null,
          inventory_cost: sampleRun.costs?.inventory_cost ?? null,
          tax_impact: sampleRun.costs?.tax_impact ?? null,
          total_logistics_cost: sampleRun.costs?.total_logistics_cost ?? null,
          total_with_tax: sampleRun.costs?.total_with_tax ?? null,
        },
        inventory_calculation_mode: sampleRun.costs?.inventory_calculation_mode ?? null,
        fallback_usage: sampleRun.costs?.fallback_usage ?? null,
        warnings: sampleRun.warnings,
      };
    }
  );
  companyReport.phase3 = {
    export_roundtrip_ok: true,
    invalid_json_rejected: true,
    foreign_company_rejected: true,
    scenario_id: exportScenario.scenario_id,
    sample_results: sampleResults,
  };

  const validProfiles = [
    {
      name: 'balanced',
      weights: {
        total_cost: 30,
        service_quality: 25,
        operational_risk: 20,
        tax_impact: 15,
        inventory_efficiency: 10,
      },
    },
    {
      name: 'cost_heavy',
      weights: {
        total_cost: 80,
        service_quality: 5,
        operational_risk: 5,
        tax_impact: 5,
        inventory_efficiency: 5,
      },
    },
    {
      name: 'service_heavy',
      weights: {
        total_cost: 10,
        service_quality: 60,
        operational_risk: 10,
        tax_impact: 10,
        inventory_efficiency: 10,
      },
    },
    {
      name: 'risk_heavy',
      weights: {
        total_cost: 20,
        service_quality: 10,
        operational_risk: 50,
        tax_impact: 10,
        inventory_efficiency: 10,
      },
    },
  ];
  for (const profile of validProfiles) {
    const objective = buildObjective({
      companyId,
      objectiveName: profile.name,
      weights: profile.weights,
    });
    const validation = validateObjective(objective);
    ensure(validation.valid, `objective profile válido deveria passar (${profile.name})`, {
      companyId,
      profile: profile.name,
      errors: validation.errors,
    });
  }
  const invalidObjectives = [
    {
      name: 'negative_weight',
      objective: buildObjective({
        companyId,
        objectiveName: 'negative_weight',
        weights: {
          total_cost: -1,
          service_quality: 25,
          operational_risk: 25,
          tax_impact: 25,
          inventory_efficiency: 26,
        },
      }),
      expected: 'negativo',
    },
    {
      name: 'unknown_metric',
      objective: buildObjective({
        companyId,
        objectiveName: 'unknown_metric',
        weights: { total_cost: 30, mystery: 70 },
      }),
      expected: 'desconhecid',
    },
    {
      name: 'all_zero',
      objective: buildObjective({
        companyId,
        objectiveName: 'all_zero',
        weights: {
          total_cost: 0,
          service_quality: 0,
          operational_risk: 0,
          tax_impact: 0,
          inventory_efficiency: 0,
        },
      }),
      expected: 'zerados',
    },
  ];
  for (const item of invalidObjectives) {
    const validation = validateObjective(item.objective);
    ensure(!validation.valid, `objective inválido deveria falhar (${item.name})`, {
      companyId,
      objective: item.objective,
      errors: validation.errors,
    });
    ensure(
      String(validation.errors.join(' ')).toLowerCase().includes(item.expected),
      `erro esperado de objective não encontrado (${item.name})`,
      { companyId, errors: validation.errors }
    );
  }
  const selectedObjective = buildObjective({
    companyId,
    objectiveName: 'prova_bala',
    weights: {
      total_cost: 30,
      service_quality: 25,
      operational_risk: 20,
      tax_impact: 15,
      inventory_efficiency: 10,
    },
  });
  const constraintValidation = validateConstraintConfig({
    min_active_cds: 1,
    max_active_cds: 999,
    max_cd_volume_share: 1,
    max_risk_level: 'high',
    allow_tax_disabled: true,
  });
  ensure(
    constraintValidation.valid,
    'constraint config válida deveria passar',
    constraintValidation
  );
  const invalidConstraintValidation = validateConstraintConfig({
    min_active_cds: 3,
    max_active_cds: 1,
    max_cd_volume_share: 0,
  });
  ensure(
    !invalidConstraintValidation.valid,
    'constraint config inválida deveria falhar',
    invalidConstraintValidation
  );

  const optimization1 = runOptimization({
    companyId,
    baselineBundle,
    objective: selectedObjective,
    constraints: {
      min_active_cds: 1,
      max_active_cds: 999,
      max_cd_volume_share: 1,
      max_risk_level: 'high',
      allow_tax_disabled: true,
    },
    optimizerConfig: {
      method: 'exact_discrete',
      max_candidates: 5000,
      seed: 42,
      refinement_rounds: 0,
      refinement_seed_count: 1,
    },
  });
  const optimization2 = runOptimization({
    companyId,
    baselineBundle,
    objective: selectedObjective,
    constraints: {
      min_active_cds: 1,
      max_active_cds: 999,
      max_cd_volume_share: 1,
      max_risk_level: 'high',
      allow_tax_disabled: true,
    },
    optimizerConfig: {
      method: 'exact_discrete',
      max_candidates: 5000,
      seed: 42,
      refinement_rounds: 0,
      refinement_seed_count: 1,
    },
  });
  ensure(
    optimization1.optimizer_status === 'success' && optimization1.scored_scenarios.length > 0,
    'otimização válida deveria encontrar cenários',
    {
      companyId,
      optimizer_status: optimization1.optimizer_status,
      scored_scenarios: optimization1.scored_scenarios.length,
    }
  );
  ensure(
    optimization1.best_scenarios[0]?.scenario_id === optimization2.best_scenarios[0]?.scenario_id,
    'otimização deveria ser determinística com seed fixa',
    {
      companyId,
      best1: optimization1.best_scenarios[0]?.scenario_id,
      best2: optimization2.best_scenarios[0]?.scenario_id,
    }
  );
  const comparableBaseline = optimization1.baseline_reference?.result;
  ensure(
    comparableBaseline?.simulation_status === 'success' && comparableBaseline?.total_with_tax > 0,
    'otimizador deveria expor baseline comparável válido',
    { companyId, baseline_reference: optimization1.baseline_reference }
  );
  ensure(
    optimization1.baseline_reference?.comparison_basis === 'same_tax_regime',
    'base da otimização deveria usar o mesmo regime fiscal',
    { companyId, baseline_reference: optimization1.baseline_reference }
  );
  for (const record of optimization1.scenario_records) {
    ensure(
      record.result?.tax_results?.tax_regime === comparableBaseline.tax_results?.tax_regime,
      'candidato e baseline comparável devem usar o mesmo regime tributário',
      {
        companyId,
        scenario_id: record.result?.scenario_id,
        candidate_regime: record.result?.tax_results?.tax_regime,
        baseline_regime: comparableBaseline.tax_results?.tax_regime,
      }
    );
    const expectedSaving = comparableBaseline.total_with_tax - record.result.total_with_tax;
    ensure(
      Math.abs(expectedSaving - record.result.saving_abs) < 0.01,
      'saving do candidato deve usar o baseline comparável',
      {
        companyId,
        scenario_id: record.result?.scenario_id,
        expected_saving: expectedSaving,
        reported_saving: record.result?.saving_abs,
      }
    );
  }

  const profileLabels = {
    cost_minimum: 'custo mínimo',
    balanced: 'equilibrado',
    conservative: 'conservador',
    quality_service: 'qualidade/serviço',
  };
  const recordById = new Map(
    optimization1.scenario_records.map((record) => [record.result.scenario_id, record])
  );
  const profileStressCases = buildStressCaseLibrary({ companyId }).stress_cases;
  const objectiveProfileResults = [];
  for (const [profileId, weights] of Object.entries(MODEL_ASSUMPTIONS.scoring.objective_profiles)) {
    const profileObjective = buildObjective({
      companyId,
      objectiveName: profileLabels[profileId],
      weights,
    });
    const rescored = scoreScenarios({
      companyId,
      objective: profileObjective,
      normalizedMetrics: optimization1.normalized.normalized_metrics,
    });
    const winner = rescored.scored_scenarios
      .map((score) => {
        const record = recordById.get(score.scenario_id);
        return {
          ...score,
          scenario: record?.scenario,
          result: record?.result,
          quality: record?.quality,
        };
      })
      .sort(compareExactRanking)[0];
    ensure(winner?.result, `perfil ${profileId} não produziu vencedor auditável`, {
      companyId,
      profileId,
    });
    const profileStress = runStressTests({
      companyId,
      selectedScenario: winner.scenario,
      baselineBundle,
      baselineResult: comparableBaseline,
      stressCases: profileStressCases,
    });
    const profileRobustness = calculateRobustness({
      companyId,
      scenarioId: winner.scenario_id,
      stressResults: profileStress.stress_results,
      quality: winner.quality,
    });
    const baselineTotal = Number(comparableBaseline.total_with_tax);
    const total = Number(winner.result.total_with_tax);
    objectiveProfileResults.push({
      profile_id: profileId,
      profile: profileLabels[profileId],
      weights,
      winner_scenario_id: winner.scenario_id,
      winner_scenario_name: winner.scenario_name,
      final_score: winner.final_score,
      active_cds_count: winner.scenario?.changes?.active_cds?.length ?? null,
      active_cds: winner.scenario?.changes?.active_cds || [],
      closed_cds: winner.scenario?.changes?.closed_cds || [],
      total_with_tax: total,
      saving_abs: baselineTotal - total,
      saving_pct: baselineTotal ? ((baselineTotal - total) / baselineTotal) * 100 : null,
      max_cd_volume_share: winner.quality?.quality_metrics?.max_cd_volume_share ?? null,
      risk_level: winner.quality?.risk_level ?? null,
      robustness_score: profileRobustness.robustness_score,
      cost_components: {
        transfer_cost: winner.result.costs?.transfer_cost ?? null,
        distribution_cost: winner.result.costs?.distribution_cost ?? null,
        storage_cost: winner.result.costs?.storage_cost ?? null,
        inventory_cost: winner.result.costs?.inventory_cost ?? null,
        tax_impact: winner.result.costs?.tax_impact ?? null,
        total_logistics_cost: winner.result.costs?.total_logistics_cost ?? null,
        total_with_tax: winner.result.costs?.total_with_tax ?? null,
      },
      fallback_usage: winner.result.costs?.fallback_usage ?? null,
      transfer_proxy_sensitivity: winner.result.costs?.transfer_proxy_sensitivity ?? null,
      inventory_calculation_mode: winner.result.costs?.inventory_calculation_mode ?? null,
    });
  }
  const balancedWinnerId = objectiveProfileResults.find(
    (row) => row.profile_id === 'balanced'
  )?.winner_scenario_id;
  const balancedWinnerRecord = recordById.get(balancedWinnerId);
  const exploratoryMonteCarlo = runMonteCarloSimulation({
    companyId,
    selectedScenario: balancedWinnerRecord?.scenario,
    baselineBundle,
    baselineResult: comparableBaseline,
    deterministicResult: balancedWinnerRecord?.result,
    iterations: MODEL_ASSUMPTIONS.monte_carlo.default_iterations,
    seed: MODEL_ASSUMPTIONS.monte_carlo.default_seed,
    config: { profile: 'balanced' },
  });
  ensure(
    exploratoryMonteCarlo.monte_carlo_status === 'success',
    'Monte Carlo exploratório do vencedor equilibrado deveria executar',
    { companyId, errors: exploratoryMonteCarlo.errors }
  );

  const candidateMetrics = optimization1.metrics.scenario_metrics;
  const removableCandidate = [...candidateMetrics].sort(
    (a, b) => Number(b.total_cost) - Number(a.total_cost)
  )[0];
  const reducedCandidateMetrics = candidateMetrics.filter(
    (row) => row.scenario_id !== removableCandidate?.scenario_id
  );
  const balancedObjective = buildObjective({
    companyId,
    objectiveName: 'equilibrado — sensibilidade do conjunto',
    weights: MODEL_ASSUMPTIONS.scoring.objective_profiles.balanced,
  });
  const fullCandidateOnlyRanking = scoreScenarios({
    companyId,
    objective: balancedObjective,
    normalizedMetrics: normalizeMetrics({
      companyId,
      scenarioMetrics: candidateMetrics,
    }).normalized_metrics,
  });
  const reducedCandidateOnlyRanking = scoreScenarios({
    companyId,
    objective: balancedObjective,
    normalizedMetrics: normalizeMetrics({
      companyId,
      scenarioMetrics: reducedCandidateMetrics,
    }).normalized_metrics,
  });
  const invalidOptimization = runOptimization({
    companyId,
    baselineBundle,
    objective: selectedObjective,
    constraints: {
      min_active_cds: 3,
      max_active_cds: 1,
      max_cd_volume_share: 0,
      max_risk_level: 'low',
      allow_tax_disabled: false,
    },
    optimizerConfig: {
      method: 'exact_discrete',
      max_candidates: 5000,
      seed: 42,
      refinement_rounds: 0,
      refinement_seed_count: 1,
    },
  });
  ensure(
    invalidOptimization.optimizer_status === 'error',
    'otimização com constraints inválidas deveria bloquear',
    invalidOptimization
  );
  ensure(
    (invalidOptimization.errors || []).length > 0,
    'otimização bloqueada deveria reportar erro',
    invalidOptimization
  );

  const ranked = optimization1.scored_scenarios;
  const manualTarget = ranked[Math.min(11, ranked.length - 1)];
  const manualFull = selectFinalScenario({
    companyId,
    optimizerResult: optimization1,
    selectionMode: 'manual',
    manualScenarioId: manualTarget.scenario_id,
  });
  ensure(
    manualFull.selected_scenario_id === manualTarget.scenario_id,
    'seleção manual deveria localizar cenário na lista completa',
    manualFull
  );
  const limitedPool = selectFinalScenario({
    companyId,
    optimizerResult: { best_scenarios: optimization1.best_scenarios, scored_scenarios: [] },
    selectionMode: 'manual',
    manualScenarioId: manualTarget.scenario_id,
  });
  ensure(
    limitedPool.selected_scenario === null && (limitedPool.warnings || []).length > 0,
    'seleção manual limitada deveria bloquear e avisar',
    limitedPool
  );
  ensure(
    String((limitedPool.warnings || []).join(' '))
      .toLowerCase()
      .includes('top-10'),
    'aviso de top-10 deveria aparecer',
    limitedPool
  );

  ensure(
    compareExactRanking(
      {
        final_score: 90,
        result: { total_with_tax: 100 },
        quality: { risk_level: 'medium', quality_score: 80 },
        scenario_id: 'a',
      },
      {
        final_score: 90,
        result: { total_with_tax: 110 },
        quality: { risk_level: 'medium', quality_score: 80 },
        scenario_id: 'b',
      }
    ) < 0,
    'tie-break por custo deveria favorecer menor total'
  );
  ensure(
    compareExactRanking(
      {
        final_score: 90,
        result: { total_with_tax: 100 },
        quality: { risk_level: 'low', quality_score: 80 },
        scenario_id: 'a',
      },
      {
        final_score: 90,
        result: { total_with_tax: 100 },
        quality: { risk_level: 'high', quality_score: 80 },
        scenario_id: 'b',
      }
    ) < 0,
    'tie-break por risco deveria favorecer menor risco'
  );
  ensure(
    compareExactRanking(
      {
        final_score: 90,
        result: { total_with_tax: 100 },
        quality: { risk_level: 'medium', quality_score: 90 },
        scenario_id: 'a',
      },
      {
        final_score: 90,
        result: { total_with_tax: 100 },
        quality: { risk_level: 'medium', quality_score: 70 },
        scenario_id: 'b',
      }
    ) < 0,
    'tie-break por qualidade deveria favorecer maior quality_score'
  );
  ensure(
    compareExactRanking(
      {
        final_score: 90,
        result: { total_with_tax: 100 },
        quality: { risk_level: 'medium', quality_score: 80 },
        scenario_id: 'a',
      },
      {
        final_score: 90,
        result: { total_with_tax: 100 },
        quality: { risk_level: 'medium', quality_score: 80 },
        scenario_id: 'b',
      }
    ) < 0,
    'tie-break final deveria favorecer scenario_id lexicograficamente menor'
  );

  companyReport.phase4 = {
    objective_profiles_ok: true,
    invalid_objectives_ok: true,
    optimization_status: optimization1.optimizer_status,
    optimization_deterministic_ok: true,
    valid_optimization_best_id: optimization1.best_scenarios[0]?.scenario_id || null,
    comparison_baseline: {
      scenario_id: comparableBaseline.scenario_id,
      total_with_tax: comparableBaseline.total_with_tax,
      total_logistics_cost: comparableBaseline.costs?.total_logistics_cost,
      tax_impact: comparableBaseline.costs?.tax_impact,
      tax_mode: comparableBaseline.tax_results?.tax_mode,
      tax_regime: comparableBaseline.tax_results?.tax_regime,
      comparison_basis: optimization1.baseline_reference?.comparison_basis,
    },
    objective_profile_results: objectiveProfileResults,
    winner_changes_across_profiles:
      new Set(objectiveProfileResults.map((row) => row.winner_scenario_id)).size > 1,
    candidate_set_sensitivity: {
      normalization: 'min_max_by_candidate_set',
      removed_scenario_id: removableCandidate?.scenario_id || null,
      full_winner_scenario_id: fullCandidateOnlyRanking.scored_scenarios[0]?.scenario_id || null,
      reduced_winner_scenario_id:
        reducedCandidateOnlyRanking.scored_scenarios[0]?.scenario_id || null,
      winner_changed:
        fullCandidateOnlyRanking.scored_scenarios[0]?.scenario_id !==
        reducedCandidateOnlyRanking.scored_scenarios[0]?.scenario_id,
    },
    monte_carlo_exploratory: {
      config: exploratoryMonteCarlo.config,
      methodology: exploratoryMonteCarlo.methodology,
      summary: exploratoryMonteCarlo.summary,
      invalid_sample_count: exploratoryMonteCarlo.invalid_sample_count,
      warning: 'Camada exploratória; não fundamenta os totais determinísticos reportados.',
    },
    manual_selection_full_ok: true,
    manual_selection_limited_warned: true,
  };

  const selectedScenario = manualFull.selected_scenario;
  const selectedRawScenario = selectedScenario.scenario || selectedScenario;
  const quality = {
    risk_level: 'low',
    quality_score: 90,
    quality_metrics: {
      inventory_efficiency: 95,
      max_cd_volume_share: 0.3,
      reallocated_flow_share: 0.05,
      uncovered_flow_share: 0,
      cost_increase_pct: -0.02,
    },
    alerts: [],
  };
  const stressLibrary = buildStressCaseLibrary({ companyId });
  const conservativeStressLibrary = buildStressCaseLibrary({
    companyId,
    stressProfile: 'conservative',
  });
  ensure(
    stressLibrary.stress_cases.length >= 7,
    'stress library deveria ter casos suficientes',
    stressLibrary
  );
  ensure(
    conservativeStressLibrary.stress_cases.length > stressLibrary.stress_cases.length,
    'perfil conservador deveria adicionar casos',
    conservativeStressLibrary
  );
  const stressed = applyStressCaseToScenario({
    scenario: selectedRawScenario,
    stressCase:
      stressLibrary.stress_cases.find((item) => item.case_id === 'frete_mais_20') ||
      stressLibrary.stress_cases[0],
  });
  ensure(
    JSON.stringify(selectedRawScenario) ===
      JSON.stringify(selectedScenario.scenario || selectedRawScenario),
    'stress não deveria mutar cenário original',
    { companyId }
  );
  ensure(
    stressed.scenario_id !== selectedRawScenario.scenario_id,
    'stress deveria gerar cenário derivado',
    { companyId, original: selectedRawScenario.scenario_id, stressed: stressed.scenario_id }
  );
  const stress = runStressTests({
    companyId,
    selectedScenario: selectedRawScenario,
    baselineBundle,
    baselineResult: comparableBaseline,
    stressCases: stressLibrary.stress_cases,
  });
  ensure(
    stress.summary?.cases_run === stressLibrary.stress_cases.length,
    'stress test deveria rodar todos os casos',
    stress.summary
  );
  ensure(
    stress.stress_results.every(
      (result) => Array.isArray(result.warnings) && Array.isArray(result.errors)
    ),
    'stress results deveriam expor warnings/errors como arrays',
    stress.stress_results[0]
  );
  ensure(
    stress.stress_results.every(
      (result) =>
        Math.abs(
          result.saving_vs_baseline - (comparableBaseline.total_with_tax - result.total_with_tax)
        ) < 0.01
    ),
    'stress deveria calcular saving contra o baseline comparável',
    stress.stress_results
  );
  const stressQuality = calculateRobustness({
    companyId,
    scenarioId: selectedRawScenario.scenario_id,
    stressResults: stress.stress_results,
    quality,
  });
  ensure(
    Number.isFinite(Number(stressQuality.robustness_score)),
    'robustness score deveria ser numérico',
    stressQuality
  );
  const sensitivity = runSensitivity({
    companyId,
    selectedScenario: selectedRawScenario,
    baselineBundle,
    baselineResult: comparableBaseline,
    sensitivityConfig: { variable: 'freight_multiplier', values: [0.9, 1, 1.1] },
  });
  ensure(
    sensitivity.sensitivity_results.length === 3,
    'sensibilidade deveria testar 3 pontos',
    sensitivity
  );
  ensure(
    sensitivity.sensitivity_results.every((row) => Number.isFinite(Number(row.total_with_tax))),
    'sensibilidade deveria produzir totais finitos',
    sensitivity.sensitivity_results
  );
  const invalidSensitivity = runSensitivity({
    companyId,
    selectedScenario: selectedRawScenario,
    baselineBundle,
    sensitivityConfig: { variable: 'boom', values: [1] },
  });
  ensure(
    invalidSensitivity.errors.length > 0 && invalidSensitivity.sensitivity_results.length === 0,
    'sensibilidade inválida deveria bloquear',
    invalidSensitivity
  );
  const sensitivityMatrix = runSensitivityMatrix({
    companyId,
    selectedScenario: selectedRawScenario,
    baselineBundle,
    baselineResult: comparableBaseline,
    matrixConfig: {
      xVariable: 'freight_multiplier',
      yVariable: 'demand_multiplier',
      xValues: [0.9, 1.1],
      yValues: [0.9, 1.1],
    },
  });
  ensure(
    sensitivityMatrix.matrix_results.length === 4,
    'matriz de sensibilidade deveria gerar 4 células',
    sensitivityMatrix
  );
  const invalidMatrix = runSensitivityMatrix({
    companyId,
    selectedScenario: selectedRawScenario,
    baselineBundle,
    matrixConfig: {
      xVariable: 'freight_multiplier',
      yVariable: 'freight_multiplier',
      xValues: [1],
      yValues: [1],
    },
  });
  ensure(
    invalidMatrix.errors.length > 0,
    'matriz com variável duplicada deveria bloquear',
    invalidMatrix
  );

  const recommendationRecommended = buildRecommendation({
    companyId,
    selectedScenario: {
      scenario_id: selectedRawScenario.scenario_id,
      final_score: 92,
      quality: { risk_level: 'low' },
      monte_carlo: {
        summary: {
          probability_saving_positive: 0.9,
          p10_saving_pct: 3,
        },
      },
    },
    comparison: { saving_pct: 4 },
    quality: { risk_level: 'low' },
    robustness: { robustness_score: 88, alerts: [] },
    objective: selectedObjective,
  });
  const recommendationWarning = buildRecommendation({
    companyId,
    selectedScenario: {
      scenario_id: selectedRawScenario.scenario_id,
      final_score: 70,
      quality: { risk_level: 'medium' },
      monte_carlo: {
        summary: {
          probability_saving_positive: 0.55,
          p10_saving_pct: 0.5,
        },
      },
    },
    comparison: { saving_pct: 2 },
    quality: { risk_level: 'medium' },
    robustness: { robustness_score: 55, alerts: ['atenção operacional'] },
    objective: selectedObjective,
  });
  const recommendationRejected = buildRecommendation({
    companyId,
    selectedScenario: {
      scenario_id: selectedRawScenario.scenario_id,
      final_score: 20,
      quality: { risk_level: 'high' },
      monte_carlo: {
        summary: {
          probability_saving_positive: 0.1,
          p10_saving_pct: -5,
        },
      },
    },
    comparison: { saving_pct: -1 },
    quality: { risk_level: 'high' },
    robustness: { robustness_score: 20, alerts: ['custo acima do baseline'] },
    objective: selectedObjective,
  });
  ensure(
    recommendationRecommended.recommendation_status === 'recommended',
    'recomendação positiva deveria ser recomendada',
    recommendationRecommended
  );
  ensure(
    recommendationWarning.recommendation_status === 'recommended_with_warnings',
    'recomendação intermediária deveria sair com alertas',
    recommendationWarning
  );
  ensure(
    recommendationRejected.recommendation_status === 'not_recommended',
    'recomendação negativa deveria ser rejeitada',
    recommendationRejected
  );

  const audit = buildAuditTrail({
    companyId,
    selectedScenario: selectedScenario,
    baselineBundle,
    objective: selectedObjective,
    recommendation: recommendationRecommended,
    optimizerResult: optimization1,
  });
  const auditValidation = validateAuditTrail(audit);
  ensure(auditValidation.valid, 'audit trail deveria ser válido', auditValidation);
  ensure(
    audit.comparison_baseline?.total_with_tax === comparableBaseline.total_with_tax &&
      audit.comparison_baseline?.tax_regime === comparableBaseline.tax_results?.tax_regime,
    'audit trail deveria registrar total e regime do baseline comparável',
    audit.comparison_baseline
  );
  const auditInvalid = validateAuditTrail({ ...audit, data_sources: [] });
  ensure(!auditInvalid.valid, 'audit trail sem fontes deveria ser inválido', auditInvalid);

  const exportPackage = buildExportPackage({
    companyId,
    decisionPackage: {
      company_id: companyId,
      scenario_id: selectedRawScenario.scenario_id,
      validated: true,
    },
    stress,
    sensitivity,
    sensitivityMatrix,
    audit,
    recommendation: recommendationRecommended,
    selectedScenario: selectedScenario,
    comparison: { saving_pct: 4 },
    robustness: stressQuality,
    workbookParity: {
      status_label: 'ok',
      score: 100,
      summary: { compared_metrics: 1, mean_abs_error_pct: 0, max_abs_error_pct: 0 },
      reconciliation_label: 'conciliado',
      tax_status: 'ok',
      comparison_mode: 'base_fit',
      reference_source: 'mock',
      rows: [],
    },
  });
  ensure(
    exportPackage.export_status === 'ready',
    'export package deveria ficar pronto',
    exportPackage
  );
  ensure(
    exportPackage.files.length === 4,
    'export package deveria gerar 4 arquivos',
    exportPackage.files
  );
  ensure(
    exportPackage.files.every((file) => file.content && file.filename),
    'export files deveriam ter conteúdo',
    exportPackage.files
  );
  ensure(
    exportPackage.files.some((file) => file.filename.endsWith('.json')) &&
      exportPackage.files.some((file) => file.filename.endsWith('.csv')) &&
      exportPackage.files.some((file) => file.filename.endsWith('.html')),
    'export package deveria cobrir json/csv/html',
    exportPackage.files
  );

  const qaPass = runFinalQAChecks({
    companyId,
    bundle: baselineBundle,
    selectedScenario,
    stress,
    recommendation: recommendationRecommended,
    audit,
  });
  const qaFail = runFinalQAChecks({
    companyId,
    bundle: {},
    selectedScenario: null,
    stress: { stress_results: [] },
    recommendation: {},
    audit: {},
  });
  ensure(
    qaPass.final_qa_status === 'passed',
    'QA final deveria passar com dados completos',
    qaPass
  );
  ensure(
    qaFail.final_qa_status === 'failed',
    'QA final deveria falhar com dados incompletos',
    qaFail
  );

  companyReport.phase5 = {
    comparison_baseline_total_with_tax: comparableBaseline.total_with_tax,
    comparison_baseline_tax_regime: comparableBaseline.tax_results?.tax_regime,
    stress_case_count: stressLibrary.stress_cases.length,
    conservative_case_count: conservativeStressLibrary.stress_cases.length,
    robustness_score: stressQuality.robustness_score,
    recommendation_statuses: {
      recommended: recommendationRecommended.recommendation_status,
      warning: recommendationWarning.recommendation_status,
      rejected: recommendationRejected.recommendation_status,
    },
    audit_valid: auditValidation.valid,
    export_file_count: exportPackage.files.length,
    qa_pass: qaPass.final_qa_status,
    qa_fail: qaFail.final_qa_status,
  };

  return companyReport;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const companies = ['empresa1', 'empresa2'];
  const report = {
    generated_at: new Date().toISOString(),
    status: 'ok',
    command: 'python tests/run_all_tests.py',
    companies: [],
  };
  for (const companyId of companies) {
    report.companies.push(await runPhaseCompanyAudit(companyId));
  }
  report.summary = {
    companies_tested: report.companies.length,
    total_freight_monotonic_checks: report.companies.reduce(
      (acc, c) => acc + c.brute_force.freight_monotonic_checks,
      0
    ),
    total_demand_monotonic_checks: report.companies.reduce(
      (acc, c) => acc + c.brute_force.demand_monotonic_checks,
      0
    ),
    total_inventory_monotonic_checks: report.companies.reduce(
      (acc, c) => acc + c.brute_force.inventory_monotonic_checks,
      0
    ),
    total_wacc_monotonic_checks: report.companies.reduce(
      (acc, c) => acc + c.brute_force.wacc_monotonic_checks,
      0
    ),
  };
  fs.writeFileSync(
    path.join(OUT_DIR, 'logic_report.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );
  process.stdout.write(JSON.stringify(report));
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || String(error)}\n`);
  process.exit(1);
});
