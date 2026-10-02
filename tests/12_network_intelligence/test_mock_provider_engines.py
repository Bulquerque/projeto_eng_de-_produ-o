import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'tests/12_network_intelligence/test_mock_provider_engines.mjs'


def test_mock_provider_reuses_engines_and_preserves_tenant_contract():
    result = subprocess.run(
        ['node', str(SCRIPT)],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        timeout=90,
    )
    assert result.stdout.strip().endswith('NETWORK_MOCK_PROVIDER_ENGINES_OK')


if __name__ == '__main__':
    test_mock_provider_reuses_engines_and_preserves_tenant_contract()
    print('NETWORK_MOCK_PROVIDER_ENGINES_OK')
