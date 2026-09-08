import { buildExecutiveReportHtml } from './executive-report-builder.js';
function toCsv(rows) {
  if (!rows?.length) return 'empty\n';
  const cols = Object.keys(rows[0]);
  return [
    cols.join(','),
    ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(',')),
  ].join('\n');
}
export function buildExportPackage({
  companyId,
  decisionPackage,
  stress,
  sensitivity,
  sensitivityMatrix,
  audit,
  recommendation,
  selectedScenario,
  comparison,
  robustness,
  workbookParity,
  rankingSensitivity,
} = {}) {
  const monteCarlo =
    selectedScenario?.monte_carlo || selectedScenario?.scenario?.monte_carlo || null;
  const html = buildExecutiveReportHtml({
    companyId,
    selectedScenario,
    recommendation,
    stress,
    robustness,
    audit,
    comparison,
    workbookParity,
    rankingSensitivity,
  });
  const json = JSON.stringify(
    {
      company_id: companyId,
      decision_package: decisionPackage,
      selected_scenario: selectedScenario
        ? {
            scenario_id: selectedScenario.scenario_id || selectedScenario.scenario?.scenario_id,
            scenario: selectedScenario.scenario || null,
            result: selectedScenario.result || null,
            quality: selectedScenario.quality || null,
            monte_carlo: monteCarlo,
          }
        : null,
      recommendation,
      stress,
      sensitivity,
      sensitivity_matrix: sensitivityMatrix,
      robustness,
      audit,
      workbook_parity: workbookParity,
      monte_carlo: monteCarlo,
      financial_summary: {
        baseline_total: comparison?.baseline_total ?? null,
        scenario_total: comparison?.scenario_total ?? null,
        saving_abs: comparison?.saving_abs ?? null,
        saving_pct: comparison?.saving_pct ?? null,
        components: selectedScenario?.result?.costs || selectedScenario?.costs || null,
      },
      comparison,
    },
    null,
    2
  );
  const csv = toCsv(stress?.stress_results || []);
  const sensitivityCsv = toCsv([
    ...(sensitivity?.sensitivity_results || []),
    ...(sensitivityMatrix?.matrix_results || []),
  ]);
  return {
    export_status: 'ready',
    files: [
      { filename: `${companyId}_decision_package.json`, type: 'application/json', content: json },
      { filename: `${companyId}_stress_results.csv`, type: 'text/csv', content: csv },
      {
        filename: `${companyId}_sensitivity_results.csv`,
        type: 'text/csv',
        content: sensitivityCsv,
      },
      { filename: `${companyId}_executive_report.html`, type: 'text/html', content: html },
    ],
    warnings: [],
    errors: [],
  };
}
export function triggerBrowserDownload(filename, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
