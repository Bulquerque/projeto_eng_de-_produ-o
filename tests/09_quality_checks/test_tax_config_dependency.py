from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_tax_config_loader_is_separate_from_domain_config():
    config = (ROOT / 'assets/js/core/tax-reform-config.js').read_text(encoding='utf-8')
    loader_path = ROOT / 'assets/js/core/tax-reform-config-loader.js'
    loader = loader_path.read_text(encoding='utf-8')

    assert 'data-loader.js' not in config
    assert 'fetchJson' in loader
    assert 'normalizeTaxReformConfig' in loader
    assert 'setTaxReformConfig' in loader

    for phase in ('phase3', 'phase4', 'phase5'):
        entrypoint = (ROOT / f'assets/js/{phase}/main.js').read_text(encoding='utf-8')
        assert 'tax-reform-config-loader.js' in entrypoint
        assert "tax-reform-config.js'" not in entrypoint


if __name__ == '__main__':
    test_tax_config_loader_is_separate_from_domain_config()
    print('TAX_CONFIG_DEPENDENCY_OK')
