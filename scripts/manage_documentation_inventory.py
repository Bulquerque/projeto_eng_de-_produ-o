#!/usr/bin/env python3
"""Generate or verify deterministic documentation and test inventories."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'docs/06_manifestos/22_DOCUMENTATION_MANIFEST.json'
GENERATED_SUFFIXES = {'.pyc', '.pyo'}


def ignored_by_git(paths: list[Path]) -> set[str]:
    """Return paths excluded by the repository's ignore rules, including untracked files."""
    if not paths:
        return set()
    relative_paths = [path.relative_to(ROOT).as_posix() for path in paths]
    result = subprocess.run(
        ['git', 'check-ignore', '--no-index', '--stdin'],
        cwd=ROOT,
        input='\n'.join(relative_paths) + '\n',
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode not in (0, 1):
        raise RuntimeError(f'git check-ignore failed: {result.stderr.strip()}')
    return set(result.stdout.splitlines())


def files_below(directory: str) -> list[str]:
    base = ROOT / directory
    candidates = [path for path in base.rglob('*') if path.is_file() and path != MANIFEST]
    # Inventory source/evidence files even when newly added but not yet staged.
    # Exclude Python cache trees/bytecode and anything explicitly ignored by Git,
    # which is the repository's criterion for local or generated artifacts.
    candidates = [
        path
        for path in candidates
        if '__pycache__' not in path.relative_to(ROOT).parts and path.suffix.lower() not in GENERATED_SUFFIXES
    ]
    ignored = ignored_by_git(candidates)
    return sorted(
        path.relative_to(ROOT).as_posix() for path in candidates if path.relative_to(ROOT).as_posix() not in ignored
    )


def expected_manifest() -> dict[str, object]:
    docs = files_below('docs')
    tests = files_below('tests')
    return {
        'schema_version': 1,
        'purpose': 'Deterministic inventory of documentation and test files excluding ignored or generated artifacts.',
        'generated_by': 'python scripts/manage_documentation_inventory.py --write',
        'documentation': {'count': len(docs), 'files': docs},
        'tests': {'count': len(tests), 'files': tests},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--write', action='store_true', help='Regenerate the manifest')
    mode.add_argument('--check', action='store_true', help='Fail if the manifest is stale')
    args = parser.parse_args()
    rendered = json.dumps(expected_manifest(), ensure_ascii=False, indent=2) + '\n'

    if args.write:
        MANIFEST.write_text(rendered, encoding='utf-8')
        print(f'Documentation inventory written: {MANIFEST.relative_to(ROOT)}')
        return 0

    if not MANIFEST.exists() or MANIFEST.read_text(encoding='utf-8') != rendered:
        print('Documentation inventory is stale; run the command with --write.', file=sys.stderr)
        return 1
    print('Documentation and test inventories are current.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
