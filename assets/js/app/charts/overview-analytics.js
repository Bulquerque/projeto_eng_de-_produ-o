import { renderBarChart } from '../../core/chart-renderer.js';
import {
  selectActiveCompany,
  selectActiveScenario,
  selectBaseline,
} from '../selectors/business-selectors.js';

const COST_COMPONENTS = [
  ['Transferência', 'transfer_cost'],
  ['Distribuição', 'distribution_cost'],
  ['Armazenagem', 'storage_cost'],
  ['Estoque', 'inventory_cost'],
  ['Tributos', 'tax_impact'],
];

const DISTRIBUTION_TYPES = new Set([
  'distribution',
  'cd_to_customer',
  'cd_to_destination',
  'cd_to_destination_proxy',
  'cd_to_retail',
  'distribution_flow',
]);

const NON_DISTRIBUTION_TYPES = new Set([
  'factory_to_cd',
  'factory_to_factory',
  'supplier_to_factory',
  'supplier_to_cd',
  'transfer',
  'inbound',
  'supply',
]);

function finite(value) {
  if (!['string', 'number'].includes(typeof value) || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function flowType(flow) {
  const value = flow?.flow_type ?? flow?.type;
  return value == null
    ? ''
    : String(value)
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
}

export function isDistributionFlow(flow) {
  const type = flowType(flow);
  if (NON_DISTRIBUTION_TYPES.has(type)) return false;
  if (DISTRIBUTION_TYPES.has(type)) return true;
  if (type) return false;
  return (
    Boolean(flow?.cd || flow?.assigned_cd || flow?.cd_name) &&
    Boolean(flow?.destination || flow?.destination_uf)
  );
}

function getCosts(value) {
  return value?.costs?.costs || value?.costs || null;
}

function chartCaption(canvasId, message, summary = 'Dados insuficientes') {
  const canvas = document.getElementById(canvasId);
  const caption = canvas?.parentElement?.querySelector(`[data-chart-caption="${canvasId}"]`);
  if (caption) caption.textContent = message;
  const compact = canvas?.parentElement?.querySelector(`[data-chart-summary="${canvasId}"]`);
  if (compact) compact.textContent = summary;
}

function setCanvasVisible(canvasId, visible) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return false;
  canvas.hidden = !visible;
  return true;
}

function baselineSourceLabel(baseline) {
  if (baseline?.company_id === 'empresa_mock' || baseline?.provenance?.synthetic)
    return 'Fixture sintética da empresa fictícia; valores demonstrativos, sem observação empresarial.';
  const metadata = baseline?.model?.metadata || {};
  const derived = metadata.derived_baseline || {};
  if (derived.active || derived.calculation_method === 'parametric_recomputation') {
    return 'Baseline recalculado por modelo; proxies e limites permanecem no contrato de origem.';
  }
  const breakdown = baseline?.costs?.cost_breakdown || [];
  if (
    breakdown.some((item) =>
      /proxy|heuristic|fallback|recomputed/i.test(String(item?.source || ''))
    )
  ) {
    return 'Composição calculada pelo modelo com itens classificados como proxy/fallback na origem.';
  }
  return 'Valores publicados no baseline selecionado; a origem não declara aqui uma série histórica.';
}

function renderCostCharts(state, baseline) {
  const baseCosts = getCosts(baseline);
  const baseEntries = COST_COMPONENTS.map(([label, key]) => [
    label,
    finite(baseCosts?.[key]),
  ]).filter(([, value]) => value != null);
  const hasBaseCosts = baseEntries.length > 0;
  setCanvasVisible('niOverviewCostCompositionChart', hasBaseCosts);
  if (!hasBaseCosts) {
    chartCaption(
      'niOverviewCostCompositionChart',
      'Sem componente numérico de custo publicado no baseline selecionado.'
    );
  }

  if (hasBaseCosts) {
    renderBarChart('niOverviewCostCompositionChart', {
      title: 'Composição publicada no baseline',
      labels: baseEntries.map(([label]) => label),
      datasets: [
        { label: 'R$', data: baseEntries.map(([, value]) => value), backgroundColor: '#0c7878' },
      ],
      yFormat: 'money',
      xFormat: 'money',
      indexAxis: 'y',
    });
    chartCaption(
      'niOverviewCostCompositionChart',
      `Componentes disponíveis: ${baseEntries.length}/${COST_COMPONENTS.length}. ${baselineSourceLabel(baseline)}`,
      `${baseEntries.length}/${COST_COMPONENTS.length} componentes · ${state?.context?.provider_kind === 'mock' ? 'dados demonstrativos' : 'baseline carregado'}`
    );
  }

  const selected = selectActiveScenario(state);
  const result = state?.data?.scenario_result;
  const activeCosts = getCosts(result);
  const hasScenario = Boolean(selected && result && selected.scenario_type !== 'baseline');
  const completeComparison =
    hasScenario &&
    COST_COMPONENTS.every(
      ([, key]) => finite(baseCosts?.[key]) != null && finite(activeCosts?.[key]) != null
    );
  setCanvasVisible('niOverviewCostComparisonChart', completeComparison);
  if (completeComparison) {
    const deltas = COST_COMPONENTS.map(
      ([, key]) => finite(baseCosts[key]) - finite(activeCosts[key])
    );
    renderBarChart('niOverviewCostComparisonChart', {
      title: `Economia (+) / aumento de custo (−) · ${selected.scenario_name || selected.scenario_id || 'cenário ativo'}`,
      labels: COST_COMPONENTS.map(([label]) => label),
      datasets: [
        {
          label: 'Baseline − cenário · economia (+) / aumento (−)',
          data: deltas,
          backgroundColor: deltas.map((delta) => (delta >= 0 ? '#0c7878' : '#b42318')),
        },
      ],
      yFormat: 'money',
      xFormat: 'money',
      indexAxis: 'y',
    });
    chartCaption(
      'niOverviewCostComparisonChart',
      `Delta = baseline − cenário calculado. Valores positivos indicam economia; negativos indicam aumento de custo. ${baselineSourceLabel(baseline)}`,
      'Economia (+) / aumento (−) · custos calculados'
    );
  } else {
    chartCaption(
      'niOverviewCostComparisonChart',
      'Sem cenário ativo com custos por componente suficientes para comparação. A página não estima diferenças a partir de multiplicadores.'
    );
  }
}

function buildWeightDistanceDistribution(flows) {
  const eligible = flows.filter(isDistributionFlow);
  const bins = [0, 0, 0, 0, 0];
  const labels = ['0–100 km', '100–300 km', '300–600 km', '600–1.000 km', '1.000+ km'];
  let weightKnown = 0;
  let distanceKnown = 0;
  let paired = 0;
  let coveredWeight = 0;
  let proxyFlows = 0;

  eligible.forEach((flow) => {
    if (flowType(flow) === 'cd_to_destination_proxy') proxyFlows += 1;
    // `volume` is deliberately excluded: its unit is not guaranteed to be kg.
    const kg = finite(flow?.annual_weight_kg ?? flow?.weight_kg);
    const km = finite(flow?.distance_km);
    if (kg != null && kg > 0) weightKnown += kg;
    if (km != null && km > 0) distanceKnown += 1;
    if (!(kg > 0) || !(km > 0)) return;
    paired += 1;
    coveredWeight += kg;
    const bucket = km <= 100 ? 0 : km <= 300 ? 1 : km <= 600 ? 2 : km <= 1000 ? 3 : 4;
    bins[bucket] += kg;
  });

  return {
    eligibleCount: eligible.length,
    bins,
    labels,
    paired,
    weightKnown,
    distanceKnown,
    coveredWeight,
    proxyFlows,
    weightCoverage: weightKnown > 0 ? coveredWeight / weightKnown : null,
  };
}

function renderWeightDistance(state, baseline) {
  const flows = Array.isArray(baseline?.flows) ? baseline.flows : [];
  const distribution = buildWeightDistanceDistribution(flows);
  setCanvasVisible('niWeightDistanceChart', distribution.coveredWeight > 0);
  if (distribution.coveredWeight > 0) {
    renderBarChart('niWeightDistanceChart', {
      title: 'Peso conhecido por distância',
      labels: distribution.labels,
      datasets: [{ label: 'Peso (kg)', data: distribution.bins, backgroundColor: '#0c7878' }],
      yFormat: 'number',
    });
  }
  const source =
    state?.context?.provider_kind === 'mock'
      ? 'Fixture sintética demonstrativa'
      : 'Fluxos do baseline carregado';
  const coverageText = distribution.eligibleCount
    ? `${source}: ${distribution.paired}/${distribution.eligibleCount} fluxo(s) de distribuição têm peso (kg) e distância explícitos; distância informada em ${distribution.distanceKnown}/${distribution.eligibleCount}. Cobertura de peso pareado: ${distribution.weightCoverage == null ? 'indisponível' : `${(distribution.weightCoverage * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}. ${distribution.proxyFlows ? `${distribution.proxyFlows} fluxo(s) têm tipo marcado como proxy.` : ''} Fluxos sem os dois campos não entram nas barras.`
    : `${source}: nenhum fluxo de distribuição elegível; fluxos de abastecimento são excluídos para não duplicar a rede de distribuição.`;
  if (!(distribution.coveredWeight > 0)) {
    chartCaption(
      'niWeightDistanceChart',
      distribution.eligibleCount
        ? `${coverageText} Sem peso explícito em kg e distância positiva suficientes, o gráfico fica oculto.`
        : `${coverageText} Gráfico oculto por falta de registros elegíveis.`
    );
    return;
  }
  chartCaption(
    'niWeightDistanceChart',
    coverageText,
    `${distribution.paired}/${distribution.eligibleCount} fluxos com peso e distância${distribution.proxyFlows ? ' · inclui proxies' : ''}`
  );
}

function buildCdDistributionCost(baseline) {
  const flows = Array.isArray(baseline?.flows) ? baseline.flows : [];
  const details = Array.isArray(baseline?.costs?.flow_cost_detail)
    ? baseline.costs.flow_cost_detail
    : [];
  const flowById = new Map(
    flows.map((flow) => [flow?.flow_id ?? flow?.id, flow]).filter(([id]) => id != null)
  );
  const byCd = new Map();
  let joined = 0;
  details.forEach((detail) => {
    const amount = finite(detail?.distribution_cost);
    if (amount == null) return;
    const flow = flowById.get(detail?.flow_id);
    if (!flow || !isDistributionFlow(flow)) return;
    const cd = flow.cd || flow.assigned_cd || flow.cd_name || detail.cd;
    if (!cd) return;
    joined += 1;
    byCd.set(cd, (byCd.get(cd) || 0) + amount);
  });
  return {
    rows: [...byCd.entries()].sort((a, b) => b[1] - a[1]),
    joined,
    eligible: flows.filter(isDistributionFlow).length,
    proxyFlows: flows.filter((flow) => flowType(flow) === 'cd_to_destination_proxy').length,
  };
}

function buildFlowCountByCd(flows = []) {
  const eligible = flows.filter(isDistributionFlow);
  const byCd = new Map();
  let missingCd = 0;
  eligible.forEach((flow) => {
    const cd = flow?.cd || flow?.assigned_cd || flow?.cd_name;
    if (!cd) {
      missingCd += 1;
      return;
    }
    byCd.set(cd, (byCd.get(cd) || 0) + 1);
  });
  return {
    rows: [...byCd.entries()].sort((a, b) => b[1] - a[1]),
    eligible: eligible.length,
    counted: eligible.length - missingCd,
    missingCd,
  };
}

function renderCdDistributionCost(state, baseline) {
  const result = buildCdDistributionCost(baseline);
  const available = result.rows.length > 0 && result.rows.some(([, cost]) => cost > 0);
  setCanvasVisible('niOverviewCdCostChart', available);
  if (available) {
    const rows = result.rows;
    renderBarChart('niOverviewCdCostChart', {
      title: 'Custo de distribuição modelado por CD',
      labels: rows.map(([cd]) => String(cd)),
      datasets: [{ label: 'R$', data: rows.map(([, cost]) => cost), backgroundColor: '#0c7878' }],
      yFormat: 'money',
      xFormat: 'money',
      indexAxis: 'y',
    });
  }
  const status = baselineSourceLabel(baseline);
  const origin =
    state?.context?.provider_kind === 'mock'
      ? 'Fixture sintética demonstrativa'
      : 'Detalhes de custo do baseline carregado';
  chartCaption(
    'niOverviewCdCostChart',
    available
      ? `${origin}: ${result.joined}/${result.eligible} fluxo(s) de distribuição associados a CD. ${result.proxyFlows ? `${result.proxyFlows} fluxo(s) têm tipo marcado como proxy.` : ''} Valores são custo modelado por fluxo, não tarifa observada por CD. ${status}`
      : `${origin}: sem custo positivo detalhado por fluxo e associado a CD; concentração não calculada. Gráfico oculto.`,
    available
      ? `${result.joined}/${result.eligible} fluxos associados · custo modelado`
      : 'Sem detalhamento por CD'
  );
}

function finiteRatio(value) {
  const number = finite(value);
  return number != null && number >= 0 && number <= 1 ? number : null;
}

function scalarText(value) {
  return ['string', 'number'].includes(typeof value) && value !== '' ? String(value) : '';
}

function baselineBelongsToActiveCompany(state, baseline) {
  const activeCompany = selectActiveCompany(state);
  const baselineCompany =
    baseline?.company_id || baseline?.model?.company_id || baseline?.provenance?.company_id;
  return Boolean(activeCompany && baselineCompany === activeCompany);
}

function buildTaxCoverageSeries(tax = {}) {
  const contract = tax.tax_period_contract || tax.metadata?.tax_period_contract || {};
  const periods = Array.isArray(contract.available_periods) ? contract.available_periods : [];
  const rows = periods
    .filter((period) => period && typeof period === 'object' && !Array.isArray(period))
    .map((period) => ({
      label: [scalarText(period.year), scalarText(period.phase)].filter(Boolean).join(' · '),
      current: finiteRatio(period.current_tax_weight),
      reform: finiteRatio(period.reform_tax_weight),
    }))
    .filter((period) => period.label && (period.current != null || period.reform != null));
  return {
    rows,
    currentCount: rows.filter((period) => period.current != null).length,
    reformCount: rows.filter((period) => period.reform != null).length,
    pairedCount: rows.filter((period) => period.current != null && period.reform != null).length,
  };
}

function renderTaxCoverageChart(tax) {
  const canvasId = 'niOverviewTaxCoverageChart';
  const result = buildTaxCoverageSeries(tax);
  const currentAvailable = result.currentCount > 0;
  const reformAvailable = result.reformCount > 0;
  const available = result.rows.length > 0;
  setCanvasVisible(canvasId, available);
  if (available) {
    renderBarChart(canvasId, {
      title: 'Pesos tributários publicados por período',
      labels: result.rows.map((period) => period.label),
      datasets: [
        ...(currentAvailable
          ? [
              {
                label: 'Regime atual',
                data: result.rows.map((period) =>
                  period.current == null ? null : period.current * 100
                ),
                backgroundColor: '#0c7878',
              },
            ]
          : []),
        ...(reformAvailable
          ? [
              {
                label: 'Regime da reforma',
                data: result.rows.map((period) =>
                  period.reform == null ? null : period.reform * 100
                ),
                backgroundColor: '#00a189',
              },
            ]
          : []),
      ],
      yFormat: 'percent',
    });
  }
  const caption = available
    ? `${result.pairedCount}/${result.rows.length} períodos têm pesos publicados para os dois regimes; atual informado em ${result.currentCount} e reforma em ${result.reformCount}. Campos ausentes não são estimados.`
    : 'Sem pesos tributários por período no contrato da empresa ativa; a comparação não é calculada.';
  chartCaption(
    canvasId,
    caption,
    available
      ? `${result.pairedCount}/${result.rows.length} períodos com ambos os pesos`
      : 'Sem pesos por período'
  );
}

function renderFlowCountByCd(state, baseline) {
  const flows = Array.isArray(baseline?.flows) ? baseline.flows : [];
  const result = buildFlowCountByCd(flows);
  const available = result.rows.length > 0;
  setCanvasVisible('niFlowCountByCdChart', available);
  if (available) {
    renderBarChart('niFlowCountByCdChart', {
      title: 'Fluxos de distribuição por CD',
      labels: result.rows.map(([cd]) => String(cd)),
      datasets: [
        {
          label: 'Fluxos',
          data: result.rows.map(([, count]) => count),
          backgroundColor: '#0c7878',
        },
      ],
      yFormat: 'number',
      indexAxis: 'y',
    });
  }
  const source =
    state?.context?.provider_kind === 'mock'
      ? 'Fixture sintética demonstrativa'
      : 'Fluxos do baseline carregado';
  chartCaption(
    'niFlowCountByCdChart',
    result.eligible
      ? `${source}: ${result.counted}/${result.eligible} registros elegíveis de distribuição associados a CD; ${result.missingCd} sem CD informado. Cada barra conta registros de fluxo, sem usar volume, demanda ou peso.`
      : `${source}: nenhum registro elegível de fluxo de distribuição para contar por CD; tipos de abastecimento ficam fora desta contagem.`,
    available
      ? `${result.counted}/${result.eligible} registros com CD${result.missingCd ? ` · ${result.missingCd} sem CD` : ''}`
      : 'Sem fluxos elegíveis'
  );
}

/** Draw overview-only, selected-provider analytics into canvases rendered by overview pages. */
export function renderOverviewAnalytics(state) {
  const costChartIds = ['niOverviewCostCompositionChart', 'niOverviewCostComparisonChart'];
  const networkChartIds = [
    'niWeightDistanceChart',
    'niOverviewCdCostChart',
    'niFlowCountByCdChart',
  ];
  const hasTaxCanvas = Boolean(document.getElementById('niOverviewTaxCoverageChart'));
  const hasCostCanvases = costChartIds.some((id) => document.getElementById(id));
  const hasNetworkCanvases = networkChartIds.some((id) => document.getElementById(id));
  if (!hasCostCanvases && !hasNetworkCanvases && !hasTaxCanvas) return;
  const baseline = selectBaseline(state);
  if (!baseline) return;
  if (hasCostCanvases) renderCostCharts(state, baseline);
  if (hasNetworkCanvases) {
    renderWeightDistance(state, baseline);
    renderCdDistributionCost(state, baseline);
    renderFlowCountByCd(state, baseline);
  }
  if (hasTaxCanvas) {
    if (!baselineBelongsToActiveCompany(state, baseline)) {
      setCanvasVisible('niOverviewTaxCoverageChart', false);
      chartCaption(
        'niOverviewTaxCoverageChart',
        'Baseline pertence a outra empresa. Recarregue a empresa ativa para consultar seus dados fiscais.',
        'Empresa ativa indisponível'
      );
    } else {
      renderTaxCoverageChart(baseline?.tax_results?.tax_results || {});
      const prefix =
        state?.context?.provider_kind === 'mock' || selectActiveCompany(state) === 'empresa_mock'
          ? 'Demonstração · empresa fictícia.'
          : 'Empresa ativa.';
      const canvas = document.getElementById('niOverviewTaxCoverageChart');
      const caption = canvas?.parentElement?.querySelector(
        '[data-chart-caption="niOverviewTaxCoverageChart"]'
      );
      if (caption) caption.textContent = `${prefix} ${caption.textContent}`;
    }
  }
}

export const overviewAnalyticsInternals = Object.freeze({
  isDistributionFlow,
  buildWeightDistanceDistribution,
  buildCdDistributionCost,
  buildFlowCountByCd,
  buildTaxCoverageSeries,
});
