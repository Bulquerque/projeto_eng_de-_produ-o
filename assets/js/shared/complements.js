const COMPLEMENTS_ROOT = '../data/complements';
const COMPANY_TENANT_MAP = {
  empresa1: 'empresa_1',
  empresa2: 'empresa_2',
};
const SOURCE_CONFIDENCE_ALIASES = {
  external_official_with_tenant_validation: 'external_official',
};
const SOURCE_CONFIDENCE_PRIORITY = {
  observed_tenant: 0,
  external_official: 1,
  external_reference: 2,
  proxy_other_company: 3,
  manual_scenario: 4,
  disabled: 5,
};
const complementJsonCache = new Map();

function cloneValue(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function toTenantId(companyId) {
  return COMPANY_TENANT_MAP[String(companyId || '').trim()] || String(companyId || '').trim();
}

function normalizeSourceConfidence(sourceConfidence) {
  const key = String(sourceConfidence || '').trim();
  return SOURCE_CONFIDENCE_ALIASES[key] || key || 'disabled';
}

function sourceConfidenceRank(sourceConfidence) {
  const normalized = normalizeSourceConfidence(sourceConfidence);
  return SOURCE_CONFIDENCE_PRIORITY[normalized] ?? 99;
}

function pickPreferredSource(candidates = []) {
  return (
    [...candidates]
      .filter(Boolean)
      .map((candidate) => ({
        ...candidate,
        source_confidence: normalizeSourceConfidence(candidate.source_confidence),
        precedence_rank: sourceConfidenceRank(candidate.source_confidence),
      }))
      .sort((left, right) => left.precedence_rank - right.precedence_rank)[0] || null
  );
}

async function fetchComplementJson(path) {
  if (complementJsonCache.has(path)) return cloneValue(complementJsonCache.get(path));
  const response = await fetch(`${COMPLEMENTS_ROOT}/${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const json = await response.json();
  complementJsonCache.set(path, json);
  return cloneValue(json);
}

function labelTaxSource(row = {}) {
  if (row.tax_table === 'tax_inputs_current' && row.field === 'icms_interstate')
    return 'Base tributária atual';
  if (row.tax_table === 'tax_inputs_reform' || row.field === 'ibs_cbs_is_transition')
    return 'Reforma tributária';
  if (row.field === 'tax_benefits') return 'Benefícios tributários';
  return row.field || row.tax_table || 'fonte complementar';
}

function groupTaxSources(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.tax_table || 'unknown'}.${row.field || 'unknown'}`;
    const list = grouped.get(key) || [];
    list.push(row);
    grouped.set(key, list);
  }
  return grouped;
}

function buildTaxSourceContext({
  companyId,
  manifest = {},
  companyProfile = null,
  tenantManifest = null,
  taxManifest = null,
  taxAssumptions = [],
  taxSourceMap = [],
  taxScenarioBridge = [],
  readinessSummary = [],
  sourceLegend = [],
  sourceCatalog = [],
  taxReformTimeline = [],
  ufReference = [],
  validationChecklist = [],
  proxyRegistry = [],
  scenarioRegistry = [],
} = {}) {
  const legendByConfidence = Object.fromEntries(
    sourceLegend.map((entry) => [normalizeSourceConfidence(entry.source_confidence), entry])
  );
  const groupedSources = groupTaxSources(taxSourceMap);
  const fieldSources = Object.fromEntries(
    [...groupedSources.entries()].map(([key, candidates]) => {
      const selected = pickPreferredSource(candidates);
      return [
        key,
        {
          key,
          label: labelTaxSource(selected || candidates[0] || {}),
          selected,
          candidates: candidates.map((candidate) => ({
            ...cloneValue(candidate),
            source_confidence: normalizeSourceConfidence(candidate.source_confidence),
            source_confidence_label:
              legendByConfidence[normalizeSourceConfidence(candidate.source_confidence)]?.meaning ||
              candidate.source_confidence ||
              'desconhecido',
            precedence_rank: sourceConfidenceRank(candidate.source_confidence),
          })),
          source_confidence: selected?.source_confidence || 'disabled',
          source_confidence_label:
            legendByConfidence[selected?.source_confidence]?.meaning ||
            selected?.source_confidence ||
            'sem fonte',
          source_file: selected?.source_file || null,
          source_type: selected?.source_type || null,
          notes: selected?.notes || null,
          precedence_rank:
            selected?.precedence_rank ?? sourceConfidenceRank(selected?.source_confidence),
        },
      ];
    })
  );

  const sourceSummary = Object.values(fieldSources).map((row) => ({
    key: row.key,
    label: row.label,
    source_confidence: row.source_confidence,
    source_confidence_label: row.source_confidence_label,
    source_file: row.source_file,
    source_type: row.source_type,
    notes: row.notes,
    precedence_rank: row.precedence_rank,
  }));

  const tenantId = String(companyProfile?.tenant_id || toTenantId(companyId));
  const filteredReadiness = readinessSummary.filter(
    (row) => String(row.tenant_id || '') === tenantId
  );
  const auditSources = [
    'data/complements/complementos_manifest.json',
    'data/complements/frontend_api_complementos/company_profiles.json',
    'data/complements/frontend_api_complementos/source_confidence_legend.json',
    'data/complements/frontend_api_complementos/readiness_summary.json',
    `data/complements/complementos/${tenantId}/tenant_manifest.json`,
    `data/complements/complementos/${tenantId}/tax/tax_manifest.json`,
    `data/complements/complementos/${tenantId}/tax/tax_assumptions.json`,
    `data/complements/complementos/${tenantId}/tax/tax_source_map.json`,
    `data/complements/complementos/${tenantId}/tax/tax_scenario_bridge.json`,
    'data/complements/shared/tax_reference/source_catalog.json',
    'data/complements/shared/tax_reference/icms_interstate_matrix.csv',
    'data/complements/shared/tax_reference/icms_interstate_matrix.json',
    'data/complements/shared/tax_reference/tax_reform_timeline.csv',
    'data/complements/shared/tax_reference/tax_reform_timeline.json',
    'data/complements/shared/tax_reference/uf_reference.json',
  ];

  return {
    package_name: manifest.package_name || 'visagio_complementos',
    package_created_at: manifest.created_at || null,
    package_purpose: manifest.purpose || null,
    company_id: companyId,
    tenant_id: tenantId,
    company_profile: companyProfile,
    tenant_manifest: tenantManifest,
    tax_manifest: taxManifest,
    tax_assumptions: taxAssumptions,
    tax_scenario_bridge: taxScenarioBridge,
    source_confidence_legend: sourceLegend,
    source_catalog: sourceCatalog,
    tax_reform_timeline: taxReformTimeline,
    uf_reference: ufReference,
    validation_checklist: validationChecklist,
    proxy_registry: proxyRegistry,
    scenario_registry: scenarioRegistry,
    readiness_summary: filteredReadiness,
    fallback_policy: {
      primary: 'observed_tenant',
      secondary: 'external_official',
      tertiary: 'proxy_other_company',
      quaternary: 'manual_scenario',
      rule: 'principal vence sobre complemento quando ambos existem; complemento vence sobre ausência; proxy externo só entra quando a fonte observada não cobre o campo.',
    },
    source_priority_order: [
      'observed_tenant',
      'external_official',
      'proxy_other_company',
      'manual_scenario',
    ],
    field_sources: fieldSources,
    source_summary: sourceSummary,
    audit_sources: auditSources,
  };
}

const complementCache = {};

export async function loadComplementPackage(companyId) {
  const tenantId = toTenantId(companyId);
  if (complementCache[tenantId]) return complementCache[tenantId];

  const load = async (path) => {
    try {
      return await fetchComplementJson(path);
    } catch (error) {
      console.warn(`[complements] Could not load ${path}:`, error.message);
      return null;
    }
  };
  const [
    manifest,
    companyProfiles,
    sourceLegend,
    readinessSummary,
    tenantManifest,
    taxManifest,
    taxAssumptions,
    taxSourceMap,
    taxScenarioBridge,
    sourceCatalog,
    taxReformTimeline,
    ufReference,
    validationChecklist,
    proxyRegistry,
    scenarioRegistry,
  ] = await Promise.all([
    load('complementos_manifest.json'),
    load('frontend_api_complementos/company_profiles.json'),
    load('frontend_api_complementos/source_confidence_legend.json'),
    load('frontend_api_complementos/readiness_summary.json'),
    load(`complementos/${tenantId}/tenant_manifest.json`),
    load(`complementos/${tenantId}/tax/tax_manifest.json`),
    load(`complementos/${tenantId}/tax/tax_assumptions.json`),
    load(`complementos/${tenantId}/tax/tax_source_map.json`),
    load(`complementos/${tenantId}/tax/tax_scenario_bridge.json`),
    load('shared/tax_reference/source_catalog.json'),
    load('shared/tax_reference/tax_reform_timeline.json'),
    load('shared/tax_reference/uf_reference.json'),
    load(`complementos/${tenantId}/validation/validation_checklist.json`),
    load(`complementos/${tenantId}/validation/proxy_registry.json`),
    load(`complementos/${tenantId}/scenarios/scenario_registry.json`),
  ]);

  const companyProfile = Array.isArray(companyProfiles)
    ? companyProfiles.find((entry) => String(entry.tenant_id || '') === tenantId) || null
    : null;

  const packageContext = buildTaxSourceContext({
    companyId,
    manifest,
    companyProfile,
    tenantManifest,
    taxManifest,
    taxAssumptions: Array.isArray(taxAssumptions) ? taxAssumptions : [],
    taxSourceMap: Array.isArray(taxSourceMap) ? taxSourceMap : [],
    taxScenarioBridge: Array.isArray(taxScenarioBridge) ? taxScenarioBridge : [],
    readinessSummary: Array.isArray(readinessSummary) ? readinessSummary : [],
    sourceLegend: Array.isArray(sourceLegend) ? sourceLegend : [],
    sourceCatalog: Array.isArray(sourceCatalog) ? sourceCatalog : [],
    taxReformTimeline: Array.isArray(taxReformTimeline) ? taxReformTimeline : [],
    ufReference: Array.isArray(ufReference) ? ufReference : [],
    validationChecklist: Array.isArray(validationChecklist) ? validationChecklist : [],
    proxyRegistry: Array.isArray(proxyRegistry) ? proxyRegistry : [],
    scenarioRegistry: Array.isArray(scenarioRegistry) ? scenarioRegistry : [],
  });

  const packageData = {
    ...packageContext,
    available: true,
    company_profiles: Array.isArray(companyProfiles) ? companyProfiles : [],
    source_confidence_legend_full: Array.isArray(sourceLegend) ? sourceLegend : [],
    complement_manifest: manifest,
  };

  complementCache[tenantId] = packageData;
  return packageData;
}

export function buildComplementPackage(args = {}) {
  return buildTaxSourceContext(args);
}

export {
  buildTaxSourceContext,
  pickPreferredSource,
  sourceConfidenceRank,
  toTenantId as normalizeTenantId,
  normalizeSourceConfidence,
};
