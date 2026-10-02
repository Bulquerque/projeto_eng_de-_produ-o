import base64
import hashlib
import json
import shutil
import stat
import subprocess
import sys
import tempfile
from pathlib import Path

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT = Path(__file__).resolve().parents[2]
CRYPTO_SESSION = ROOT / 'assets/js/core/crypto-session.js'


def test_crypto_session_does_not_persist_password_or_keys():
    source = CRYPTO_SESSION.read_text(encoding='utf-8')

    assert 'visagio_crypto_password_session' in source
    assert 'clearLegacySessionArtifacts' in source
    assert 'readStorageValue' not in source
    assert 'writeStorageValue' not in source
    assert 'exportAesKey' not in source
    assert 'importAesKey' not in source
    assert 'sessionStorage' not in source
    assert 'removeStorageKey(scope, PASSWORD_KEY)' in source
    assert 'deriveAesKey(memoryPassword, envelope.salt, false)' in source
    assert 'memoryPassword = password' in source


def test_crypto_session_clears_memory_on_lock():
    source = CRYPTO_SESSION.read_text(encoding='utf-8')

    assert 'memoryKeys.clear();' in source
    assert 'memoryPassword = null;' in source
    assert 'clearLegacySessionArtifacts();' in source


def _write_synthetic_envelope(path, plaintext, password, aad, salt, iv, iterations):
    key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, iterations, 32)
    ciphertext = AESGCM(key).encrypt(iv, plaintext, aad.encode())
    path.write_text(
        json.dumps(
            {
                'salt': base64.b64encode(salt).decode(),
                'iv': base64.b64encode(iv).decode(),
                'ciphertext': base64.b64encode(ciphertext).decode(),
                'aad': aad,
                'iterations': iterations,
                'format': 'synthetic-test-envelope',
            },
            separators=(',', ':'),
        ),
        encoding='utf-8',
    )


def _decrypt_envelope(path, password):
    envelope = json.loads(path.read_text(encoding='utf-8'))
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode(),
        base64.b64decode(envelope['salt']),
        envelope['iterations'],
        32,
    )
    plaintext = AESGCM(key).decrypt(
        base64.b64decode(envelope['iv']),
        base64.b64decode(envelope['ciphertext']),
        envelope['aad'].encode(),
    )
    return plaintext, envelope['aad']


def _run_rotation(project, candidates, target):
    script = project / 'scripts/rotate_data_access.py'
    payload = json.dumps({'candidates': candidates, 'target': target})
    return subprocess.run(
        [sys.executable, str(script)],
        cwd=project,
        input=payload + '\n',
        text=True,
        capture_output=True,
        check=False,
    )


def test_rotate_data_access_synthetic_contract():
    old_one = 'synthetic-old-phrase-one-123456'
    old_two = 'synthetic-old-phrase-two-123456'
    new_phrase = 'synthetic-rotated-phrase-1234567'
    iterations = 12000

    with tempfile.TemporaryDirectory(prefix='visagio-rotation-contract-') as temporary:
        project = Path(temporary)
        (project / 'scripts').mkdir()
        shutil.copy2(ROOT / 'scripts/rotate_data_access.py', project / 'scripts/rotate_data_access.py')
        paths = [
            project / 'data/empresa1/synthetic-one.json.enc',
            project / 'references/raw_sources/synthetic-two.json.enc',
        ]
        for path in paths:
            path.parent.mkdir(parents=True, exist_ok=True)

        plaintexts = [b'{"record":"synthetic-one"}', b'{"record":"synthetic-two"}']
        aads = ['data/empresa1/synthetic-one.json', 'references/raw_sources/synthetic-two.json']
        passwords = [old_one, old_two]
        for index, (path, plaintext, password, aad) in enumerate(zip(paths, plaintexts, passwords, aads, strict=True)):
            _write_synthetic_envelope(
                path,
                plaintext,
                password,
                aad,
                salt=bytes([index + 1]) * 16,
                iv=bytes([index + 11]) * 12,
                iterations=iterations,
            )

        manifest = {
            'entries': [
                {
                    'encrypted_path': path.relative_to(project).as_posix(),
                    'sha256': hashlib.sha256(plaintext).hexdigest(),
                }
                for path, plaintext in zip(paths, plaintexts, strict=True)
            ]
        }
        (project / 'data/encrypted_manifest.json').write_text(json.dumps(manifest), encoding='utf-8')

        csv_path = project / 'references/source_documents_manifest.csv'
        csv_path.write_text(
            'encrypted_path,encrypted_sha256,encrypted_size_bytes\n'
            + ''.join(f'{path.relative_to(project).as_posix()},stale,1\n' for path in paths),
            encoding='utf-8',
        )
        env_path = project / '.env.local'
        env_path.write_text(
            'KEEP_SYNTHETIC_SETTING=yes\nVISAGIO_DATA_PASSWORD=synthetic-prior-phrase\n', encoding='utf-8'
        )
        env_path.chmod(0o600)

        tracked_paths = [*paths, csv_path, env_path]
        original_bytes = {path: path.read_bytes() for path in tracked_paths}
        invalid = _run_rotation(project, [old_one], new_phrase)
        assert invalid.returncode != 0
        assert 'no files changed' in invalid.stderr.lower()
        assert {path: path.read_bytes() for path in tracked_paths} == original_bytes

        rotated = _run_rotation(project, passwords, new_phrase)
        assert rotated.returncode == 0, rotated.stderr
        assert 'ACCESS_ROTATION_OK' in rotated.stdout
        for path, expected_plaintext, expected_aad, old_password in zip(
            paths, plaintexts, aads, passwords, strict=True
        ):
            plaintext, aad = _decrypt_envelope(path, new_phrase)
            assert plaintext == expected_plaintext
            assert aad == expected_aad
            assert hashlib.sha256(plaintext).hexdigest() == next(
                entry['sha256']
                for entry in manifest['entries']
                if entry['encrypted_path'] == path.relative_to(project).as_posix()
            )
            try:
                _decrypt_envelope(path, old_password)
            except InvalidTag:
                pass
            else:
                raise AssertionError('An old synthetic phrase still decrypts a rotated envelope.')

        env_text = env_path.read_text(encoding='utf-8')
        assert 'KEEP_SYNTHETIC_SETTING=yes' in env_text
        assert f'VISAGIO_DATA_PASSWORD={new_phrase}' in env_text
        assert stat.S_IMODE(env_path.stat().st_mode) == 0o600
        updated_csv = csv_path.read_bytes()
        assert b'\r\n' not in updated_csv
        for path in paths:
            assert path.relative_to(project).as_posix().encode() in updated_csv
            assert hashlib.sha256(path.read_bytes()).hexdigest().encode() in updated_csv

        rotated_bytes = {path: path.read_bytes() for path in paths}
        rerun = _run_rotation(project, [new_phrase], new_phrase)
        assert rerun.returncode == 0, rerun.stderr
        assert 'rotated=0' in rerun.stdout
        assert {path: path.read_bytes() for path in paths} == rotated_bytes
        assert csv_path.read_bytes() == updated_csv
        assert env_path.read_text(encoding='utf-8') == env_text
        assert stat.S_IMODE(env_path.stat().st_mode) == 0o600


if __name__ == '__main__':
    test_crypto_session_does_not_persist_password_or_keys()
    test_crypto_session_clears_memory_on_lock()
    test_rotate_data_access_synthetic_contract()
    print('CRYPTO_SESSION_CONTRACT_OK')
