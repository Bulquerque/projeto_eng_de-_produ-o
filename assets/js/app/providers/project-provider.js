import { loadPhase2Bundle } from '../../core/data-loader.js';
import { loadOptimizationConfig } from '../../core/optimization-config-store.js';
import { lockCryptoSession } from '../../core/crypto-session.js';
import { appendSharedDebugEntry } from '../../core/debug-tools.js';
import { buildCanonicalOptimizationConfig } from '../../core/optimization-policy.js';
import { buildWorkbookParitySummary } from '../../phase5/workbook-parity.js';
import { loadScenarioLibrary } from '../../phase3/scenario-library.js';
import { buildScenarioFromForm } from '../../phase3/scenario-builder.js';
import { runScenario as runDomainScenario } from '../../phase3/scenario-simulator.js';
import { evaluateScenarioQuality } from '../../phase3/scenario-quality-check.js';
import { compareScenarios } from '../../phase3/scenario-comparator.js';
import { runMonteCarloSimulation } from '../../phase3/monte-carlo-engine.js';
import { buildObjective } from '../../phase4/objective-builder.js';
import { runOptimization as runDomainOptimization } from '../../phase4/scenario-optimizer.js';
import { getProfileById } from '../../phase4/objective-profile-library.js';
import { buildStressCaseLibrary } from '../../phase5/stress-case-library.js';
import { runStressTests } from '../../phase5/stress-test-engine.js';
import { runSensitivity, runSensitivityMatrix } from '../../phase5/sensitivity-engine.js';
import { calculateRobustness } from '../../phase5/robustness-scorer.js';
import { assertCompanyPolicy, assertKnownCompany } from '../company-registry.js';
import { assertProviderContract } from './provider-contract.js';

const MOCK_MARKERS = ['empresa_mock', 'synthetic_mock', 'synthetic_fixture', 'demo_only'];

function sensitivityValues(variable, compact = false) {
  if (variable === 'inventory_days') return [30, 45, 60];
  if (variable === 'wacc') return [0.1, 0.15, 0.2];
  return compact ? [0.9, 1, 1.1] : [0.8, 0.9, 1, 1.1, 1.2];
}

function defaultConstraints(config = {}) {
  return {
    min_active_cds: 1,
    max_active_cds: 999,
    max_cd_volume_share: 0.75,
    max_risk_level: 'high',
    ...(config.constraints || {}),
    allow_tax_disabled: false,
  };
}

function defaultObjective(companyId, config = {}) {
  const inherited = config.objective;
  if (inherited?.weights) {
    return buildObjective({
      companyId,
      objectiveName: inherited.objective_name || 'Objetivo herdado da Fase 4',
      weights: inherited.weights,
    });
  }
  const profile = getProfileById(config.profile_id || 'balanced');
  const weights = Object.fromEntries(
    Object.entries(profile?.weights || {}).map(([key, value]) => [key, Number(value) * 100])
  );
  return buildObjective({
    companyId,
    objectiveName: profile?.profile_name || 'Perfil Final Balanceado',
    weights,
  });
}

function assertNoMockLeakage(value, companyId) {
  if (companyId === 'empresa_mock') return value;
  const serialized = JSON.stringify(value || {}).toLowerCase();
  const leaked = MOCK_MARKERS.find((marker) => serialized.includes(marker));
  if (leaked) throw new Error(`Mock leakage detectado em ${companyId}: ${leaked}.`);
  return value;
}

function logProviderEvent(companyId, event, detail = {}) {
  appendSharedDebugEntry({
    phase: 'network-intelligence',
    module: 'project-provider',
    level: 'info',
    event,
    detail: { company_id: companyId, ...detail },
  });
}

export async function createProjectProvider() {
  const provider = {
    provider_kind: 'project',
    context: null,
    baselineBundle: null,
    scenarioLibrary: null,
    optimizationConfig: null,
    lastOptimization: null,
    lastScenario: null,
    async init(context = {}) {
      const definition = assertKnownCompany(context.company_id);
      assertCompanyPolicy(context.company_id, {
        providerKind: 'project',
        runtimeMode: context.runtime_mode,
      });
      if (definition.kind !== 'real') throw new Error('Project provider só aceita tenants reais.');
      this.context = { ...context };
      this.baselineBundle = await loadPhase2Bundle(context.company_id);
      if (this.baselineBundle?.model?.company_id !== context.company_id) {
        throw new Error('Bundle carregado não pertence à empresa selecionada.');
      }
      this.scenarioLibrary = await loadScenarioLibrary(context.company_id);
      this.optimizationConfig = loadOptimizationConfig(context.company_id) || {};
      this.optimizationConfig.optimizer_config = buildCanonicalOptimizationConfig(
        this.optimizationConfig.optimizer_config || {}
      );
      assertNoMockLeakage(
        {
          company_id: context.company_id,
          bundle: this.baselineBundle,
          scenarios: this.scenarioLibrary,
        },
        context.company_id
      );
      logProviderEvent(context.company_id, 'project_provider_ready', {
        scenario_count: this.scenarioLibrary.scenarios?.length || 0,
      });
      return this.getSnapshot();
    },
    async dispose({ lock = false } = {}) {
      const companyId = this.context?.company_id;
      this.lastOptimization = null;
      this.lastScenario = null;
      this.scenarioLibrary = null;
      this.baselineBundle = null;
      this.optimizationConfig = null;
      this.context = null;
      if (lock) lockCryptoSession();
      if (companyId) logProviderEvent(companyId, 'project_provider_disposed', { lock });
    },
    async loadBaseline() {
      const companyId = this.context.company_id;
      return {
        company_id: companyId,
        baseline: this.baselineBundle,
        workbook_parity: buildWorkbookParitySummary(this.baselineBundle),
        warnings: this.baselineBundle?.warnings || [],
        provenance: { provider_kind: 'project', encrypted: true, company_id: companyId },
      };
    },
    async loadScenarioLibrary() {
      return {
        company_id: this.context.company_id,
        scenarios: this.scenarioLibrary?.scenarios || [],
        warnings: this.scenarioLibrary?.warnings || [],
      };
    },
    async runScenario({ scenario = null, scenarioId = null, formValues = {} } = {}) {
      const companyId = this.context.company_id;
      const selected =
        scenario ||
        this.scenarioLibrary?.scenarios?.find((item) => item.scenario_id === scenarioId) ||
        this.scenarioLibrary?.scenarios?.[0];
      const hasFormValues = Object.keys(formValues || {}).length > 0;
      const executable = scenario
        ? scenario
        : hasFormValues
          ? buildScenarioFromForm({
              companyId,
              baselineBundle: this.baselineBundle,
              formValues,
              scenarioId: null,
            })
          : selected?.scenario_type === 'baseline'
            ? selected
            : buildScenarioFromForm({
                companyId,
                baselineBundle: this.baselineBundle,
                formValues: selected?.changes || {},
                scenarioId: selected?.scenario_id,
              });
      const result = runDomainScenario({
        companyId,
        scenario: executable,
        baselineBundle: this.baselineBundle,
      });
      const quality = evaluateScenarioQuality({
        scenarioResult: result,
        baselineBundle: this.baselineBundle,
      });
      const comparison = compareScenarios({
        companyId,
        baselineBundle: this.baselineBundle,
        scenarioResults: [result],
      });
      const record = { scenario: executable, result, quality };
      this.lastScenario = record;
      assertNoMockLeakage(record, companyId);
      return {
        company_id: companyId,
        scenario: executable,
        result,
        quality,
        comparison,
        warnings: result.warnings || [],
        errors: result.errors || [],
      };
    },
    async runRiskSuite({ selectedScenario, deterministicResult = null, config = {} } = {}) {
      const companyId = this.context.company_id;
      const result =
        deterministicResult || (await this.runScenario({ scenario: selectedScenario })).result;
      const monteCarlo = runMonteCarloSimulation({
        companyId,
        selectedScenario,
        baselineBundle: this.baselineBundle,
        deterministicResult: result,
        iterations: Number(config.iterations || 300),
        seed: Number(config.seed || 42),
        config: {
          profile: config.profile || 'balanced',
          scatter_driver: config.scatter_driver || 'freight_multiplier',
        },
      });
      const stressProfile = config.stress_profile || 'standard';
      const stress = runStressTests({
        companyId,
        selectedScenario,
        baselineBundle: this.baselineBundle,
        baselineResult: result,
        stressCases: buildStressCaseLibrary({ companyId, stressProfile }).stress_cases,
      });
      const variable = config.sensitivity_variable || 'freight_multiplier';
      const sensitivity = runSensitivity({
        companyId,
        selectedScenario,
        baselineBundle: this.baselineBundle,
        sensitivityConfig: { variable, values: sensitivityValues(variable) },
      });
      const xVariable = config.sensitivity_x || 'freight_multiplier';
      const yVariable = config.sensitivity_y || 'demand_multiplier';
      const sensitivityMatrix = runSensitivityMatrix({
        companyId,
        selectedScenario,
        baselineBundle: this.baselineBundle,
        matrixConfig: {
          xVariable,
          yVariable,
          xValues: sensitivityValues(xVariable, true),
          yValues: sensitivityValues(yVariable, true),
        },
      });
      const robustness = calculateRobustness({
        companyId,
        scenarioId: selectedScenario?.scenario_id,
        stressResults: stress.stress_results,
        quality: this.lastScenario?.quality || {},
        monteCarlo,
        evidence: result?.evidence || null,
      });
      return assertNoMockLeakage(
        {
          company_id: companyId,
          monte_carlo: monteCarlo,
          stress,
          sensitivity,
          sensitivity_matrix: sensitivityMatrix,
          robustness,
        },
        companyId
      );
    },
    async runOptimization({
      profileId = 'balanced',
      objective = null,
      constraints = {},
      config = {},
    } = {}) {
      const companyId = this.context.company_id;
      const effectiveObjective =
        objective ||
        defaultObjective(companyId, { ...this.optimizationConfig, profile_id: profileId });
      const optimizerConfig = buildCanonicalOptimizationConfig({
        ...(this.optimizationConfig?.optimizer_config || {}),
        ...config,
        method: config.method || 'exact_discrete',
        max_candidates: Number(config.max_candidates || 2000),
        seed: Number(config.seed ?? 42),
      });
      const result = runDomainOptimization({
        companyId,
        baselineBundle: this.baselineBundle,
        objective: effectiveObjective,
        constraints: defaultConstraints({
          ...this.optimizationConfig,
          constraints,
        }),
        optimizerConfig,
      });
      this.lastOptimization = { ...result, objective: effectiveObjective };
      assertNoMockLeakage(result, companyId);
      return this.lastOptimization;
    },
    async buildDecisionPackage(input = {}) {
      const { runDecisionPipeline } = await import('../services/decision-service.js');
      const packageResult = await runDecisionPipeline({ provider: this, ...input });
      return assertNoMockLeakage(packageResult, this.context.company_id);
    },
    getDomainContext() {
      return {
        company_id: this.context?.company_id,
        baselineBundle: this.baselineBundle,
        scenarios: this.scenarioLibrary?.scenarios || [],
        optimizationConfig: this.optimizationConfig,
      };
    },
    getHealth() {
      return {
        company_id: this.context?.company_id || null,
        provider_kind: 'project',
        encrypted: true,
        status: this.baselineBundle ? 'ready' : 'idle',
        scenario_count: this.scenarioLibrary?.scenarios?.length || 0,
      };
    },
    getSnapshot() {
      const companyId = this.context?.company_id || null;
      return {
        company_id: companyId,
        provider_kind: 'project',
        status: this.baselineBundle ? 'ready' : 'idle',
        data: {
          baseline: this.baselineBundle,
          scenarios: this.scenarioLibrary?.scenarios || [],
        },
        meta: {
          encrypted: true,
          company_id: companyId,
          scenario_count: this.scenarioLibrary?.scenarios?.length || 0,
        },
      };
    },
  };
  return assertProviderContract(provider, 'project');
}
