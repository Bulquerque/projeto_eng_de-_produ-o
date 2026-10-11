export function createChartPipeline({
  overview,
  decision,
  trust,
  bindMap,
  cost,
  volume,
  distance,
  risk,
  sensitivity,
  histogram,
  cdf,
  totalCurve,
  drivers,
  scatter,
  probability,
  ranking,
}) {
  return ({ root, path, state }) => {
    overview(state);
    decision(state);
    trust(state);
    bindMap(root);

    if (path === '/network/overview/costs')
      cost('niCostChart', state.data.scenario_result || state.data.baseline);

    if (path === '/network/overview/network') {
      const flows = state.data.baseline?.flows || [];
      volume('niVolumeByCdChart', flows);
      distance('niDistanceHistogramChart', flows);
    }

    if (path.includes('/risk')) {
      const monteCarlo = state.data.monte_carlo;
      risk('niRiskChart', monteCarlo);
      sensitivity('niSensitivityChart', state.data.sensitivity);
      histogram('niRiskHistogramChart', monteCarlo);
      cdf('niRiskCdfChart', monteCarlo);
      totalCurve('niRiskTotalChart', monteCarlo);
      drivers('niRiskDriversChart', monteCarlo);
      scatter('niRiskScatterChart', monteCarlo);
      probability('niRiskProbabilityChart', monteCarlo);
    }

    if (path === '/network/optimizer/results') ranking('niRankingChart', state.data.optimizer);
  };
}
