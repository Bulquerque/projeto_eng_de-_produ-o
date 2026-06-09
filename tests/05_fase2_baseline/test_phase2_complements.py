import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tests.crypto_helpers import NODE_DECRYPT_HELPER

ROOT = Path(__file__).resolve().parents[2]


def _read_json(rel_path: str):
    return json.loads((ROOT / rel_path).read_text(encoding='utf-8'))


code = (
    NODE_DECRYPT_HELPER
    + r"""
import fs from 'fs';
import { buildComplementPackage, pickPreferredSource } from './assets/js/shared/complements.js';
import { runTaxCalculation } from './assets/js/shared/tax/tax-orchestrator.js';

const loadJson = (relPath) => JSON.parse(fs.readFileSync(relPath, 'utf8'));

const complementPayloads = {
  manifest: loadJson('data/complements/complementos_manifest.json'),
  companyProfiles: loadJson('data/complements/frontend_api_complementos/company_profiles.json'),
  sourceLegend: loadJson('data/complements/frontend_api_complementos/source_confidence_legend.json'),
  readinessSummary: loadJson('data/complements/frontend_api_complementos/readiness_summary.json'),
  sourceCatalog: loadJson('data/complements/shared/tax_reference/source_catalog.json'),
  taxReformTimeline: loadJson('data/complements/shared/tax_reference/tax_reform_timeline.json'),
  ufReference: loadJson('data/complements/shared/tax_reference/uf_reference.json')
};

for (const companyId of ['empresa1', 'empresa2']) {
  const tenantId = companyId === 'empresa1' ? 'empresa_1' : 'empresa_2';
  const bundle = decryptJson(`data/${companyId}/phase2/phase2_bundle.json`);
  const complementPackage = buildComplementPackage({
    companyId,
    manifest: complementPayloads.manifest,
    companyProfile: complementPayloads.companyProfiles.find((item) => item.tenant_id === tenantId),
    tenantManifest: loadJson(`data/complements/complementos/${tenantId}/tenant_manifest.json`),
    taxManifest: loadJson(`data/complements/complementos/${tenantId}/tax/tax_manifest.json`),
    taxAssumptions: loadJson(`data/complements/complementos/${tenantId}/tax/tax_assumptions.json`),
    taxSourceMap: loadJson(`data/complements/complementos/${tenantId}/tax/tax_source_map.json`),
    taxScenarioBridge: loadJson(`data/complements/complementos/${tenantId}/tax/tax_scenario_bridge.json`),
    readinessSummary: complementPayloads.readinessSummary,
    sourceLegend: complementPayloads.sourceLegend,
    sourceCatalog: complementPayloads.sourceCatalog,
    taxReformTimeline: complementPayloads.taxReformTimeline,
    ufReference: complementPayloads.ufReference,
    validationChecklist: loadJson(`data/complements/complementos/${tenantId}/validation/validation_checklist.json`),
    proxyRegistry: loadJson(`data/complements/complementos/${tenantId}/validation/proxy_registry.json`),
    scenarioRegistry: loadJson(`data/complements/complementos/${tenantId}/scenarios/scenario_registry.json`)
  });

  bundle.complements = complementPackage;
  const taxResult = runTaxCalculation({
    baselineBundle: bundle,
    rebuiltFlows: bundle.flows,
    baseTaxBlock: bundle.tax_results.tax_results,
    demandMultiplier: 1,
    taxMode: 'current'
  });

  if (!taxResult.source_context) throw new Error(`${companyId}: source_context not attached`);
  if (taxResult.source_context.package_name !== 'visagio_complementos_empresa1_empresa2') throw new Error(`${companyId}: wrong package_name`);
  if (!taxResult.metadata?.source_context) throw new Error(`${companyId}: metadata missing source_context`);
  if (Math.abs(Number(taxResult.total_tax_impact || 0) - Number(bundle.tax_results.tax_results.total_tax_impact || 0)) > 0.0001) throw new Error(`${companyId}: baseline tax changed`);

  const currentSource = taxResult.source_context.field_sources['tax_inputs_current.icms_interstate'];
  const reformSource = taxResult.source_context.field_sources['tax_inputs_reform.ibs_cbs_is_transition'];
  const benefitsSource = taxResult.source_context.field_sources['tax_inputs_current.tax_benefits'];
  if (!currentSource || currentSource.source_confidence !== 'external_official') throw new Error(`${companyId}: current source confidence mismatch`);
  if (!reformSource || reformSource.source_confidence !== 'external_official') throw new Error(`${companyId}: reform source confidence mismatch`);
  if (companyId === 'empresa1' && (!benefitsSource || benefitsSource.source_confidence !== 'proxy_other_company')) throw new Error('empresa1 benefits should use proxy_other_company');
  if (companyId === 'empresa2' && (!benefitsSource || benefitsSource.source_confidence !== 'observed_tenant')) throw new Error('empresa2 benefits should use observed_tenant');
}

const observed = pickPreferredSource([
  { source_confidence: 'manual_scenario', marker: 'manual' },
  { source_confidence: 'proxy_other_company', marker: 'proxy' },
  { source_confidence: 'external_official', marker: 'official' },
  { source_confidence: 'observed_tenant', marker: 'observed' }
]);
if (observed.marker !== 'observed') throw new Error('observed_tenant should win');

const official = pickPreferredSource([
  { source_confidence: 'manual_scenario', marker: 'manual' },
  { source_confidence: 'proxy_other_company', marker: 'proxy' },
  { source_confidence: 'external_official', marker: 'official' }
]);
if (official.marker !== 'official') throw new Error('external_official should win over proxy and manual');

const proxy = pickPreferredSource([
  { source_confidence: 'manual_scenario', marker: 'manual' },
  { source_confidence: 'proxy_other_company', marker: 'proxy' }
]);
if (proxy.marker !== 'proxy') throw new Error('proxy should win over manual when observed data is absent');

console.log('PHASE2_COMPLEMENTS_OK');
"""
)

res = subprocess.run(['node', '--input-type=module', '-e', code], cwd=ROOT, text=True, capture_output=True, timeout=120)
assert res.returncode == 0, res.stderr + res.stdout
print(res.stdout.strip())
