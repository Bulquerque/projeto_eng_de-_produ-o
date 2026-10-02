"""Rotate protected envelopes using hidden stdin; never write plaintext files."""

from __future__ import annotations

import base64
import csv
import hashlib
import json
import os
import sys
import termios
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT = Path(__file__).resolve().parents[1]


def derive(password, salt, iterations):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt, iterations, 32)


def main():
    terminal = termios.tcgetattr(sys.stdin.fileno()) if sys.stdin.isatty() else None
    if terminal:
        hidden = terminal.copy()
        hidden[3] &= ~termios.ECHO
        termios.tcsetattr(sys.stdin.fileno(), termios.TCSANOW, hidden)
    print('Ready for hidden rotation JSON.', flush=True)
    try:
        payload = json.loads(sys.stdin.readline())
    finally:
        if terminal:
            termios.tcsetattr(sys.stdin.fileno(), termios.TCSANOW, terminal)
    candidates, target = payload['candidates'], payload['target']
    runtime_root = Path(payload['runtime_dir']).resolve() if payload.get('runtime_dir') else ROOT
    if runtime_root != ROOT:
        expected_site = json.loads((ROOT / '.openai/hosting.json').read_text())['project_id']
        assert json.loads((runtime_root / '.openai/hosting.json').read_text())['project_id'] == expected_site
    if len(target) < 24:
        raise SystemExit('Use a phrase of at least 24 characters.')
    files = sorted(
        p
        for directory in ('data/empresa1', 'data/empresa2', 'references/raw_sources')
        for p in (runtime_root / directory).rglob('*.enc*')
        if p.is_file()
    )
    manifest = json.loads((runtime_root / 'data/encrypted_manifest.json').read_text())
    expected = {entry['encrypted_path']: entry.get('sha256') for entry in manifest['entries']}
    changes = []
    for path in files:
        envelope = json.loads(path.read_text())
        salt = base64.b64decode(envelope['salt'])
        aad = envelope.get('aad', '').encode()
        iterations = envelope.get('iterations', 310000)
        plaintext, used = None, None
        for password in [target, *candidates]:
            try:
                plaintext = AESGCM(derive(password, salt, iterations)).decrypt(
                    base64.b64decode(envelope['iv']), base64.b64decode(envelope['ciphertext']), aad
                )
                used = password
                break
            except Exception:
                continue
        if plaintext is None:
            raise SystemExit(f'No valid access phrase for {path.relative_to(runtime_root)}; no files changed.')
        digest = expected.get(path.relative_to(runtime_root).as_posix())
        if digest and hashlib.sha256(plaintext).hexdigest() != digest:
            raise SystemExit(f'Plaintext integrity mismatch: {path.relative_to(runtime_root)}; no files changed.')
        if used == target:
            continue
        new_salt, new_iv = os.urandom(16), os.urandom(12)
        cipher = AESGCM(derive(target, new_salt, iterations)).encrypt(new_iv, plaintext, aad)
        updated = {
            **envelope,
            'salt': base64.b64encode(new_salt).decode(),
            'iv': base64.b64encode(new_iv).decode(),
            'ciphertext': base64.b64encode(cipher).decode(),
        }
        # Validate the new key against the exact same bytes before any write.
        check = AESGCM(derive(target, new_salt, iterations)).decrypt(new_iv, cipher, aad)
        assert hashlib.sha256(check).digest() == hashlib.sha256(plaintext).digest()
        changes.append((path, json.dumps(updated, ensure_ascii=False, separators=(',', ':'))))
    for path, content in changes:
        temporary = path.with_name(path.name + '.rotation-tmp')
        temporary.write_text(content)
        temporary.replace(path)
    if runtime_root != ROOT:
        print(f'ACCESS_ROTATION_OK verified={len(files)} rotated={len(changes)} plaintext_unchanged=true')
        return
    reference_manifest = ROOT / 'references/source_documents_manifest.csv'
    with reference_manifest.open(newline='') as handle:
        reader = csv.DictReader(handle)
        fields = reader.fieldnames
        rows = list(reader)
    for row in rows:
        encrypted = ROOT / row.get('encrypted_path', '')
        if encrypted.is_file():
            row['encrypted_sha256'] = hashlib.sha256(encrypted.read_bytes()).hexdigest()
            row['encrypted_size_bytes'] = str(encrypted.stat().st_size)
    with reference_manifest.open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)
    env_path = ROOT / '.env.local'
    lines = env_path.read_text().splitlines() if env_path.exists() else []
    lines = [line for line in lines if not line.startswith('VISAGIO_DATA_PASSWORD=')]
    env_path.write_text('\n'.join([*lines, 'VISAGIO_DATA_PASSWORD=' + target]) + '\n')
    env_path.chmod(0o600)
    print(f'ACCESS_ROTATION_OK verified={len(files)} rotated={len(changes)} plaintext_unchanged=true')


if __name__ == '__main__':
    main()
