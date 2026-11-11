import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUILDER = ROOT / 'scripts/audit/build_tcc_handoff.py'
VALIDATOR = ROOT / 'scripts/audit/validate_tcc_handoff.py'


def test_builder_creates_blocked_status_package_and_validator_accepts_structure():
    with tempfile.TemporaryDirectory() as directory:
        temp = Path(directory)
        package = temp / 'handoff.zip'
        report = temp / 'validation.json'
        subprocess.run(
            [sys.executable, str(BUILDER), '--output', str(package)], check=True, capture_output=True, text=True
        )
        result = subprocess.run(
            [sys.executable, str(VALIDATOR), str(package), '--write-report', str(report)],
            check=False,
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stdout + result.stderr
        validation = json.loads(report.read_text())
        assert validation['structural_status'] == 'PASS'
        assert validation['scientific_status'] == 'BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS'
        with zipfile.ZipFile(package) as archive:
            members = archive.namelist()
            assert len({name.split('/')[0] for name in members}) == 1
            manifest = json.loads(
                archive.read(next(name for name in members if name.endswith('/00_MANIFESTO/run_manifest.json')))
            )
            assert manifest['overall_status'] == 'BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS'
            assert manifest['p0_blocked_count'] is None
            assert not any(name.endswith(('.docx', '.png', '.enc.json')) for name in members)


def test_validator_rejects_tampered_member():
    with tempfile.TemporaryDirectory() as directory:
        temp = Path(directory)
        package = temp / 'handoff.zip'
        tampered = temp / 'tampered.zip'
        subprocess.run(
            [sys.executable, str(BUILDER), '--output', str(package)], check=True, capture_output=True, text=True
        )
        with zipfile.ZipFile(package) as original, zipfile.ZipFile(tampered, 'w', zipfile.ZIP_DEFLATED) as target:
            for name in original.namelist():
                data = original.read(name)
                if name.endswith('/STATUS_FINAL.md'):
                    data += b'\nTAMPER\n'
                target.writestr(name, data)
        result = subprocess.run(
            [sys.executable, str(VALIDATOR), str(tampered)],
            check=False,
            capture_output=True,
            text=True,
        )
        assert result.returncode == 1
        assert 'Checksum mismatch' in result.stdout


if __name__ == '__main__':
    test_builder_creates_blocked_status_package_and_validator_accepts_structure()
    test_validator_rejects_tampered_member()
    print('TCC_HANDOFF_TEST_OK')
