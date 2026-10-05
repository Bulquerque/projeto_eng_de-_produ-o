#!/usr/bin/env python3
"""Generate or verify a hash inventory for preserved validation evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VALIDATION = ROOT / 'data/validation'
MANIFEST = VALIDATION / 'evidence-manifest.json'


def current_commit() -> str:
    return subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()


def evidence_files() -> list[dict[str, object]]:
    records = []
    for path in sorted(VALIDATION.rglob('*')):
        if not path.is_file() or path == MANIFEST:
            continue
        relative = path.relative_to(ROOT).as_posix()
        records.append(
            {
                'path': relative,
                'size_bytes': path.stat().st_size,
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'execution_metadata': 'not_verified_from_inventory; inspect the artifact itself',
            }
        )
    return records


def expected_manifest() -> dict[str, object]:
    files = evidence_files()
    return {
        'schema_version': 1,
        'generated_by': 'python scripts/manage_validation_evidence_manifest.py --write',
        'generated_from_commit': current_commit(),
        'freshness_policy': (
            'Hashes identify these bytes only. A current commit association does not mean '
            'the report was produced by that commit or that its checks passed there. '
            'Use embedded run metadata or rerun the documented command.'
        ),
        'count': len(files),
        'files': files,
    }


def commit_is_current_ancestor(commit: str) -> bool:
    if not re.fullmatch(r'[0-9a-f]{40,64}', commit):
        return False
    return (
        subprocess.run(
            ['git', 'merge-base', '--is-ancestor', commit, 'HEAD'],
            cwd=ROOT,
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        ).returncode
        == 0
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--write', action='store_true', help='Regenerate the evidence inventory')
    mode.add_argument('--check', action='store_true', help='Fail if the inventory is stale')
    args = parser.parse_args()
    rendered = json.dumps(expected_manifest(), ensure_ascii=False, indent=2) + '\n'

    if args.write:
        MANIFEST.write_text(rendered, encoding='utf-8')
        print(f'Evidence inventory written: {MANIFEST.relative_to(ROOT)}')
        return 0

    try:
        actual = json.loads(MANIFEST.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        actual = None
    expected = expected_manifest()
    valid_revision = isinstance(actual, dict) and commit_is_current_ancestor(
        str(actual.get('generated_from_commit', ''))
    )
    if isinstance(actual, dict):
        actual.pop('generated_from_commit', None)
    expected.pop('generated_from_commit', None)
    if actual != expected or not valid_revision:
        print('Evidence inventory is stale; run the command with --write.', file=sys.stderr)
        return 1
    print('Validation evidence inventory is current.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
