import importlib.util
import json
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('handoff_builder_qa', ROOT / 'scripts/audit/build_tcc_handoff.py')
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


def test_qa_summary_rejects_bad_provenance_and_does_not_copy_raw_data():
    head = BUILDER.git_value('rev-parse', 'HEAD')
    payload = {
        'commit_final': head,
        'suites': [
            {
                'command': 'python tests/run_all_tests.py',
                'status': 'PASS',
                'count': 12,
                'log_sha256': 'a' * 64,
                'log': 'PRIVATE_SENTINEL',
            }
        ],
        'private': 'PRIVATE_SENTINEL',
    }
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        qa = root / 'qa.json'
        qa.write_text(json.dumps(payload))
        package = root / 'result.zip'
        BUILDER.build_package(package, evidence_path=root / 'missing.json', qa_report=qa)
        with zipfile.ZipFile(package) as archive:
            report = next(name for name in archive.namelist() if name.endswith('/06_TESTES_E_QA/TEST_REPORT.md'))
            output = archive.read(report).decode()
        assert head in output and 'python tests/run_all_tests.py' in output and 'PASS' in output
        assert '12' in output and 'a' * 64 in output
        assert 'PRIVATE_SENTINEL' not in output
        assert 'não verifica o conteúdo do log' in output
        for field, value in [('commit_final', 'b' * 40)]:
            invalid = {**payload, field: value}
            qa.write_text(json.dumps(invalid))
            try:
                BUILDER.build_package(root / 'wrong.zip', evidence_path=root / 'missing.json', qa_report=qa)
            except ValueError:
                pass
            else:
                raise AssertionError('Mismatched commit accepted')
        for key, value in [
            ('log_sha256', 'invalid'),
            ('command', 'echo PRIVATE_SENTINEL'),
            ('count', True),
            ('status', 'MAYBE'),
        ]:
            bad = {**payload, 'suites': [{**payload['suites'][0], key: value}]}
            qa.write_text(json.dumps(bad))
            try:
                BUILDER.build_package(root / 'invalid.zip', evidence_path=root / 'missing.json', qa_report=qa)
            except ValueError:
                pass
            else:
                raise AssertionError(f'Invalid QA report accepted: {key}')


if __name__ == '__main__':
    test_qa_summary_rejects_bad_provenance_and_does_not_copy_raw_data()
    print('QA_REPORT_TEST_OK')
