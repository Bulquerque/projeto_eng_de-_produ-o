#!/usr/bin/env python3
"""Fail the final build if plain company JSON/CSV files are still present."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "encrypted_manifest.json"
COMPANY_DIRS = [ROOT / "data" / "empresa1", ROOT / "data" / "empresa2"]


def main() -> None:
    if not MANIFEST.exists():
        raise SystemExit("CRYPTO_001 encrypted_manifest.json não encontrado.")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    entries = manifest.get("entries") or []
    missing_encrypted = [
        entry.get("encrypted_path")
        for entry in entries
        if not (ROOT / str(entry.get("encrypted_path", ""))).exists()
    ]
    plain = []
    for directory in COMPANY_DIRS:
        if not directory.exists():
            continue
        for path in directory.rglob("*"):
            if not path.is_file() or path.name.endswith(".enc.json"):
                continue
            if path.suffix.lower() in {".json", ".csv"}:
                plain.append(path.relative_to(ROOT).as_posix())
    if missing_encrypted:
        raise SystemExit("CRYPTO_002 arquivos criptografados ausentes:\n" + "\n".join(missing_encrypted))
    if plain:
        raise SystemExit("Dados sensíveis abertos encontrados:\n" + "\n".join(plain))
    print(f"ENCRYPTED_BUILD_OK files={len(entries)}")


if __name__ == "__main__":
    main()
