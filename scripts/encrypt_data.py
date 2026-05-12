#!/usr/bin/env python3
"""Encrypt company data files for the static simulator."""

from __future__ import annotations

import base64
import hashlib
import json
import os
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
COMPANY_DIRS = [DATA_DIR / "empresa1", DATA_DIR / "empresa2"]
MANIFEST_PATH = DATA_DIR / "encrypted_manifest.json"
ITERATIONS = 310_000


def load_env_password() -> str:
    password = os.environ.get("VISAGIO_DATA_PASSWORD")
    env_path = ROOT / ".env.local"
    if not password and env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key.strip() == "VISAGIO_DATA_PASSWORD":
                password = value.strip().strip('"').strip("'")
                break
    if not password:
        raise SystemExit("VISAGIO_DATA_PASSWORD ausente. Defina no ambiente ou em .env.local.")
    if len(password) < 24:
        raise SystemExit("VISAGIO_DATA_PASSWORD deve ter pelo menos 24 caracteres.")
    return password


def b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def derive_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=ITERATIONS,
    )
    return kdf.derive(password.encode("utf-8"))


def iter_plain_files() -> list[Path]:
    files: list[Path] = []
    for company_dir in COMPANY_DIRS:
        if not company_dir.exists():
            continue
        for path in company_dir.rglob("*"):
            if not path.is_file():
                continue
            if path.name.endswith(".enc.json"):
                continue
            if path.suffix.lower() in {".json", ".csv"}:
                files.append(path)
    return sorted(files)


def iter_existing_encrypted_files() -> list[Path]:
    files: list[Path] = []
    for company_dir in COMPANY_DIRS:
        if not company_dir.exists():
            continue
        for path in company_dir.rglob("*.enc.json"):
            if path.is_file():
                files.append(path)
    return sorted(files)


def encrypt_file(path: Path, password: str) -> dict:
    plaintext = path.read_bytes()
    salt = os.urandom(16)
    iv = os.urandom(12)
    key = derive_key(password, salt)
    aad = path.relative_to(ROOT).as_posix().encode("utf-8")
    ciphertext = AESGCM(key).encrypt(iv, plaintext, aad)
    envelope = {
        "version": 1,
        "algorithm": "AES-GCM",
        "kdf": "PBKDF2-SHA-256",
        "iterations": ITERATIONS,
        "salt": b64(salt),
        "iv": b64(iv),
        "aad": aad.decode("utf-8"),
        "ciphertext": b64(ciphertext),
    }
    encrypted_path = path.with_name(f"{path.name}.enc.json")
    encrypted_path.write_text(json.dumps(envelope, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    rel = path.relative_to(ROOT).as_posix()
    return {
        "id": rel.replace("/", "."),
        "company_id": rel.split("/")[1],
        "original_path": rel,
        "encrypted_path": encrypted_path.relative_to(ROOT).as_posix(),
        "original_type": path.suffix.lower().lstrip("."),
        "sha256": hashlib.sha256(plaintext).hexdigest(),
        "size_bytes": len(plaintext),
    }


def describe_existing_encrypted_file(path: Path) -> dict:
    rel = path.relative_to(ROOT).as_posix()
    original_path = rel[:-9] if rel.endswith(".enc.json") else rel
    parts = original_path.split("/")
    company_id = parts[1] if len(parts) > 1 else "unknown"
    return {
        "id": original_path.replace("/", "."),
        "company_id": company_id,
        "original_path": original_path,
        "encrypted_path": rel,
        "original_type": Path(original_path).suffix.lower().lstrip("."),
        "sha256": None,
        "size_bytes": None,
    }


def main() -> None:
    password = load_env_password()
    entries_by_original: dict[str, dict] = {}
    for path in iter_existing_encrypted_files():
        entry = describe_existing_encrypted_file(path)
        entries_by_original[entry["original_path"]] = entry
    for path in iter_plain_files():
        entry = encrypt_file(path, password)
        entries_by_original[entry["original_path"]] = entry
    entries = sorted(entries_by_original.values(), key=lambda item: item["original_path"])
    manifest = {
        "version": 1,
        "generated_by": "scripts/encrypt_data.py",
        "encryption": {
            "algorithm": "AES-GCM",
            "kdf": "PBKDF2-SHA-256",
            "iterations": ITERATIONS,
            "scope": ["data/empresa1/**/*.json|csv", "data/empresa2/**/*.json|csv"],
        },
        "entries": entries,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"ENCRYPTED_FILES={len(entries)}")
    print(f"MANIFEST={MANIFEST_PATH.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
