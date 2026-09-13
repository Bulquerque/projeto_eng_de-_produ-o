import { assertCompanyPolicy, assertKnownCompany } from '../company-registry.js';
import { assertProviderContract } from './provider-contract.js';

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

function buildAudit(scenario, baseline) {
  return {
    audit_id: `empresa_mock_demo_${scenario.scenario_id}`,
    company_id: 'empresa_mock',
    selected_scenario_id: scenario.scenario_id,
    baseline_scenario_id: baseline.model.scenario_id,
    data_sources: ['data-demo/empresa_mock/*.json'],
    provenance: 'synthetic_fixture',
    decision_use: 'demo_only',
  };
}

function buildDecisionPackage({ baseline, scenario, objective, optimizer, risk }) {
  const result = scenario.result;
  const baselineTotal = Number(baseline.costs.costs.total_with_tax);
  const scenarioTotal = Number(result.total_with_tax);
  const savingAbs = baselineTotal - scenarioTotal;
  const savingPct = baselineTotal ? (savingAbs / baselineTotal) * 100 : null;
  const recommendationStatus =
    scenario.scenario_id === 'mock_consolidation' ? 'recommended_with_warnings' : 'not_recommended';
  const recommendation = {
    company_id: 'empresa_mock',
    scenario_id: scenario.scenario_id,
    recommendation_status: recommendationStatus,
    executive_summary:
      'Demonstração sintética: o resultado não representa uma recomendação empresarial observada.',
    main_reasons: [`Saving demonstrativo de ${savingPct.toFixed(1)}%.`],
    main_risks: ['Fixture sintética sem evidência empresarial.'],
    next_actions: ['Substituir por dados do provider do projeto antes de qualquer decisão.'],
    decision_use: 'demo_only',
  };
  const finalQA = {
    company_id: 'empresa_mock',
    final_qa_status: 'passed',
    checks: [{ check: 'mock_policy', pass: true, status: 'passed', message: 'Demo isolada.' }],
    blocking_issues: [],
    warnings: ['Pacote sintético: não usar como evidência empresarial.'],
  };
  const release = {
    release_status: 'warning',
    release_name: 'visagio_network_intelligence_demo',
    ready_to_deliver: false,
    blocking_issues: [],
    warnings: ['release_policy=demo_only'],
  };
  const decision = {
    company_id: 'empresa_mock',
    selected_scenario_id: scenario.scenario_id,
    baseline_scenario_id: baseline.model.scenario_id,
    objective,
    recommendation,
    stress_test: risk.stress,
    robustness: risk.robustness,
    monte_carlo: risk.monte_carlo,
    optimizer_status: optimizer.optimizer_status,
    result_scope: optimizer.result_scope,
    final_qa: finalQA,
    release,
  };
  return {
    decision,
    comparison: {
      company_id: 'empresa_mock',
      baseline_total: baselineTotal,
      scenario_total: scenarioTotal,
      saving_abs: savingAbs,
      saving_pct: savingPct,
    },
    recommendation,
    audit: buildAudit(scenario, baseline),
    final_qa: finalQA,
    release,
    export_package: {
      export_status: 'ready',
      demo_only: true,
      files: [
        {
          filename: 'empresa_mock_decision_package.json',
          type: 'application/json',
          content: JSON.stringify(decision, null, 2),
        },
      ],
    },
  };
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
      const [baseline, scenarios, objective, stress] = await Promise.all([
        readFixture(FIXTURE_URLS.baseline),
        readFixture(FIXTURE_URLS.scenarios),
        readFixture(FIXTURE_URLS.objective),
        readFixture(FIXTURE_URLS.stress),
      ]);
      this.fixtures = {
        baseline: assertFixturePolicy(baseline),
        scenarios: assertFixturePolicy(scenarios),
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
        baseline: this.fixtures.baseline,
        warnings: this.fixtures.baseline.warnings || [],
        provenance: this.fixtures.baseline.provenance,
      };
    },
    async loadScenarioLibrary() {
      return {
        company_id: 'empresa_mock',
        scenarios: this.fixtures.scenarios.scenarios,
        warnings: [],
      };
    },
    async runScenario({ scenarioId } = {}) {
      const scenarios = this.fixtures.scenarios.scenarios;
      const scenario = scenarios.find((item) => item.scenario_id === scenarioId) || scenarios[0];
      const baselineTotal = Number(this.fixtures.baseline.costs.costs.total_with_tax);
      const scenarioTotal = Number(scenario.result?.total_with_tax);
      return {
        company_id: 'empresa_mock',
        scenario,
        result: scenario.result,
        quality: { quality_score: 100, risk_level: 'medium' },
        comparison: {
          company_id: 'empresa_mock',
          comparison: [
            {
              scenario_id: scenario.scenario_id,
              scenario_name: scenario.scenario_name,
              total_with_tax: scenarioTotal,
              saving_abs: baselineTotal - scenarioTotal,
              saving_pct: baselineTotal
                ? ((baselineTotal - scenarioTotal) / baselineTotal) * 100
                : null,
            },
          ],
          baseline_total: baselineTotal,
          scenario_total: scenarioTotal,
          saving_abs: baselineTotal - scenarioTotal,
          saving_pct: baselineTotal
            ? ((baselineTotal - scenarioTotal) / baselineTotal) * 100
            : null,
        },
      };
    },
    async runRiskSuite() {
      return this.fixtures.stress.risk;
    },
    async runOptimization() {
      return this.fixtures.objective.optimizer;
    },
    async buildDecisionPackage({ scenarioId } = {}) {
      const scenario =
        this.fixtures.scenarios.scenarios.find((item) => item.scenario_id === scenarioId) ||
        this.fixtures.scenarios.scenarios[0];
      const packageResult = buildDecisionPackage({
        baseline: this.fixtures.baseline,
        scenario,
        objective: this.fixtures.objective.objective,
        optimizer: this.fixtures.objective.optimizer,
        risk: this.fixtures.stress.risk,
      });
      return {
        ...packageResult,
        optimizer: this.fixtures.objective.optimizer,
        selected_scenario: {
          scenario,
          result: scenario.result,
          quality: { quality_score: 100, risk_level: 'medium' },
          monte_carlo: this.fixtures.stress.risk.monte_carlo,
        },
        risk: this.fixtures.stress.risk,
      };
    },
    getDomainContext() {
      return {
        company_id: 'empresa_mock',
        baselineBundle: this.fixtures?.baseline || null,
        scenarios: this.fixtures?.scenarios?.scenarios || [],
        objective: this.fixtures?.objective?.objective || null,
      };
    },
    getHealth() {
      return {
        company_id: 'empresa_mock',
        provider_kind: 'mock',
        release_policy: 'demo_only',
        status: this.fixtures ? 'ready' : 'idle',
      };
    },
    getSnapshot() {
      return {
        company_id: 'empresa_mock',
        provider_kind: 'mock',
        status: this.fixtures ? 'ready' : 'idle',
        data: this.fixtures ? { baseline: this.fixtures.baseline } : {},
        meta: { release_policy: 'demo_only', synthetic: true },
      };
    },
  };
  return assertProviderContract(provider, 'mock');
}
