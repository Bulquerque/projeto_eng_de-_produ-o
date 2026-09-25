import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    release = json.loads((ROOT / 'data/release-manifest.json').read_text())
    catalog = json.loads((ROOT / 'data/catalog.json').read_text())
    quality = json.loads((ROOT / 'data/data_quality_summary.json').read_text())

    for document in (catalog, quality):
        assert document['package_version'] == release['package_version']
        assert document['release_id'] == release['release_id']
        assert document['git_commit'] == release['git_commit']
        assert document['release_manifest'] == 'data/release-manifest.json'

    deriver = (ROOT / 'assets/js/phase2/baseline-deriver.js').read_text()
    simulator = (ROOT / 'assets/js/phase3/scenario-simulator.js').read_text()
    for source in (deriver, simulator):
        assert 'official_shared_tax_reference_proxy' not in source
        assert 'official_tax_reference_recomputed' not in source
        assert 'official_fiscal_validation: false' in source
        assert "validation_scope: 'parametric_model_reconciliation'" in source

    debug = (ROOT / 'assets/js/core/debug-tools.js').read_text()
    for expression in ('escapeHtml(e.phase)', 'escapeHtml(e.module)', 'escapeHtml(e.event)'):
        assert expression in debug

    package_builder = (ROOT / 'scripts/build_academic_package.mjs').read_text()
    assert '/tmp/visagio_doc_extract' not in package_builder
    assert '/home/' not in package_builder
    assert 'VISAGIO_ARTIFACT_TOOL_PATH' in package_builder
    assert "'ESTUDO_PROPRIO_TRIBUTACAO.md'" in package_builder

    print('RELEASE_CONTRACT_OK')


if __name__ == '__main__':
    main()
