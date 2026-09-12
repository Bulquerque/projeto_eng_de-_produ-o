#!/usr/bin/env python3
"""Encrypt or decrypt the archival source files kept outside the public site."""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import json
import os
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / 'references' / 'raw_sources'
MANIFEST_PATH = ROOT / 'references' / 'source_documents_manifest.csv'
ITERATIONS = 310_000


def password() -> str:
    value = os.environ.get('VISAGIO_DATA_PASSWORD')
    env_path = ROOT / '.env.local'
    if not value and env_path.exists():
        for raw_line in env_path.read_text(encoding='utf-8').splitlines():
            line = raw_line.strip()
            if line.startswith('VISAGIO_DATA_PASSWORD='):
                value = line.split('=', 1)[1].strip().strip('"').strip("'")
                break
    if not value:
        raise SystemExit('VISAGIO_DATA_PASSWORD ausente.')
    if len(value) < 24:
        raise SystemExit('VISAGIO_DATA_PASSWORD deve ter pelo menos 24 caracteres.')
    return value


def b64(value: bytes) -> str:
    return base64.b64encode(value).decode('ascii')


def derive_key(secret: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=ITERATIONS,
    )
    return kdf.derive(secret.encode('utf-8'))


def encrypt(path: Path, secret: str) -> tuple[Path, dict]:
    relative = path.relative_to(ROOT).as_posix()
    plaintext = path.read_bytes()
    salt = os.urandom(16)
    iv = os.urandom(12)
    ciphertext = AESGCM(derive_key(secret, salt)).encrypt(iv, plaintext, relative.encode('utf-8'))
    envelope = {
        'version': 1,
        'algorithm': 'AES-GCM',
        'kdf': 'PBKDF2-SHA-256',
        'iterations': ITERATIONS,
        'aad': relative,
        'salt': b64(salt),
        'iv': b64(iv),
        'ciphertext': b64(ciphertext),
    }
    encrypted = path.with_name(f'{path.name}.enc.json')
    encrypted.write_text(json.dumps(envelope, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return encrypted, {
        'size_bytes': len(plaintext),
        'sha256': hashlib.sha256(plaintext).hexdigest(),
        'encrypted_size_bytes': encrypted.stat().st_size,
        'encrypted_sha256': hashlib.sha256(encrypted.read_bytes()).hexdigest(),
    }


def decrypt(path: Path, secret: str) -> bytes:
    envelope = json.loads(path.read_text(encoding='utf-8'))
    aad = envelope.get('aad')
    expected_aad = path.with_name(path.name[:-9]).relative_to(ROOT).as_posix()
    if aad != expected_aad:
        raise ValueError(f'AAD divergente: {path}')
    key = derive_key(secret, base64.b64decode(envelope['salt'], validate=True))
    return AESGCM(key).decrypt(
        base64.b64decode(envelope['iv'], validate=True),
        base64.b64decode(envelope['ciphertext'], validate=True),
        aad.encode('utf-8'),
    )


def update_manifest(entries: dict[str, dict]) -> None:
    with MANIFEST_PATH.open(newline='', encoding='utf-8') as stream:
        rows = list(csv.DictReader(stream))
        fieldnames = list(rows[0]) if rows else []
    for field in ('encrypted_path', 'encrypted_size_bytes', 'encrypted_sha256', 'encryption'):
        if field not in fieldnames:
            fieldnames.append(field)
    for row in rows:
        original = row['package_path']
        metadata = entries.get(original)
        if not metadata:
            raise ValueError(f'Fonte não processada: {original}')
        encrypted = f'{original}.enc.json'
        row['package_path'] = encrypted
        row['encrypted_path'] = encrypted
        row['encrypted_size_bytes'] = str(metadata['encrypted_size_bytes'])
        row['encrypted_sha256'] = metadata['encrypted_sha256']
        row['encryption'] = 'AES-GCM/PBKDF2-SHA-256'
    with MANIFEST_PATH.open('w', newline='', encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def encrypt_all() -> None:
    secret = password()
    files = sorted(path for path in SOURCE_DIR.iterdir() if path.is_file() and not path.name.endswith('.enc.json'))
    if not files:
        raise SystemExit('Nenhuma fonte plaintext encontrada para criptografar.')
    entries = {}
    for path in files:
        encrypted, metadata = encrypt(path, secret)
        if decrypt(encrypted, secret) != path.read_bytes():
            raise ValueError(f'Verificação de descriptografia falhou: {path}')
        entries[path.relative_to(ROOT).as_posix()] = metadata
    update_manifest(entries)
    print(f'REFERENCE_SOURCES_ENCRYPTED={len(files)}')


def verify_all() -> None:
    secret = password()
    with MANIFEST_PATH.open(newline='', encoding='utf-8') as stream:
        rows = list(csv.DictReader(stream))
    checked = 0
    for row in rows:
        encrypted = ROOT / row['encrypted_path']
        plaintext = decrypt(encrypted, secret)
        if hashlib.sha256(plaintext).hexdigest() != row['sha256']:
            raise ValueError(f'Hash plaintext divergente: {encrypted}')
        checked += 1
    print(f'REFERENCE_SOURCES_VERIFIED={checked}')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=('encrypt', 'verify'))
    args = parser.parse_args()
    (encrypt_all if args.command == 'encrypt' else verify_all)()


if __name__ == '__main__':
    main()
