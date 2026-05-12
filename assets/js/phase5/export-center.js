import { buildExecutiveReportHtml } from './executive-report-builder.js';
function toCsv(rows) { if (!rows?.length) return 'empty\n'; const cols = Object.keys(rows[0]); return [cols.join(','), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n'); }
export function buildExportPackage({ companyId, decisionPackage, stress, sensitivity, sensitivityMatrix, audit, recommendation, selectedScenario, comparison, robustness, workbookParity } = {}) {
  const html = buildExecutiveReportHtml({ companyId, selectedScenario, recommendation, stress, robustness, audit, comparison, workbookParity });
  const json = JSON.stringify({ company_id: companyId, decision_package: decisionPackage, recommendation, stress, sensitivity, sensitivity_matrix: sensitivityMatrix, robustness, audit, workbook_parity: workbookParity }, null, 2);
  const csv = toCsv(stress?.stress_results || []);
  const sensitivityCsv = toCsv([...(sensitivity?.sensitivity_results || []), ...(sensitivityMatrix?.matrix_results || [])]);
  return {
    export_status: 'ready',
    files: [
      { filename: `${companyId}_decision_package.json`, type: 'application/json', content: json },
      { filename: `${companyId}_stress_results.csv`, type: 'text/csv', content: csv },
      { filename: `${companyId}_sensitivity_results.csv`, type: 'text/csv', content: sensitivityCsv },
      { filename: `${companyId}_executive_report.html`, type: 'text/html', content: html }
    ],
    warnings: [], errors: []
  };
}
export function triggerBrowserDownload(filename, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
