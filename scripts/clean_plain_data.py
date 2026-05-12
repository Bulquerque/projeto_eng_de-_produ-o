#!/usr/bin/env python3
"""Remove plain company data files that are already represented in the encrypted manifest."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "encrypted_manifest.json"


def main() -> None:
    if not MANIFEST.exists():
        raise SystemExit("encrypted_manifest.json não encontrado; rode scripts/encrypt_data.py primeiro.")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    removed = 0
    missing = []
    for entry in manifest.get("entries", []):
        original = ROOT / entry["original_path"]
        encrypted = ROOT / entry["encrypted_path"]
        if not encrypted.exists():
            missing.append(entry["encrypted_path"])
            continue
        if original.exists():
            original.unlink()
            removed += 1
    if missing:
        raise SystemExit("Arquivos criptografados ausentes; nada removido com segurança:\n" + "\n".join(missing))
    print(f"REMOVED_PLAIN_FILES={removed}")


if __name__ == "__main__":
    main()
