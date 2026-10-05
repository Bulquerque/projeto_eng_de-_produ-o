import { renderBarChart, renderScatterChart } from '../../core/chart-renderer.js';
import { calculateSaving } from '../../core/model-configuration.js';
import { buildTradeoffFrontier } from '../../phase4/tradeoff-frontier.js';
import {
  selectActiveScenario,
  selectBaseline,
  selectDecision,
  selectScenarios,
} from '../selectors/business-selectors.js';
import { comparisonCandidates } from '../pages/results.js';

const COST_COMPONENTS = [
  ['transfer_cost', 'Transferência'],
  ['distribution_cost', 'Distribuição'],
  ['storage_cost', 'Armazenagem'],
  ['inventory_cost', 'Estoque'],
  ['tax_impact', 'Tributos'],
];

function finite(value) {
  const number = Number(value);
  return value != null && Number.isFinite(number) ? number : null;
}

function renderComparison(state) {
  const costRows = comparisonCandidates(state).filter(
    (row) => row.total_with_tax != null && Number.isFinite(Number(row.total_with_tax))
  );
  const chartBaselineId = selectBaseline(state)?.model?.scenario_id || 'baseline';
  if (costRows.length > 1) {
    renderBarChart('niComparisonCostChart', {
      title: 'Custo total por alternativa',
      labels: costRows.map((row) =>
        row.scenario_id === chartBaselineId ? 'Referência' : row.scenario_name || row.scenario_id
      ),
      datasets: [
        {
          label: 'Custo total com tributos (R$)',
          data: costRows.map((row) => Number(row.total_with_tax)),
          backgroundColor: costRows.map((row) =>
            row.status === 'baseline' ? '#526b70' : '#0c7878'
          ),
        },
      ],
      indexAxis: 'y',
      xFormat: 'money',
      yFormat: 'money',
    });
  }

  const decision = selectDecision(state);
  const baselineCosts = selectBaseline(state)?.costs?.costs || {};
  const selected = selectActiveScenario(state);
  const allComparisonRows = decision.comparison?.comparison || [];
  const comparisonRows = allComparisonRows;
  const rows = new Map();
  comparisonRows.forEach((row) => rows.set(row.scenario_id, row));
  const baselineTotal = finite(baselineCosts.total_with_tax);
  const candidates = [...selectScenarios(state), ...(decision.optimizer?.best_scenarios || [])];
  candidates.forEach((candidate) => {
    if (!candidate.scenario_id || rows.has(candidate.scenario_id)) return;
    const result = candidate.result;
    if (
      !result ||
      (candidate.company_id && candidate.company_id !== state.context?.company_id) ||
      (result.company_id && result.company_id !== state.context?.company_id)
    )
      return;
    const total = finite(result.total_with_tax);
    if (baselineTotal == null || total == null) return;
    const saving = calculateSaving({ baselineTotal, scenarioTotal: total });
    rows.set(candidate.scenario_id, {
      scenario_id: candidate.scenario_id,
      scenario_name: candidate.scenario_name || result.scenario_name || candidate.scenario_id,
      saving_abs: saving.saving_abs,
    });
  });

  const baselineId = selectBaseline(state)?.model?.scenario_id;
  const storedIds = Array.isArray(state.ui?.compared_scenario_ids)
    ? state.ui.compared_scenario_ids
    : null;
  const candidateIds = [...rows.values()]
    .filter((row) => row.scenario_id !== baselineId && finite(row.saving_abs) != null)
    .map((row) => row.scenario_id);
  const defaultIds = [...(selected?.scenario_id ? [selected.scenario_id] : []), ...candidateIds]
    .filter((id, index, ids) => id !== baselineId && ids.indexOf(id) === index)
    .slice(0, 4);
  const visibleIds = new Set(storedIds ?? defaultIds);
  if (rows.size) {
    const scenarios = [...rows.values()]
      .filter((row) => visibleIds.has(row.scenario_id))
      .map((row) => ({
        id: row.scenario_id,
        name: row.scenario_name || row.scenario_id,
        saving: finite(row.saving_abs),
      }))
      .filter((row) => row.id && row.saving != null);
    if (scenarios.length) {
      renderBarChart('niDecisionScenarioSavingsChart', {
        title: 'Saving calculado por cenário',
        labels: scenarios.map((row) => row.name),
        datasets: [
          {
            label: 'Saving vs baseline (R$)',
            data: scenarios.map((row) => row.saving),
            backgroundColor: scenarios.map((row) => (row.saving < 0 ? '#b42318' : '#0c7878')),
          },
        ],
        indexAxis: 'y',
        xFormat: 'money',
        yFormat: 'money',
      });
    }
  }

  const selectedRow = comparisonRows.find((row) => row.scenario_id === selected?.scenario_id);
  const selectedCosts = selected?.result?.costs || decision.result?.costs || selectedRow || {};
  const deltas = COST_COMPONENTS.map(([key, label]) => ({
    key,
    label,
    value:
      finite(selectedCosts[key]) != null && finite(baselineCosts[key]) != null
        ? finite(baselineCosts[key]) - finite(selectedCosts[key])
        : null,
  })).filter((row) => row.value != null);
  if (deltas.length) {
    renderBarChart('niDecisionComponentDeltaChart', {
      title: 'Variação por componente vs baseline',
      labels: deltas.map((row) => row.label),
      datasets: [
        {
          label: 'Economia (+) / aumento de custo (−)',
          data: deltas.map((row) => row.value),
          backgroundColor: deltas.map((row) => (row.value < 0 ? '#b42318' : '#0c7878')),
        },
      ],
      indexAxis: 'y',
      xFormat: 'money',
      yFormat: 'money',
    });
  }

  const stress = decision.risk.stress?.stress_results || [];
  const validStress = stress.filter(
    (row) =>
      finite(row.saving_pct) != null &&
      (row.status === 'success' ||
        (row.status == null && finite(row.total_with_tax) != null && !row.errors?.length))
  );
  if (validStress.length) {
    renderBarChart('niDecisionStressChart', {
      title: 'Saving por caso de stress',
      labels: validStress.map((row) => row.case_name || row.case_id || 'Caso'),
      datasets: [
        {
          label: 'Saving (%)',
          data: validStress.map((row) => finite(row.saving_pct)),
          backgroundColor: '#0c7878',
        },
      ],
      indexAxis: 'y',
      xFormat: 'percent',
      yFormat: 'percent',
    });
  }
}

function renderOptimizer(state) {
  const optimizer = selectDecision(state).optimizer;
  if (!optimizer) return;
  const sourceCandidates = optimizer.scored_scenarios?.length
    ? optimizer.scored_scenarios
    : optimizer.best_scenarios || [];
  const companyId = state.context?.company_id;
  const scenarioById = new Map(
    selectScenarios(state)
      .filter((scenario) => scenario.company_id === companyId)
      .map((scenario) => [scenario.scenario_id, scenario])
  );
  const candidates = sourceCandidates.map((candidate) => {
    const scenario = scenarioById.get(candidate.scenario_id);
    const scenarioResult =
      scenario?.company_id === companyId && scenario.result?.company_id === companyId
        ? scenario.result
        : scenario?.company_id === companyId && scenario.result?.company_id == null
          ? scenario.result
          : null;
    return {
      ...candidate,
      result: finite(candidate.result?.total_with_tax) != null ? candidate.result : scenarioResult,
      quality:
        finite(candidate.quality?.quality_score) != null ? candidate.quality : scenario?.quality,
    };
  });
  const hasQuality = candidates.some((item) => finite(item.quality?.quality_score) != null);
  const points = candidates
    .map((item) => ({
      x: finite(item.result?.total_with_tax),
      y: hasQuality ? finite(item.quality?.quality_score) : finite(item.final_score),
      id: item.scenario_id,
      label: item.scenario_name || item.scenario_id,
    }))
    .filter((point) => point.x != null && point.y != null);
  if (!points.length) return;

  const frontierIds = new Set();
  if (hasQuality) {
    const frontier = buildTradeoffFrontier({
      companyId: state.context?.company_id,
      scenarioRecords: candidates
        .filter(
          (item) =>
            finite(item.result?.total_with_tax) != null &&
            finite(item.quality?.quality_score) != null
        )
        .map((item) => ({ result: item.result, quality: item.quality })),
      scoredScenarios: candidates,
    });
    frontier.frontier_points
      .filter((point) => point.is_frontier_candidate)
      .forEach((point) => frontierIds.add(point.scenario_id));
  }
  const frontierPoints = points.filter((point) => frontierIds.has(point.id));
  renderScatterChart('niDecisionOptimizerFrontierChart', {
    title: hasQuality ? 'Custo total × score de qualidade' : 'Custo total × score final',
    datasets: [
      {
        label: hasQuality ? 'Qualidade do cenário' : 'Score final do ranking',
        data: points.map(({ x, y, label, id }) => ({ x, y, label, id })),
        backgroundColor: '#0c7878',
        borderColor: '#0c7878',
      },
      ...(frontierPoints.length
        ? [
            {
              label: 'Fronteira no conjunto avaliado',
              data: frontierPoints.map(({ x, y, label, id }) => ({ x, y, label, id })),
              backgroundColor: '#b45309',
              borderColor: '#b45309',
            },
          ]
        : []),
    ],
    xLabel: 'Custo total com tributos (R$)',
    yLabel: hasQuality ? 'Qualidade (0–100)' : 'Score final',
    xFormat: 'money',
    yFormat: 'number',
    onActivate(point) {
      if (!point.id) return;
      document.getElementById('niDecisionOptimizerFrontierChart')?.dispatchEvent(
        new CustomEvent('network-scenario-select', {
          bubbles: true,
          detail: { scenarioId: point.id },
        })
      );
    },
  });
}

export function renderDecisionAnalytics(state) {
  renderComparison(state);
  renderOptimizer(state);
}
