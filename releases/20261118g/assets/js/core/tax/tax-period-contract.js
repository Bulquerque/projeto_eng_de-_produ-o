const SOURCE_CONFIDENCE = 'external_official';

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeYear(value) {
  const year = Number(value);
  return Number.isInteger(year) ? year : null;
}

function timelinePeriod(row = {}) {
  const year = normalizeYear(row.ano ?? row.year);
  return {
    period_id: year == null ? null : `tax_reform_timeline_${year}`,
    year,
    phase: row.fase || row.phase || null,
    current_tax_weight: numberOrNull(row.peso_icms_iss_regime_atual ?? row.current_tax_weight),
    reform_tax_weight: numberOrNull(row.peso_ibs_regime_novo ?? row.reform_tax_weight),
    cbs_status: row.cbs_status || null,
    ibs_status: row.ibs_status || null,
    is_status: row.is_status || null,
    pis_cofins_status: row.pis_cofins_status || null,
    ipi_status: row.ipi_status || null,
    operational_hypothesis: row.hipotese_operacional_para_malha || null,
    source_ref: row.fonte_principal || null,
    source_confidence: SOURCE_CONFIDENCE,
    source_catalog_ref: 'rf_entenda_reforma',
    notes: row.observacoes || null,
    data_status: 'official_reference_timeline',
  };
}

function selectedBridge({ regimeId, year, sourceContext }) {
  const bridge = Array.isArray(sourceContext?.tax_scenario_bridge)
    ? sourceContext.tax_scenario_bridge
    : [];
  const normalizedYear = normalizeYear(year);
  return (
    bridge.find(
      (row) => normalizeYear(row.scenario_year) === normalizedYear && row.tax_regime === regimeId
    ) ||
    bridge.find((row) => normalizeYear(row.scenario_year) === normalizedYear) ||
    bridge.find((row) => row.tax_regime === regimeId) ||
    null
  );
}

function selectedTimeline({ year, sourceContext }) {
  const rows = Array.isArray(sourceContext?.tax_reform_timeline)
    ? sourceContext.tax_reform_timeline
    : [];
  const normalizedYear = normalizeYear(year);
  return rows.map(timelinePeriod).find((row) => row.year === normalizedYear) || null;
}

function currentReferenceDataPeriod(sourceContext) {
  const currentSource = sourceContext?.field_sources?.['tax_inputs_current.icms_interstate'];
  return {
    period_id: 'icms_interstate_matrix_reference',
    period_start: '1989-05-19',
    period_end: null,
    period_type: 'reference_rule_validity',
    source_file: currentSource?.source_file || 'shared/tax_reference/icms_interstate_matrix.csv',
    source_ref: currentSource?.selected?.source_ref || currentSource?.source_file || null,
    source_confidence: currentSource?.source_confidence || SOURCE_CONFIDENCE,
    data_status: 'official_reference_matrix',
    limitation:
      'Matriz de referência interestadual; não substitui alíquotas internas, benefícios ou regras específicas da operação.',
  };
}

function observedDataCoverage(sourceContext) {
  const tenantSource = sourceContext?.field_sources?.['tax_inputs_current.tax_benefits'];
  return {
    period_start: null,
    period_end: null,
    status:
      tenantSource?.source_confidence === 'observed_tenant'
        ? 'period_not_declared'
        : 'not_available',
    source_confidence: tenantSource?.source_confidence || 'disabled',
    source_file: tenantSource?.source_file || null,
    limitation:
      'Os registros observados carregados não declaram um período transacional confiável no contrato de entrada; nenhuma série histórica foi inventada.',
  };
}

function modelWeightMetadata(regime = {}, selected = null) {
  const modelCurrent = numberOrNull(regime.current_weight);
  const modelReform = numberOrNull(
    regime.reform_weight == null
      ? modelCurrent == null
        ? null
        : 1 - modelCurrent
      : regime.reform_weight
  );
  const sourceCurrent = selected?.current_tax_weight;
  const sourceReform = selected?.reform_tax_weight;
  const differs =
    sourceCurrent != null &&
    sourceReform != null &&
    (modelCurrent == null ||
      modelReform == null ||
      Math.abs(modelCurrent - sourceCurrent) > 1e-9 ||
      Math.abs(modelReform - sourceReform) > 1e-9);
  return {
    model_current_weight: modelCurrent,
    model_reform_weight: modelReform,
    source_current_weight: sourceCurrent,
    source_reform_weight: sourceReform,
    status: differs ? 'model_parameter_differs_from_timeline' : 'aligned_or_not_applicable',
    semantics:
      'Os pesos do modelo combinam resultados calculados; os pesos do cronograma representam a transição ICMS/ISS para IBS. Eles não são automaticamente equivalentes.',
  };
}

export function buildTaxPeriodMetadata({ regimeId, regime, scenario, sourceContext } = {}) {
  const bridgeYear = selectedBridge({
    regimeId,
    year: scenario?.changes?.tax_year,
    sourceContext,
  })?.scenario_year;
  const requestedYear = normalizeYear(scenario?.changes?.tax_year);
  const regimeYear = normalizeYear(regime?.year);
  const year = normalizeYear(bridgeYear ?? requestedYear ?? regimeYear ?? 2026);
  const selected = selectedTimeline({ year, sourceContext });
  const bridge = selectedBridge({ regimeId, year, sourceContext });
  const reformSource = sourceContext?.field_sources?.['tax_inputs_reform.ibs_cbs_is_transition'];
  const periods = (
    Array.isArray(sourceContext?.tax_reform_timeline) ? sourceContext.tax_reform_timeline : []
  )
    .map(timelinePeriod)
    .filter((period) => period.year != null);

  return {
    selected_period: {
      ...clone(selected),
      year: selected?.year ?? year,
      bridge_scenario_id: bridge?.scenario_id || null,
      bridge_source_ref: bridge?.source_ref || null,
      bridge_source_confidence: bridge?.source_confidence || null,
      source_status: selected ? 'supported_by_official_timeline' : 'timeline_row_unavailable',
    },
    available_periods: periods,
    current_reference_data_period: currentReferenceDataPeriod(sourceContext),
    observed_data_coverage: observedDataCoverage(sourceContext),
    reform_rate_provenance: {
      source_confidence: reformSource?.source_confidence || SOURCE_CONFIDENCE,
      source_file: reformSource?.source_file || 'shared/tax_reference/tax_reform_timeline.csv',
      status: 'source_rate_not_defined_model_parameter',
      limitation:
        'O complemento fornece o cronograma da reforma, mas não fornece alíquotas efetivas completas por base e operação; as taxas numéricas usadas são parâmetros do modelo.',
    },
    model_weights: modelWeightMetadata(regime, selected),
    source_catalog_refs: ['rf_entenda_reforma', 'senado_res22_1989', 'lc214_2025', 'ec132_2023'],
    interpretation:
      'Períodos oficiais sustentam a cronologia e as premissas de transição. As alíquotas efetivas e a carga por operação continuam dependentes de dados fiscais e regras específicas.',
  };
}
