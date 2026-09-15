import { buildExecutiveReportHtml } from './executive-report-builder.js';

const PROTECTED_EXPORT_COMPANIES = new Set(['empresa1', 'empresa2']);
const PROTECTED_EXPORT_REDACTED_KEYS = new Set([
  'flows',
  'flow_results',
  'flow_table',
  'raw_evidence',
  'raw_data',
  'raw_rows',
  'core_data',
  'baseline',
  'baseline_result',
  'baseline_data',
  'baseline_bundle',
  'baselinebundle',
  'source_exports',
  'source_files',
  'source_payload',
  'input_data',
  'records',
  'plaintext',
  'ciphertext',
  'password',
  'secret',
  'access_token',
  'api_key',
  'key_material',
]);
const PROTECTED_EXPORT_SOURCE_KEYS = new Set([
  'data_sources',
  'source',
  'source_ref',
  'source_file',
  'source_path',
  'reference_source',
  'bridge_source_ref',
  'original_path',
  'encrypted_path',
  'file_path',
  'manifest_path',
  'input_source',
  'path',
]);
const PROTECTED_SOURCE_PATH = /(?:^|[\\/])data[\\/](?:empresa1|empresa2)(?:[\\/]|$)/i;
const PROTECTED_EXPORT_NOTICE = 'Fonte protegida (detalhes no pacote de exportação)';

function isProtectedExport(companyId) {
  return PROTECTED_EXPORT_COMPANIES.has(String(companyId || '').toLowerCase());
}

function sanitizeExportString(value, protectedExport) {
  if (!protectedExport || !PROTECTED_SOURCE_PATH.test(value)) return value;
  return PROTECTED_EXPORT_NOTICE;
}

/**
 * Keeps decision aggregates and traceability metadata exportable while
 * removing protected tenant payloads that are only needed inside the runtime.
 * This is intentionally applied before JSON, HTML and CSV generation so no
 * export format can bypass the protected-data boundary.
 */
export function sanitizeExportValue(value, { companyId } = {}, key = '') {
  const protectedExport = isProtectedExport(companyId);
  if (!protectedExport) return value;
  if (value === null || value === undefined) return value;
  const normalizedKey = String(key || '').toLowerCase();
  if (normalizedKey && PROTECTED_EXPORT_REDACTED_KEYS.has(normalizedKey)) return undefined;
  if (normalizedKey && PROTECTED_EXPORT_SOURCE_KEYS.has(normalizedKey)) {
    return Array.isArray(value)
      ? value.map(() => PROTECTED_EXPORT_NOTICE)
      : PROTECTED_EXPORT_NOTICE;
  }
  if (typeof value === 'string') return sanitizeExportString(value, protectedExport);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeExportValue(item, { companyId }, key))
      .filter((item) => item !== undefined);
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([entryKey]) => !PROTECTED_EXPORT_REDACTED_KEYS.has(entryKey.toLowerCase()))
      .map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeExportValue(entryValue, { companyId }, entryKey),
      ])
      .filter(([, entryValue]) => entryValue !== undefined)
  );
}

const EXPORT_CONTEXT_COLUMNS = [
  'company_id',
  'scenario_id',
  'evidence_score',
  'evidence_status',
  'evidence_blockers',
  'tax_source_classification',
  'tax_coverage_pct',
  'tax_eligible_flow_coverage_pct',
  'tax_input_coverage_ratio',
  'tax_eligible_coverage_ratio',
  'tax_destination_coverage_ratio',
  'tax_origin_coverage_ratio',
  'tax_revenue_coverage_ratio',
  'tax_complete_fiscal_coverage_ratio',
  'tax_eligible_flow_count',
  'tax_uncovered_flow_count',
  'tax_missing_origin_uf_count',
  'fiscal_classification_coverage',
  'tax_observed_flow_count',
  'tax_calculation_mode',
  'tax_precision_mode',
  'tax_coverage_status',
  'tax_decision_use',
  'tax_study_id',
  'tax_warning_count',
  'tax_selected_period_year',
  'tax_selected_period_source_status',
  'tax_available_period_count',
  'tax_reference_period_start',
  'tax_reference_period_end',
  'tax_observed_data_period_status',
  'uncertainty_source',
  'monte_carlo_decision_use',
  'historical_distribution',
  'monte_carlo_probability_positive',
  'robustness_score',
  'conditional_robustness_score',
  'certified_robustness_score',
  'robustness_interpretation',
  'optimizer_coverage_ratio',
  'optimizer_exact_search_space',
];
const STRESS_EXPORT_COLUMNS = [
  ...EXPORT_CONTEXT_COLUMNS,
  'case_id',
  'case_name',
  'stressed_scenario_id',
  'status',
  'data_quality_status',
  'decision_use',
  'total_with_tax',
  'total_logistics_cost',
  'tax_impact',
  'saving_vs_baseline',
  'saving_pct',
  'scenario_still_better_than_baseline',
  'warning_count',
  'error_count',
];
const SENSITIVITY_EXPORT_COLUMNS = [
  ...EXPORT_CONTEXT_COLUMNS,
  'variable',
  'value',
  'total_with_tax',
  'saving_abs',
  'saving_pct',
  'warning_count',
  'error_count',
];

function messageCount(value) {
  return Array.isArray(value) ? value.length : value ? 1 : 0;
}

function projectCsvRow(row, exportContext, columns) {
  const safeRow = { ...exportContext, ...row };
  safeRow.warning_count = messageCount(row?.warnings);
  safeRow.error_count = messageCount(row?.errors);
  return Object.fromEntries(columns.map((column) => [column, safeRow[column] ?? null]));
}

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
  const taxPeriodContract = tax.tax_period_contract || tax.metadata?.tax_period_contract || {};
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
    tax_destination_coverage_ratio: tax.tax_coverage?.destination_coverage_ratio ?? null,
    tax_origin_coverage_ratio: tax.tax_coverage?.origin_coverage_ratio ?? null,
    tax_revenue_coverage_ratio: tax.tax_coverage?.revenue_coverage_ratio ?? null,
    tax_complete_fiscal_coverage_ratio: tax.tax_coverage?.complete_fiscal_coverage_ratio ?? null,
    tax_eligible_flow_count: tax.tax_coverage?.eligible_flow_count ?? null,
    tax_uncovered_flow_count: tax.tax_coverage?.uncovered_flow_count ?? null,
    tax_missing_origin_uf_count: tax.tax_coverage?.missing_origin_uf_count ?? null,
    fiscal_classification_coverage: tax.tax_coverage?.fiscal_classification_coverage ?? null,
    tax_observed_flow_count: tax.tax_input_match_summary?.observed_flow_count ?? null,
    tax_calculation_mode: tax.calculation_mode || null,
    tax_precision_mode: tax.precision_mode || null,
    tax_coverage_status: tax.tax_coverage?.coverage_status || null,
    tax_decision_use: tax.decision_use || null,
    tax_study_id: tax.tax_study?.study_id || null,
    tax_warning_count: Array.isArray(tax.warnings) ? tax.warnings.length : null,
    tax_selected_period_year: taxPeriodContract.selected_period?.year ?? null,
    tax_selected_period_source_status: taxPeriodContract.selected_period?.source_status || null,
    tax_available_period_count: taxPeriodContract.available_periods?.length ?? null,
    tax_reference_period_start:
      taxPeriodContract.current_reference_data_period?.period_start || null,
    tax_reference_period_end: taxPeriodContract.current_reference_data_period?.period_end || null,
    tax_observed_data_period_status: taxPeriodContract.observed_data_coverage?.status || null,
    uncertainty_source: monteCarlo.uncertainty_source || null,
    monte_carlo_decision_use: monteCarlo.decision_use || null,
    historical_distribution: monteCarlo.historical_distribution ?? null,
    monte_carlo_probability_positive: monteCarlo.probability_saving_positive ?? null,
    robustness_score: robustness?.robustness_score ?? null,
    conditional_robustness_score: robustness?.conditional_robustness_score ?? null,
    certified_robustness_score: robustness?.certified_robustness_score ?? null,
    robustness_interpretation: robustness?.robustness_interpretation || null,
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
  const safeDecisionPackage = sanitizeExportValue(decisionPackage, { companyId });
  const safeStress = sanitizeExportValue(stress, { companyId });
  const safeSensitivity = sanitizeExportValue(sensitivity, { companyId });
  const safeSensitivityMatrix = sanitizeExportValue(sensitivityMatrix, { companyId });
  const safeAudit = sanitizeExportValue(audit, { companyId });
  const safeRecommendation = sanitizeExportValue(recommendation, { companyId });
  const safeSelectedScenario = sanitizeExportValue(selectedScenario, { companyId });
  const safeComparison = sanitizeExportValue(comparison, { companyId });
  const safeRobustness = sanitizeExportValue(robustness, { companyId });
  const safeWorkbookParity = sanitizeExportValue(workbookParity, { companyId });
  const safeRankingSensitivity = sanitizeExportValue(rankingSensitivity, { companyId });
  const safeFinalQA = sanitizeExportValue(finalQA, { companyId });
  const safeRelease = sanitizeExportValue(release, { companyId });
  const monteCarlo =
    safeSelectedScenario?.monte_carlo || safeSelectedScenario?.scenario?.monte_carlo || null;
  const html = buildExecutiveReportHtml({
    companyId,
    selectedScenario: safeSelectedScenario,
    recommendation: safeRecommendation,
    stress: safeStress,
    robustness: safeRobustness,
    audit: safeAudit,
    comparison: safeComparison,
    workbookParity: safeWorkbookParity,
    rankingSensitivity: safeRankingSensitivity,
  });
  const json = JSON.stringify(
    {
      company_id: companyId,
      export_policy: isProtectedExport(companyId) ? 'protected_aggregate_only' : 'demo_fixture',
      decision_package: safeDecisionPackage,
      selected_scenario: safeSelectedScenario
        ? {
            scenario_id:
              safeSelectedScenario.scenario_id || safeSelectedScenario.scenario?.scenario_id,
            scenario: safeSelectedScenario.scenario || null,
            result: safeSelectedScenario.result || null,
            quality: safeSelectedScenario.quality || null,
            monte_carlo: monteCarlo,
          }
        : null,
      recommendation: safeRecommendation,
      stress: safeStress,
      sensitivity: safeSensitivity,
      sensitivity_matrix: safeSensitivityMatrix,
      robustness: safeRobustness,
      audit: safeAudit,
      workbook_parity: safeWorkbookParity,
      monte_carlo: monteCarlo,
      final_qa: safeFinalQA,
      release: safeRelease,
      financial_summary: {
        baseline_total: safeComparison?.baseline_total ?? null,
        scenario_total: safeComparison?.scenario_total ?? null,
        saving_abs: safeComparison?.saving_abs ?? null,
        saving_pct: safeComparison?.saving_pct ?? null,
        components: safeSelectedScenario?.result?.costs || safeSelectedScenario?.costs || null,
      },
      comparison: safeComparison,
    },
    null,
    2
  );
  const exportContext = buildExportContext({
    selectedScenario: safeSelectedScenario,
    audit: safeAudit,
    robustness: safeRobustness,
  });
  const csv = toCsv(
    (safeStress?.stress_results || []).map((row) =>
      projectCsvRow(row, exportContext, STRESS_EXPORT_COLUMNS)
    ),
    STRESS_EXPORT_COLUMNS
  );
  const sensitivityCsv = toCsv(
    [
      ...(safeSensitivity?.sensitivity_results || []).map((row) =>
        projectCsvRow(row, exportContext, SENSITIVITY_EXPORT_COLUMNS)
      ),
      ...(safeSensitivityMatrix?.matrix_results || []).map((row) =>
        projectCsvRow(row, exportContext, SENSITIVITY_EXPORT_COLUMNS)
      ),
    ],
    SENSITIVITY_EXPORT_COLUMNS
  );
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
