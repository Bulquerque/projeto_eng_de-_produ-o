import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / 'references' / 'raw_sources'


def test_reference_sources_are_encrypted_and_verifiable():
    files = sorted(path for path in SOURCE_DIR.iterdir() if path.is_file())
    assert files, 'Nenhuma fonte criptografada encontrada.'
    assert all(path.name.endswith('.enc.json') for path in files)
    result = subprocess.run(
        [sys.executable, str(ROOT / 'scripts' / 'manage_reference_sources.py'), 'verify'],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert 'REFERENCE_SOURCES_VERIFIED=18' in result.stdout


if __name__ == '__main__':
    test_reference_sources_are_encrypted_and_verifiable()
    print('REFERENCE_SOURCE_ENCRYPTION_OK')
