import { assertCompanyPolicy, assertKnownCompany } from '../company-registry.js';
import { assertProviderContract } from './provider-contract.js';
import { buildScenarioFromForm } from '../../phase3/scenario-builder.js';
import { runScenario as runDomainScenario } from '../../phase3/scenario-simulator.js';
import { evaluateScenarioQuality } from '../../phase3/scenario-quality-check.js';
import { compareScenarios } from '../../phase3/scenario-comparator.js';
import { runMonteCarloSimulation } from '../../phase3/monte-carlo-engine.js';
import { buildObjective } from '../../phase4/objective-builder.js';
import { runOptimization as runDomainOptimization } from '../../phase4/scenario-optimizer.js';
import { getProfileById } from '../../phase4/objective-profile-library.js';
import { buildCanonicalOptimizationConfig } from '../../core/optimization-policy.js';
import { buildStressCaseLibrary } from '../../phase5/stress-case-library.js';
import { runStressTests } from '../../phase5/stress-test-engine.js';
import { runSensitivity, runSensitivityMatrix } from '../../phase5/sensitivity-engine.js';
import { calculateRobustness } from '../../phase5/robustness-scorer.js';

const FIXTURE_URLS = Object.freeze({
  baseline: new URL('../../../../data-demo/empresa_mock/baseline.json', import.meta.url),
  scenarios: new URL('../../../../data-demo/empresa_mock/scenarios.json', import.meta.url),
  objective: new URL('../../../../data-demo/empresa_mock/objective.json', import.meta.url),
  stress: new URL('../../../../data-demo/empresa_mock/stress-cases.json', import.meta.url),
});

async function readFixture(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Fixture demo indisponível: ${url.pathname}.`);
  return response.json();
}

function assertFixturePolicy(fixture) {
  if (fixture?.company_id !== 'empresa_mock') throw new Error('Fixture demo com empresa inválida.');
  if (fixture?.release_policy !== 'demo_only') {
    throw new Error('Fixture demo sem release_policy=demo_only.');
  }
  return fixture;
}

function markDemoBaseline(baseline) {
  const taxResults = baseline?.tax_results?.tax_results || {};
  return {
    ...baseline,
    provenance: {
      ...(baseline.provenance || {}),
      company_id: COMPANY_ID,
      provider_kind: 'mock',
      synthetic: true,
      release_policy: 'demo_only',
    },
    tax_results: {
      ...baseline.tax_results,
      tax_results: {
        ...taxResults,
        source_classification: 'synthetic_fixture',
        tax_source_classification: 'synthetic_fixture',
        tax_source_label: 'Parâmetros tributários sintéticos demonstrativos',
        decision_use: 'demo_only',
      },
    },
  };
}

function normalizeDemoBaselineTax(baseline, baselineScenario) {
  const canonicalBaselineScenario =
    baselineScenario?.metadata?.source === 'ScenarioBuilder'
      ? baselineScenario
      : buildScenarioFromForm({
          companyId: COMPANY_ID,
          baselineBundle: baseline,
          formValues: {
            ...(baselineScenario?.changes || {}),
            scenario_name: baselineScenario?.scenario_name || 'Referência demonstrativa',
            scenario_type: baselineScenario?.scenario_type || 'baseline',
          },
          scenarioId: baselineScenario?.scenario_id || baseline?.model?.scenario_id || null,
        });
  const eligibilityProbe = runDomainScenario({
    companyId: COMPANY_ID,
    scenario: canonicalBaselineScenario,
    baselineBundle: baseline,
  });
  const coverage =
    eligibilityProbe?.tax_results?.tax_coverage ||
    eligibilityProbe?.costs?.tax_details?.tax_coverage ||
    null;
  const eligibleFlowCount = Number(coverage?.eligible_flow_count);
  if (Number.isFinite(eligibleFlowCount) && eligibleFlowCount > 0) {
    const sourceCosts = baseline?.costs?.costs || {};
    const sourceTaxResults = baseline?.tax_results || {};
    const storedTaxResults = sourceTaxResults.tax_results || {};
    const calculatedTaxResults = eligibilityProbe?.tax_results || {};
    const taxImpact = Number(
      eligibilityProbe?.costs?.tax_impact ?? calculatedTaxResults.total_tax_impact ?? 0
    );
    const logisticsTotal = Number(sourceCosts.total_logistics_cost);
    const warnings = [
      ...(baseline.warnings || []),
      ...(eligibilityProbe.warnings || []),
      'A receita fiscal da empresa_mock é sintética; categorias proxy deixam a classificação fiscal incompleta.',
    ];
    return {
      ...baseline,
      costs: {
        ...baseline.costs,
        costs: {
          ...sourceCosts,
          tax_impact: taxImpact,
          total_with_tax: Number.isFinite(logisticsTotal)
            ? logisticsTotal + taxImpact
            : sourceCosts.total_with_tax,
        },
      },
      tax_results: {
        ...sourceTaxResults,
        tax_results: {
          ...storedTaxResults,
          ...calculatedTaxResults,
          total_tax: taxImpact,
          total_tax_impact: taxImpact,
          total_current_tax: calculatedTaxResults.total_current_tax ?? taxImpact,
          tax_source_classification: 'synthetic_fixture',
          decision_use: 'exploratory_only',
          tax_coverage: coverage,
        },
      },
      warnings: [...new Set(warnings)],
    };
  }
  if (!Number.isFinite(eligibleFlowCount)) return baseline;

  const sourceCosts = baseline?.costs?.costs || {};
  const logisticsTotal = Number(sourceCosts.total_logistics_cost);
  if (!Number.isFinite(logisticsTotal)) return baseline;

  const sourceTaxResults = baseline?.tax_results || {};
  const taxResults = sourceTaxResults.tax_results || {};
  const flowCount = Number(coverage?.input_flow_count ?? baseline?.flows?.length ?? 0);
  const warning =
    'A demonstração não tem fluxos com receita fiscal elegível; tributos foram zerados para comparar somente custos logísticos. Isso não representa uma carga tributária observada.';
  return {
    ...baseline,
    costs: {
      ...baseline.costs,
      costs: {
        ...sourceCosts,
        tax_impact: 0,
        total_with_tax: logisticsTotal,
      },
    },
    tax_results: {
      ...sourceTaxResults,
      tax_results: {
        ...taxResults,
        total_tax: 0,
        total_tax_impact: 0,
        total_current_tax: 0,
        decision_use: 'exploratory_only',
        tax_coverage: {
          ...(coverage || {}),
          input_flow_count: flowCount,
          eligible_flow_count: 0,
          excluded_missing_revenue_count: Number(
            coverage?.excluded_missing_revenue_count ?? flowCount
          ),
          uncovered_flow_count: Number(coverage?.uncovered_flow_count ?? flowCount),
          complete_fiscal_coverage_ratio: 0,
          complete_fiscal_coverage_pct: 0,
          fiscal_classification_coverage: 0,
          coverage_limited: true,
          coverage_status: 'limited',
          decision_gate: 'warning',
          result_usable: false,
          decision_use: 'exploratory_only',
        },
        warnings: [...(taxResults.warnings || []), warning],
      },
    },
    warnings: [...(baseline.warnings || []), warning],
  };
}

function markSyntheticResult(result) {
  if (!result) return result;
  const taxResults = result.tax_results || {};
  const hasEligibleFiscalFlows = Number(taxResults.tax_coverage?.eligible_flow_count) > 0;
  return {
    ...result,
    company_id: COMPANY_ID,
    provenance: {
      company_id: COMPANY_ID,
      provider_kind: 'mock',
      synthetic: true,
      release_policy: 'demo_only',
    },
    demo_only: true,
    release_policy: 'demo_only',
    decision_use: 'demo_only',
    simulation_scope: 'exploratory_only',
    simulation_scope_label: 'Simulação exploratória demonstrativa',
    data_quality: {
      ...(result.data_quality || {}),
      decision_use: 'demo_only',
      provenance: 'synthetic_fixture',
    },
    tax_results: {
      ...taxResults,
      company_id: COMPANY_ID,
      source_classification: 'synthetic_fixture',
      tax_source_classification: 'synthetic_fixture',
      tax_source_label: 'Parâmetros tributários sintéticos demonstrativos',
      demo_only: true,
      decision_use: taxResults.decision_use || 'exploratory_only',
      simulation_scope: 'exploratory_only',
      simulation_scope_label: hasEligibleFiscalFlows
        ? 'Impacto tributário calculado com receitas e categorias proxy sintéticas; uso apenas demonstrativo.'
        : 'Impacto tributário indisponível: a fixture não tem receita fiscal elegível.',
    },
  };
}

const COMPANY_ID = 'empresa_mock';
const PROVIDER_CAPABILITIES = Object.freeze({
  demo_only: true,
  scenario_simulation: { supported: true, engine: 'phase3', input: 'synthetic_fixture' },
  optimization: {
    supported: true,
    engine: 'phase4',
    controls: ['profileId', 'max_candidates', 'seed', 'constraints'],
    demo_only_metrics: {
      tax_impact:
        'Calculado com receita e categoria proxy sintéticas; não representa imposto observado nem uma apuração fiscal.',
    },
  },
  risk: {
    supported: true,
    engines: ['monte_carlo', 'stress', 'sensitivity', 'robustness'],
    controls: [
      'iterations',
      'seed',
      'profile',
      'scatter_driver',
      'stress_profile',
      'sensitivity_variable',
      'sensitivity_x',
      'sensitivity_y',
    ],
    unavailable_controls: {
      scatter_driver_tax_multiplier:
        'Impacto tributário sintético e exploratório; não reflete tributo observado.',
      tax_reform_stress:
        'A análise usa categorias proxy sintéticas e não valida uma apuração fiscal.',
    },
    uncertainty_source: 'model_prior',
  },
  fiscal: {
    supported: true,
    decision_use: 'exploratory_only',
    complete_fiscal_coverage: false,
    tax_reform_scenarios: true,
    tax_reform_calculation: true,
    baseline_policy: 'synthetic_proxy_revenue_calculation_demo_only',
    reason:
      'O cálculo usa receitas e categorias fiscais sintéticas; NCM, CFOP e CST não são inventados e a saída é somente demonstrativa, sem validação fiscal oficial.',
  },
  historical_uncertainty: {
    supported: false,
    reason: 'A empresa demo não possui série histórica; Monte Carlo usa priors do modelo.',
  },
});

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

function defaultObjective(profileId = 'balanced') {
  const profile = getProfileById(profileId) || getProfileById('balanced');
  const weights = Object.fromEntries(
    Object.entries(profile?.weights || {}).map(([key, value]) => [key, Number(value) * 100])
  );
  return buildObjective({
    companyId: COMPANY_ID,
    objectiveName: profile?.profile_name || 'Perfil Final Balanceado',
    weights,
  });
}

function hydrateRankedRow(row, scenarioMap, baselineBundle) {
  const scenarioId = row?.scenario_id || row?.scenario?.scenario_id || row?.result?.scenario_id;
  const scenario = row?.scenario || scenarioMap.get(scenarioId) || null;
  const result = markSyntheticResult(row?.result || scenario?.result || null);
  const quality =
    row?.quality ||
    (result ? evaluateScenarioQuality({ scenarioResult: result, baselineBundle }) : null);
  const activeCds = Array.isArray(scenario?.changes?.active_cds)
    ? [...scenario.changes.active_cds]
    : null;
  return {
    ...row,
    company_id: COMPANY_ID,
    scenario_id: scenarioId || null,
    scenario: scenario ? { ...scenario, company_id: COMPANY_ID } : null,
    result: result ? { ...result, company_id: COMPANY_ID } : null,
    quality: quality ? { ...quality, company_id: COMPANY_ID } : null,
    active_cds: activeCds,
    active_cd_count: activeCds?.length ?? null,
    demo_only: true,
    decision_use: 'demo_only',
  };
}

function hydrateOptimizer(result, scenarios, baselineBundle) {
  const scenarioMap = new Map((scenarios || []).map((item) => [item.scenario_id, item]));
  return {
    ...result,
    company_id: COMPANY_ID,
    provider_kind: 'mock',
    provenance: {
      company_id: COMPANY_ID,
      provider_kind: 'mock',
      synthetic: true,
      release_policy: 'demo_only',
    },
    demo_only: true,
    release_policy: 'demo_only',
    decision_use: 'demo_only',
    warnings: [
      ...(result?.warnings || []),
      'O componente fiscal não separa os candidatos: a fixture não contém fluxos tributários elegíveis.',
    ],
    best_scenarios: (result?.best_scenarios || []).map((row) =>
      hydrateRankedRow(row, scenarioMap, baselineBundle)
    ),
    scored_scenarios: (result?.scored_scenarios || []).map((row) =>
      hydrateRankedRow(row, scenarioMap, baselineBundle)
    ),
  };
}

function assertScenarioCompany(scenario) {
  if (!scenario || scenario.company_id !== COMPANY_ID) {
    throw new Error('Cenário demo ausente ou pertencente a outra empresa.');
  }
  return scenario;
}

const DEMO_TAX_YEARS = new Set([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]);
const DEMO_TAX_MODES = new Set([
  'reform_2026',
  'reform_2027',
  'reform_2028',
  'reform_2027_2028',
  'reform_2029',
  'reform_2030',
  'reform_2031',
  'reform_2032',
  'reform_2033',
  'reform_full_2033',
  'transition_2029',
  'transition_2030',
  'transition_2031',
  'transition_2032',
]);

function isSupportedDemoTaxScenario(scenario) {
  const year = Number(scenario?.changes?.tax_year);
  const mode = String(scenario?.changes?.tax_mode || 'current');
  return mode === 'current' || (DEMO_TAX_YEARS.has(year) && DEMO_TAX_MODES.has(mode));
}

function assertSupportedScenario(scenario) {
  if (!isSupportedDemoTaxScenario(scenario)) {
    throw new Error(
      'Cenário tributário demonstrativo inválido: selecione o regime atual ou um ano de 2026 a 2033.'
    );
  }
  return scenario;
}

function isExecutableDemoScenario(scenario) {
  return isSupportedDemoTaxScenario(scenario);
}

function buildScenarioFromExisting(scenario, baselineBundle, scenarioId = scenario?.scenario_id) {
  return buildScenarioFromForm({
    companyId: COMPANY_ID,
    baselineBundle,
    formValues: {
      ...(scenario?.changes || {}),
      scenario_name: scenario?.scenario_name,
      scenario_type: scenario?.scenario_type,
    },
    scenarioId: scenarioId || null,
  });
}

function markDemoExportFile(file) {
  const marked = { ...file, demo_only: true, release_policy: 'demo_only' };
  if (file?.type === 'text/html' && typeof file.content === 'string') {
    const banner =
      '<p role="note"><strong>Demonstração — dados sintéticos.</strong> Este relatório não representa uma operação empresarial observada.</p>';
    marked.content = /<body\b[^>]*>/i.test(file.content)
      ? file.content.replace(/<body\b[^>]*>/i, `$&${banner}`)
      : banner + file.content;
  }
  if (file?.type === 'application/json' && typeof file.content === 'string') {
    try {
      const payload = JSON.parse(file.content);
      const decisionPackage = payload.decision_package
        ? {
            ...payload.decision_package,
            demo_only: true,
            release_policy: 'demo_only',
            decision_use: 'demo_only',
          }
        : payload.decision_package;
      marked.content = JSON.stringify(
        {
          ...payload,
          demo_only: true,
          release_policy: 'demo_only',
          decision_use: 'demo_only',
          decision_package: decisionPackage,
        },
        null,
        2
      );
    } catch {
      // Mantém o conteúdo original; o arquivo e o pacote continuam rotulados como demo.
    }
  }
  return marked;
}

export async function createMockProvider() {
  const provider = {
    provider_kind: 'mock',
    context: null,
    fixtures: null,
    async init(context = {}) {
      assertCompanyPolicy(context.company_id, {
        providerKind: 'mock',
        runtimeMode: context.runtime_mode,
      });
      assertKnownCompany(context.company_id);
      this.context = { ...context, company_id: 'empresa_mock' };
      const [baselineFixture, scenarios, objective, stress] = await Promise.all([
        readFixture(FIXTURE_URLS.baseline),
        readFixture(FIXTURE_URLS.scenarios),
        readFixture(FIXTURE_URLS.objective),
        readFixture(FIXTURE_URLS.stress),
      ]);
      const validatedBaseline = assertFixturePolicy(baselineFixture);
      const validatedScenarios = assertFixturePolicy(scenarios);
      const baselineScenario =
        (validatedScenarios.scenarios || []).find(
          (scenario) => scenario.scenario_id === validatedBaseline.model?.scenario_id
        ) ||
        buildScenarioFromForm({
          companyId: COMPANY_ID,
          baselineBundle: validatedBaseline,
          formValues: {
            scenario_name: validatedBaseline.model?.scenario_name || 'Referência demonstrativa',
            active_cds: validatedBaseline.model?.active_cds || [],
            freight_multiplier: 1,
            demand_multiplier: 1,
            inventory_days: 45,
            wacc: 0.15,
            tax_mode: 'current',
          },
          scenarioId: validatedBaseline.model?.scenario_id || 'mock_baseline',
        });
      this.fixtures = {
        baseline: markDemoBaseline(normalizeDemoBaselineTax(validatedBaseline, baselineScenario)),
        scenarios: {
          ...validatedScenarios,
          scenarios: (validatedScenarios.scenarios || []).filter(isExecutableDemoScenario),
          unavailable_scenarios: (validatedScenarios.scenarios || [])
            .filter((scenario) => !isExecutableDemoScenario(scenario))
            .map((scenario) => ({
              scenario_id: scenario.scenario_id,
              reason: 'Fixture sem fluxos fiscais elegíveis para simular a reforma tributária.',
            })),
        },
        objective: assertFixturePolicy(objective),
        stress: assertFixturePolicy(stress),
      };
      return this.getSnapshot();
    },
    async dispose() {
      this.context = null;
      this.fixtures = null;
    },
    async loadBaseline() {
      return {
        company_id: 'empresa_mock',
        provider_kind: 'mock',
        baseline: this.fixtures.baseline,
        warnings: this.fixtures.baseline.warnings || [],
        provenance: {
          ...this.fixtures.baseline.provenance,
          company_id: COMPANY_ID,
          provider_kind: 'mock',
          synthetic: true,
          release_policy: 'demo_only',
        },
      };
    },
    async loadScenarioLibrary() {
      return {
        company_id: 'empresa_mock',
        provider_kind: 'mock',
        scenarios: this.fixtures.scenarios.scenarios,
        warnings: [],
        unavailable_scenarios: this.fixtures.scenarios.unavailable_scenarios,
        provenance: {
          company_id: COMPANY_ID,
          provider_kind: 'mock',
          synthetic: true,
          release_policy: 'demo_only',
        },
      };
    },
    async runScenario({
      scenario: suppliedScenario = null,
      scenarioId = null,
      formValues = {},
    } = {}) {
      const scenarios = this.fixtures.scenarios.scenarios;
      const hasFormValues = Object.keys(formValues || {}).length > 0;
      let scenario;
      if (suppliedScenario) {
        assertScenarioCompany(suppliedScenario);
        scenario =
          suppliedScenario.metadata?.source === 'ScenarioBuilder' &&
          suppliedScenario.base_scenario_id === this.fixtures.baseline.model.scenario_id
            ? suppliedScenario
            : buildScenarioFromExisting(suppliedScenario, this.fixtures.baseline);
      } else {
        const template = scenarioId
          ? scenarios.find((item) => item.scenario_id === scenarioId)
          : null;
        if (scenarioId && !template) {
          throw new Error(`Cenário demo não encontrado: ${scenarioId}.`);
        }
        const baseScenario = template || scenarios[0];
        const mergedValues = {
          ...(baseScenario?.changes || {}),
          scenario_name: baseScenario?.scenario_name,
          ...formValues,
          scenario_type: hasFormValues
            ? formValues.scenario_type || 'manual'
            : baseScenario?.scenario_type,
        };
        scenario = buildScenarioFromForm({
          companyId: COMPANY_ID,
          baselineBundle: this.fixtures.baseline,
          formValues: mergedValues,
          scenarioId: hasFormValues ? null : scenarioId || baseScenario?.scenario_id || null,
        });
      }
      assertScenarioCompany(scenario);
      assertSupportedScenario(scenario);
      const result = runDomainScenario({
        companyId: COMPANY_ID,
        scenario,
        baselineBundle: this.fixtures.baseline,
      });
      const syntheticResult = markSyntheticResult(result);
      const quality = evaluateScenarioQuality({
        scenarioResult: syntheticResult,
        baselineBundle: this.fixtures.baseline,
      });
      const baselineTotal = Number(this.fixtures.baseline.costs.costs.total_with_tax);
      const comparison = compareScenarios({
        companyId: COMPANY_ID,
        baselineBundle: this.fixtures.baseline,
        scenarioResults: [syntheticResult],
      });
      this.lastScenario = { scenario, result: syntheticResult, quality };
      return {
        company_id: COMPANY_ID,
        provider_kind: 'mock',
        provenance: {
          company_id: COMPANY_ID,
          provider_kind: 'mock',
          synthetic: true,
          release_policy: 'demo_only',
        },
        scenario,
        result: syntheticResult,
        quality: { ...quality, company_id: COMPANY_ID },
        comparison: {
          ...comparison,
          baseline_total: baselineTotal,
          demo_only: true,
          release_policy: 'demo_only',
          decision_use: 'demo_only',
        },
      };
    },
    async runRiskSuite({ selectedScenario, deterministicResult = null, config = {} } = {}) {
      const scenario = assertScenarioCompany(selectedScenario);
      assertSupportedScenario(scenario);
      if (config.scatter_driver === 'tax_multiplier') {
        throw new Error(
          'Driver tax_multiplier indisponível: a fixture demo não tem impacto fiscal elegível.'
        );
      }
      const result =
        deterministicResult ||
        runDomainScenario({
          companyId: COMPANY_ID,
          scenario,
          baselineBundle: this.fixtures.baseline,
        });
      const monteCarlo = runMonteCarloSimulation({
        companyId: COMPANY_ID,
        selectedScenario: scenario,
        baselineBundle: this.fixtures.baseline,
        deterministicResult: result,
        iterations: Number(config.iterations || 300),
        seed: Number(config.seed || 42),
        config: {
          profile: config.profile || 'balanced',
          scatter_driver: config.scatter_driver || 'freight_multiplier',
        },
      });
      const stress = runStressTests({
        companyId: COMPANY_ID,
        selectedScenario: scenario,
        baselineBundle: this.fixtures.baseline,
        baselineResult: result,
        stressCases: buildStressCaseLibrary({
          companyId: COMPANY_ID,
          stressProfile: config.stress_profile || 'standard',
        }).stress_cases.filter((stressCase) => !stressCase.changes?.tax_mode),
      });
      const variable = config.sensitivity_variable || 'freight_multiplier';
      const sensitivity = runSensitivity({
        companyId: COMPANY_ID,
        selectedScenario: scenario,
        baselineBundle: this.fixtures.baseline,
        sensitivityConfig: { variable, values: sensitivityValues(variable) },
      });
      const xVariable = config.sensitivity_x || 'freight_multiplier';
      const yVariable = config.sensitivity_y || 'demand_multiplier';
      const sensitivityMatrix = runSensitivityMatrix({
        companyId: COMPANY_ID,
        selectedScenario: scenario,
        baselineBundle: this.fixtures.baseline,
        matrixConfig: {
          xVariable,
          yVariable,
          xValues: sensitivityValues(xVariable, true),
          yValues: sensitivityValues(yVariable, true),
        },
      });
      const quality = evaluateScenarioQuality({
        scenarioResult: result,
        baselineBundle: this.fixtures.baseline,
      });
      const robustness = calculateRobustness({
        companyId: COMPANY_ID,
        scenarioId: scenario.scenario_id,
        stressResults: stress.stress_results,
        quality,
        monteCarlo,
        evidence: result?.evidence || null,
      });
      return {
        company_id: COMPANY_ID,
        provider_kind: 'mock',
        provenance: {
          company_id: COMPANY_ID,
          provider_kind: 'mock',
          synthetic: true,
          release_policy: 'demo_only',
        },
        demo_only: true,
        release_policy: 'demo_only',
        decision_use: 'demo_only',
        monte_carlo: { ...monteCarlo, demo_only: true, release_policy: 'demo_only' },
        stress: { ...stress, demo_only: true, release_policy: 'demo_only' },
        sensitivity: { ...sensitivity, demo_only: true, release_policy: 'demo_only' },
        sensitivity_matrix: {
          ...sensitivityMatrix,
          demo_only: true,
          release_policy: 'demo_only',
        },
        robustness: { ...robustness, demo_only: true, release_policy: 'demo_only' },
      };
    },
    async runOptimization({
      profileId = 'balanced',
      objective = null,
      constraints = {},
      config = {},
    } = {}) {
      const effectiveObjective = objective || defaultObjective(profileId);
      const optimizerConfig = buildCanonicalOptimizationConfig({
        ...config,
        method: config.method || 'exact_discrete',
        max_candidates: Number(config.max_candidates || 2000),
        seed: Number(config.seed ?? 42),
      });
      const result = runDomainOptimization({
        companyId: COMPANY_ID,
        baselineBundle: this.fixtures.baseline,
        objective: effectiveObjective,
        constraints: defaultConstraints({ constraints }),
        optimizerConfig,
      });
      this.lastOptimization = hydrateOptimizer(
        { ...result, objective: effectiveObjective },
        this.fixtures.scenarios.scenarios,
        this.fixtures.baseline
      );
      this.lastOptimization.capabilities = PROVIDER_CAPABILITIES;
      return this.lastOptimization;
    },
    async buildDecisionPackage(input = {}) {
      const { runDecisionPipeline } = await import('../services/decision-service.js');
      const packageResult = await runDecisionPipeline({
        provider: this,
        ...input,
        existingOptimizerResult:
          input.existingOptimizerResult ||
          (input.selectionMode === 'manual' ? this.lastOptimization : null),
      });
      return {
        ...packageResult,
        company_id: COMPANY_ID,
        provider_kind: 'mock',
        provenance: {
          company_id: COMPANY_ID,
          provider_kind: 'mock',
          synthetic: true,
          release_policy: 'demo_only',
        },
        optimizer: packageResult.optimizer
          ? hydrateOptimizer(
              packageResult.optimizer,
              this.fixtures.scenarios.scenarios,
              this.fixtures.baseline
            )
          : null,
        decision: packageResult.decision
          ? {
              ...packageResult.decision,
              demo_only: true,
              release_policy: 'demo_only',
              decision_use: 'demo_only',
            }
          : packageResult.decision,
        risk: packageResult.risk
          ? {
              ...packageResult.risk,
              demo_only: true,
              release_policy: 'demo_only',
              monte_carlo: packageResult.risk.monte_carlo
                ? {
                    ...packageResult.risk.monte_carlo,
                    demo_only: true,
                    release_policy: 'demo_only',
                  }
                : packageResult.risk.monte_carlo,
              stress: packageResult.risk.stress
                ? { ...packageResult.risk.stress, demo_only: true, release_policy: 'demo_only' }
                : packageResult.risk.stress,
              sensitivity: packageResult.risk.sensitivity
                ? {
                    ...packageResult.risk.sensitivity,
                    demo_only: true,
                    release_policy: 'demo_only',
                  }
                : packageResult.risk.sensitivity,
              sensitivity_matrix: packageResult.risk.sensitivity_matrix
                ? {
                    ...packageResult.risk.sensitivity_matrix,
                    demo_only: true,
                    release_policy: 'demo_only',
                  }
                : packageResult.risk.sensitivity_matrix,
              robustness: packageResult.risk.robustness
                ? { ...packageResult.risk.robustness, demo_only: true, release_policy: 'demo_only' }
                : packageResult.risk.robustness,
            }
          : packageResult.risk,
        demo_only: true,
        release_policy: 'demo_only',
        decision_use: 'demo_only',
        export_package: {
          ...packageResult.export_package,
          demo_only: true,
          release_policy: 'demo_only',
          decision_use: 'demo_only',
          files: (packageResult.export_package?.files || []).map((file) => ({
            ...markDemoExportFile(file),
          })),
        },
      };
    },
    getDomainContext() {
      return {
        company_id: 'empresa_mock',
        provider_kind: 'mock',
        release_policy: 'demo_only',
        synthetic: true,
        baselineBundle: this.fixtures?.baseline || null,
        scenarios: this.fixtures?.scenarios?.scenarios || [],
        objective: this.fixtures?.objective?.objective || null,
        optimizer: this.lastOptimization || null,
        capabilities: PROVIDER_CAPABILITIES,
      };
    },
    getHealth() {
      return {
        company_id: 'empresa_mock',
        provider_kind: 'mock',
        release_policy: 'demo_only',
        synthetic: true,
        decision_use: 'demo_only',
        capabilities: PROVIDER_CAPABILITIES,
        status: this.fixtures ? 'ready' : 'idle',
      };
    },
    getSnapshot() {
      return {
        company_id: 'empresa_mock',
        provider_kind: 'mock',
        status: this.fixtures ? 'ready' : 'idle',
        data: this.fixtures ? { baseline: this.fixtures.baseline } : {},
        meta: {
          company_id: COMPANY_ID,
          provider_kind: 'mock',
          provenance: {
            company_id: COMPANY_ID,
            provider_kind: 'mock',
            synthetic: true,
            release_policy: 'demo_only',
          },
          release_policy: 'demo_only',
          synthetic: true,
          decision_use: 'demo_only',
          capabilities: PROVIDER_CAPABILITIES,
          scenario_count: this.fixtures?.scenarios?.scenarios?.length || 0,
        },
      };
    },
  };
  return assertProviderContract(provider, 'mock');
}
