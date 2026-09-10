import { buildExecutiveReportHtml } from './executive-report-builder.js';
function toCsv(rows) {
  if (!rows?.length) return 'empty\n';
  const cols = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];
  const cell = (value) => {
    const normalized =
      value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
    return `"${normalized.replace(/"/g, '""')}"`;
  };
  return [cols.map(cell).join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join(
    '\n'
  );
}

function buildExportContext({ selectedScenario, audit, robustness } = {}) {
  const result = selectedScenario?.result || selectedScenario || {};
  const tax = result.tax_results || {};
  const evidence = result.evidence || selectedScenario?.evidence || {};
  const monteCarlo =
    selectedScenario?.monte_carlo?.summary ||
    selectedScenario?.scenario?.monte_carlo?.summary ||
    {};
  const optimization = audit?.optimization || {};
  return {
    company_id: result.company_id || selectedScenario?.company_id || null,
    scenario_id: result.scenario_id || selectedScenario?.scenario_id || null,
    evidence_score: evidence.evidence_score ?? null,
    evidence_status: evidence.evidence_status || null,
    evidence_blockers: (evidence.blockers || []).join(' | '),
    tax_source_classification: tax.tax_source_classification || null,
    tax_coverage_pct: tax.tax_coverage?.complete_fiscal_coverage_pct ?? null,
    tax_eligible_flow_coverage_pct: tax.tax_coverage?.eligible_flow_coverage_pct ?? null,
    tax_input_coverage_ratio: tax.tax_coverage?.input_coverage_ratio ?? null,
    tax_eligible_coverage_ratio: tax.tax_coverage?.eligible_coverage_ratio ?? null,
    tax_complete_fiscal_coverage_ratio: tax.tax_coverage?.complete_fiscal_coverage_ratio ?? null,
    tax_eligible_flow_count: tax.tax_coverage?.eligible_flow_count ?? null,
    tax_uncovered_flow_count: tax.tax_coverage?.uncovered_flow_count ?? null,
    tax_missing_origin_uf_count: tax.tax_coverage?.missing_origin_uf_count ?? null,
    fiscal_classification_coverage: tax.tax_coverage?.fiscal_classification_coverage ?? null,
    tax_observed_flow_count: tax.tax_input_match_summary?.observed_flow_count ?? null,
    tax_calculation_mode: tax.calculation_mode || null,
    tax_precision_mode: tax.precision_mode || null,
    tax_warning_count: Array.isArray(tax.warnings) ? tax.warnings.length : null,
    tax_selected_period_year: tax.tax_period_contract?.selected_period?.year ?? null,
    tax_selected_period_source_status:
      tax.tax_period_contract?.selected_period?.source_status || null,
    tax_available_period_count: tax.tax_period_contract?.available_periods?.length ?? null,
    tax_reference_period_start:
      tax.tax_period_contract?.current_reference_data_period?.period_start || null,
    tax_reference_period_end:
      tax.tax_period_contract?.current_reference_data_period?.period_end || null,
    tax_observed_data_period_status:
      tax.tax_period_contract?.observed_data_coverage?.status || null,
    uncertainty_source: monteCarlo.uncertainty_source || null,
    historical_distribution: monteCarlo.historical_distribution ?? null,
    monte_carlo_probability_positive: monteCarlo.probability_saving_positive ?? null,
    robustness_score: robustness?.robustness_score ?? null,
    optimizer_coverage_ratio: optimization.coverage_ratio ?? null,
    optimizer_exact_search_space: optimization.exact_search_space ?? null,
  };
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
  finalQA = null,
  release = null,
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
      final_qa: finalQA,
      release,
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
  const exportContext = buildExportContext({ selectedScenario, audit, robustness });
  const csv = toCsv((stress?.stress_results || []).map((row) => ({ ...exportContext, ...row })));
  const sensitivityCsv = toCsv([
    ...(sensitivity?.sensitivity_results || []).map((row) => ({ ...exportContext, ...row })),
    ...(sensitivityMatrix?.matrix_results || []).map((row) => ({ ...exportContext, ...row })),
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
