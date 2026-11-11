#!/usr/bin/env python3
"""Independently validate a generated TCC handoff ZIP using only stdlib.

The validator does not import simulator or package-builder code. It checks archive
layout, registry, required contract anchors, hashes, CSV/JSON structure, and common
secret/PII patterns. Structural PASS is kept separate from scientific readiness.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import PurePosixPath

ROOT_PREFIX = 'TCC_HANDOFF_AUDITADO_'
REQUIRED_ANCHORS = {
    'LEIA_ME_PRIMEIRO.md',
    'STATUS_FINAL.md',
    '00_MANIFESTO/run_manifest.json',
    '00_MANIFESTO/MANIFESTO.csv',
    '00_MANIFESTO/CHECKSUMS.sha256',
    '00_MANIFESTO/input_sources_manifest.json',
    '00_MANIFESTO/environment.json',
    '00_MANIFESTO/execution_commands.csv',
    '00_MANIFESTO/package_validation.json',
    '00_MANIFESTO/file_registry.csv',
    '01_AUDITORIA/MATRIZ_CRITICAS_C01_C15.csv',
    '01_AUDITORIA/AUDITORIA_H1_H12.md',
    '02_BASELINE_E_DADOS/tabela_4_2_baseline_reconciliation.csv',
    '03_TRIBUTACAO/2033_scenario_comparison.csv',
    '04_CENARIOS_E_OTIMIZACAO/tabela_4_5_12_perfis.csv',
    '05_MONTE_CARLO/monte_carlo_paired_summary.csv',
    '06_TESTES_E_QA/TEST_REPORT.md',
    '07_SITE_DEMO/site_identity_audit.md',
    '08_ATUALIZACAO_TCC/GUIA_ATUALIZACAO_TCC.md',
    '09_CODIGO_E_REVISAO/CHANGELOG_AUDITORIA.md',
    '10_TCC_HANDOFF/RESUMO_EXECUTIVO_PARA_REVISOR.md',
    '10_TCC_HANDOFF/VEREDITO_POR_CONCLUSAO.csv',
    '10_TCC_HANDOFF/GUIA_REESCRITA_CAPITULO_1.md',
    '10_TCC_HANDOFF/GUIA_REESCRITA_CAPITULO_2.md',
    '10_TCC_HANDOFF/GUIA_REESCRITA_CAPITULO_3.md',
    '10_TCC_HANDOFF/GUIA_REESCRITA_CAPITULO_4.md',
    '10_TCC_HANDOFF/GUIA_REESCRITA_CAPITULO_5.md',
    '10_TCC_HANDOFF/MAPA_REVISAO_PARAGRAFO_A_PARAGRAFO.csv',
    '11_DOCUMENTOS_TCC/INVENTARIO_DOCUMENTAL.md',
}
REGISTRY_COLUMNS = {
    'path',
    'obligation',
    'produced',
    'status',
    'source',
    'run_id',
    'sensitivity',
    'blocking_reason',
    'effect_on_tcc',
}
HASH_EXCLUSIONS = {
    '00_MANIFESTO/CHECKSUMS.sha256',
    '00_MANIFESTO/package_validation.json',
}
SENSITIVE_FILENAME = re.compile(r'(^|[/_.-])(?:\.env|.*\.enc\.json|id_rsa|id_ed25519)(?:$|[/_.-])', re.I)
SECRET_PATTERNS = [
    ('private key block', re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')),
    ('JWT-like token', re.compile(rb'\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b')),
    ('AWS access key', re.compile(rb'\bAKIA[0-9A-Z]{16}\b')),
    ('GitHub token', re.compile(rb'\bgh[pousr]_[A-Za-z0-9_]{30,}\b')),
    (
        'credential assignment',
        re.compile(rb'(?i)\b(?:password|passwd|api[_-]?key|access[_-]?token)\s*[:=]\s*["\']?[^\s"\']{8,}'),
    ),
]
CPF_RE = re.compile(rb'\b\d{3}\.\d{3}\.\d{3}-\d{2}\b')
CNPJ_RE = re.compile(rb'\b\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\b')


class ValidationError(Exception):
    pass


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validate_archive(zip_path: str) -> dict[str, object]:
    errors: list[str] = []
    warnings: list[str] = []
    checked = 0
    try:
        archive = zipfile.ZipFile(zip_path)
    except (OSError, zipfile.BadZipFile) as error:
        raise ValidationError(f'Cannot open ZIP: {error}') from error

    with archive:
        bad_member = archive.testzip()
        if bad_member:
            errors.append(f'ZIP CRC failure: {bad_member}')
        names = [item.filename for item in archive.infolist() if not item.is_dir()]
        if len(names) != len(set(names)):
            errors.append('Duplicate archive member names found.')
        roots = {PurePosixPath(name).parts[0] for name in names if PurePosixPath(name).parts}
        if len(roots) != 1:
            errors.append(f'Expected one root directory; found {sorted(roots)}')
        elif not next(iter(roots)).startswith(ROOT_PREFIX):
            errors.append('Root directory does not use the TCC_HANDOFF_AUDITADO_ contract name.')
        contents: dict[str, bytes] = {}
        for name in names:
            pure = PurePosixPath(name)
            if pure.is_absolute() or '..' in pure.parts:
                errors.append(f'Unsafe archive path: {name}')
                continue
            relative = str(PurePosixPath(*pure.parts[1:]))
            if SENSITIVE_FILENAME.search(relative):
                errors.append(f'Sensitive filename pattern found: {relative}')
            try:
                contents[relative] = archive.read(name)
                checked += 1
            except (KeyError, RuntimeError, zipfile.BadZipFile) as error:
                errors.append(f'Cannot read {name}: {error}')

        missing = sorted(REQUIRED_ANCHORS - set(contents))
        if missing:
            errors.append(f'Missing required contract anchors: {missing}')

        registry_bytes = contents.get('00_MANIFESTO/file_registry.csv')
        registry: dict[str, dict[str, str]] = {}
        if registry_bytes:
            try:
                reader = csv.DictReader(io.StringIO(registry_bytes.decode('utf-8-sig')))
                if not reader.fieldnames or not REGISTRY_COLUMNS.issubset(reader.fieldnames):
                    errors.append('file_registry.csv is missing required columns.')
                for row in reader:
                    path = row.get('path', '')
                    if not path or path in registry:
                        errors.append(f'Empty or duplicate file_registry path: {path!r}')
                        continue
                    registry[path] = row
                    if row.get('obligation') not in ('required', 'conditional'):
                        errors.append(f'Invalid obligation for {path}: {row.get("obligation")}')
                    if row.get('produced') not in ('true', 'false'):
                        errors.append(f'Invalid produced value for {path}: {row.get("produced")}')
                    if row.get('produced') == 'false' and not row.get('blocking_reason'):
                        errors.append(f'Unproduced file lacks blocking_reason: {path}')
                    if row.get('produced') == 'true' and path not in contents:
                        errors.append(f'Registry says produced but file is absent: {path}')
                    if row.get('status', '').startswith('BLOCKED') and not row.get('blocking_reason'):
                        errors.append(f'Blocked file lacks blocking_reason: {path}')
            except (UnicodeDecodeError, csv.Error) as error:
                errors.append(f'Invalid file_registry.csv: {error}')
        for anchor in REQUIRED_ANCHORS:
            if anchor not in registry:
                errors.append(f'Required file is not registered: {anchor}')

        checksum_bytes = contents.get('00_MANIFESTO/CHECKSUMS.sha256')
        if checksum_bytes:
            seen_hashes: set[str] = set()
            try:
                for line_number, line in enumerate(checksum_bytes.decode('utf-8').splitlines(), 1):
                    if not line.strip():
                        continue
                    match = re.fullmatch(r'([0-9a-f]{64})  (.+)', line)
                    if not match:
                        errors.append(f'Invalid checksum line {line_number}.')
                        continue
                    expected, relative = match.groups()
                    if relative in seen_hashes:
                        errors.append(f'Duplicate checksum entry: {relative}')
                    seen_hashes.add(relative)
                    if relative in HASH_EXCLUSIONS:
                        errors.append(f'Excluded file listed in checksum file: {relative}')
                    if relative not in contents:
                        errors.append(f'Checksum target missing: {relative}')
                    elif sha256(contents[relative]) != expected:
                        errors.append(f'Checksum mismatch: {relative}')
                expected_hash_targets = set(contents) - HASH_EXCLUSIONS - {'00_MANIFESTO/CHECKSUMS.sha256'}
                if seen_hashes != expected_hash_targets:
                    errors.append('Checksum file does not cover exactly the expected non-recursive package files.')
            except UnicodeDecodeError as error:
                errors.append(f'Checksum file is not UTF-8: {error}')

        manifest_data: dict[str, object] = {}
        if '00_MANIFESTO/run_manifest.json' in contents:
            try:
                manifest_data = json.loads(contents['00_MANIFESTO/run_manifest.json'])
                if not manifest_data.get('run_id'):
                    errors.append('run_manifest.json has no run_id.')
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                errors.append(f'Invalid run_manifest.json: {error}')

        # Check structured data files independently of application code.
        for relative, data in contents.items():
            if relative.endswith('.json'):
                try:
                    parsed = json.loads(data)
                    if not isinstance(parsed, (dict, list)):
                        errors.append(f'JSON root must be object or array: {relative}')
                except (UnicodeDecodeError, json.JSONDecodeError) as error:
                    errors.append(f'Invalid JSON {relative}: {error}')
            elif relative.endswith('.csv'):
                try:
                    rows = list(csv.reader(io.StringIO(data.decode('utf-8-sig'))))
                    if not rows or not any(cell.strip() for cell in rows[0]):
                        errors.append(f'CSV has no header row: {relative}')
                    elif any(len(row) != len(rows[0]) for row in rows[1:]):
                        errors.append(f'CSV column count mismatch: {relative}')
                except (UnicodeDecodeError, csv.Error) as error:
                    errors.append(f'Invalid CSV {relative}: {error}')

        for relative, data in contents.items():
            if not relative.lower().endswith(
                ('.png', '.jpg', '.jpeg', '.svg', '.csv', '.json', '.md', '.txt', '.xml', '.html', '.patch')
            ):
                continue
            for label, pattern in SECRET_PATTERNS:
                if pattern.search(data):
                    errors.append(f'Possible {label} in {relative}.')
            if CPF_RE.search(data):
                errors.append(f'CPF-shaped identifier found in {relative}.')
            if CNPJ_RE.search(data):
                errors.append(f'CNPJ-shaped identifier found in {relative}.')

        # Scientific readiness is reported separately from structural validation.
        blocked_rows = [row for row in registry.values() if row.get('status', '').startswith('BLOCKED')]
        scientific_status = str(manifest_data.get('overall_status', 'UNKNOWN'))
        if blocked_rows and scientific_status != 'BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS':
            errors.append('Package contains blocked evidence but manifest does not block final numerical claims.')
        if blocked_rows:
            warnings.append(f'{len(blocked_rows)} registry items are blocked; scientific claims remain unavailable.')

    return {
        'schema_version': 'tcc-handoff-validation-1.0',
        'validated_at_utc': datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'archive': str(zip_path),
        'files_checked': checked,
        'structural_status': 'PASS' if not errors else 'FAIL',
        'scientific_status': 'BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS' if errors or warnings else 'UNASSESSED',
        'errors': errors,
        'warnings': warnings,
        'independence_note': 'stdlib-only validator; no simulator or package-builder imports.',
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('zip_path')
    parser.add_argument('--write-report', help='Write validation JSON to this path (outside the ZIP recommended).')
    args = parser.parse_args()
    try:
        report = validate_archive(args.zip_path)
    except ValidationError as error:
        print(f'VALIDATION_FAILED: {error}', file=sys.stderr)
        return 2
    serialized = json.dumps(report, indent=2, sort_keys=True) + '\n'
    if args.write_report:
        with open(args.write_report, 'w', encoding='utf-8') as handle:
            handle.write(serialized)
    print(serialized, end='')
    return 0 if report['structural_status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
