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
from decimal import Decimal, InvalidOperation
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


def validate_manuscript_hash(data: bytes, manifest: dict[str, object]) -> list[str]:
    expected = manifest.get('authorized_manuscript_sha256')
    if not isinstance(expected, str) or not re.fullmatch(r'[0-9a-f]{64}', expected):
        return ['Authorized manuscript SHA-256 is missing or malformed in the run manifest.']
    if sha256(data) != expected:
        return ['Authorized manuscript SHA-256 does not match the run manifest.']
    return []


def scientific_readiness(manifest_status: str, *, blocked: bool, errors: list[str]) -> str:
    if errors or blocked:
        return 'BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS'
    return manifest_status if manifest_status not in ('', 'UNKNOWN') else 'UNASSESSED'


def validate_numeric_rows(
    relative: str, rows: list[dict[str, str]], run_id: str, headers: list[str] | None = None
) -> list[str]:
    """Recalculate available identities without importing the model or exporter."""
    errors: list[str] = []
    if headers is None:
        headers = list(rows[0]) if rows else []
    scenario = relative.endswith('/scenario_summary_all.csv')
    decomposition = relative.endswith(
        (
            '/baseline_anchored_vs_unanchored.csv',
            '/tabela_4_2_baseline_reconciliation.csv',
            '/e1_baseline_decomposition.csv',
        )
    )
    monte_carlo = relative.endswith('/monte_carlo_paired_summary.csv')
    tax = relative.endswith(('/tax_2033_sensitivity.csv', '/2033_scenario_comparison.csv', '/2033_tax_breakdown.csv'))
    profiles = relative.endswith(('/tabela_4_5_12_perfis.csv', '/tabela_4_5_e1_sem_tributo.csv'))
    if not any((scenario, decomposition, monte_carlo, tax, profiles)):
        return errors
    if set(headers) == {'status', 'reason_code', 'blocking_reason'}:
        if not rows or not all(
            row.get('status', '').startswith('BLOCKED') and row.get('blocking_reason') for row in rows
        ):
            errors.append(f'{relative}: invalid blocked placeholder.')
        return errors
    required = {'run_id'}
    if scenario:
        required.update(
            {
                'company_id',
                'scenario_id',
                'transfer_brl',
                'distribution_brl',
                'storage_brl',
                'inventory_brl',
                'logistics_brl',
                'tax_impact_brl',
                'total_with_tax_brl',
                'baseline_comparable_id',
                'baseline_logistics_brl',
                'baseline_total_brl',
                'saving_logistics_pct',
                'saving_total_pct',
                'source_classification',
            }
        )
    if decomposition:
        required.update(
            {'company_id', 'component', 'anchored_value_brl', 'physical_unanchored_value_brl', 'delta_brl', 'status'}
        )
    if monte_carlo:
        required.update(
            {
                'company_id',
                'scenario_id',
                'baseline_scenario_id',
                'iterations_requested',
                'iterations_valid',
                'iterations_invalid',
                'prob_candidate_cheaper',
                'prob_tie',
                'p10_delta_cost_brl',
                'p50_delta_cost_brl',
                'p90_delta_cost_brl',
                'paired_method',
            }
        )
    if tax:
        required.update(
            {
                'scenario',
                'assumption',
                'tax_year',
                'tax_regime',
                'logistics_brl',
                'tax_impact_brl',
                'total_with_tax_brl',
                'source_class',
                'fiscal_validation',
            }
        )
    if profiles:
        required.update(
            {
                'company_id',
                'profile_id',
                'candidate_space_base',
                'candidate_space_extended',
                'candidates_simulated',
                'candidates_valid',
                'winner_scenario_id',
                'winner_total_brl',
                'methodology_status',
            }
        )
    missing = required - set(headers)
    if missing:
        errors.append(f'{relative}: missing required columns: {sorted(missing)}')
        return errors
    for index, row in enumerate(rows, 2):
        if set(row) == {'status', 'reason_code', 'blocking_reason'} and row['status'].startswith('BLOCKED'):
            continue
        if row.get('run_id') != run_id:
            errors.append(f'{relative}:{index}: run_id differs from manifest.')

        def number(key: str, row: dict[str, str] = row, index: int = index) -> Decimal | None:
            value = row.get(key, '').strip()
            if not value:
                return None
            try:
                result = Decimal(value)
                if not result.is_finite():
                    raise InvalidOperation
                return result
            except InvalidOperation:
                errors.append(f'{relative}:{index}: {key} is not a finite number.')
                return None

        def identity(keys: tuple[str, ...], target: str, tolerance: str = '0.05', index: int = index) -> None:
            values = [number(key) for key in keys]
            expected = number(target)
            if expected is not None and all(value is not None for value in values):
                if abs(sum(values, Decimal(0)) - expected) > Decimal(tolerance):
                    errors.append(f'{relative}:{index}: {target} does not match its components.')

        if scenario:
            identity(('transfer_brl', 'distribution_brl', 'storage_brl', 'inventory_brl'), 'logistics_brl')
            identity(('logistics_brl', 'tax_impact_brl'), 'total_with_tax_brl')
            for baseline, actual, saving in (
                ('baseline_total_brl', 'total_with_tax_brl', 'saving_total_pct'),
                ('baseline_logistics_brl', 'logistics_brl', 'saving_logistics_pct'),
            ):
                base, value, pct = number(baseline), number(actual), number(saving)
                if base is not None and value is not None and pct is not None and base != 0:
                    if abs((base - value) * 100 / base - pct) > Decimal('0.001'):
                        errors.append(f'{relative}:{index}: {saving} does not match the comparable baseline.')
            if row.get('total_with_tax_brl') and not row.get('source_classification'):
                errors.append(f'{relative}:{index}: numeric result has no source classification.')
        if decomposition:
            anchor, physical, delta = (
                number(key) for key in ('anchored_value_brl', 'physical_unanchored_value_brl', 'delta_brl')
            )
            if None not in (anchor, physical, delta) and abs(physical - anchor - delta) > Decimal('0.05'):
                errors.append(f'{relative}:{index}: baseline delta is inconsistent.')
        if tax:
            identity(('logistics_brl', 'tax_impact_brl'), 'total_with_tax_brl')
        if monte_carlo:
            requested, valid, invalid = (
                number(key) for key in ('iterations_requested', 'iterations_valid', 'iterations_invalid')
            )
            if None not in (requested, valid, invalid) and (
                min(requested, valid, invalid) < 0 or valid + invalid != requested
            ):
                errors.append(f'{relative}:{index}: iteration counts are inconsistent.')
            for key in ('prob_candidate_cheaper', 'prob_tie'):
                probability = number(key)
                if probability is not None and not Decimal(0) <= probability <= Decimal(1):
                    errors.append(f'{relative}:{index}: {key} is outside [0, 1].')
            quantiles = [number(key) for key in ('p10_delta_cost_brl', 'p50_delta_cost_brl', 'p90_delta_cost_brl')]
            if all(value is not None for value in quantiles) and quantiles != sorted(quantiles):
                errors.append(f'{relative}:{index}: Monte Carlo percentiles are not ordered.')
    return errors


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

        manuscript = '11_DOCUMENTOS_TCC/TCC_BASE_PARA_REVISAO.docx'
        document_paths = [name for name in contents if name.lower().endswith('.docx')]
        if any(name != manuscript for name in document_paths):
            errors.append('Unexpected DOCX in archive; only the authorized manuscript path is allowed.')
        if manuscript in contents:
            row = registry.get(manuscript, {})
            if (
                row.get('produced') != 'true'
                or row.get('status') != 'AUTHORIZED_PRIVATE_REVIEW'
                or row.get('sensitivity') != 'PRIVATE_REVIEWER_ONLY'
                or row.get('source') != 'author_confirmed_source'
            ):
                errors.append('DOCX lacks authorized private-reviewer registry classification.')
            try:
                with zipfile.ZipFile(io.BytesIO(contents[manuscript])) as docx:
                    if docx.testzip() or not {'[Content_Types].xml', 'word/document.xml'}.issubset(docx.namelist()):
                        errors.append('Invalid authorized DOCX container.')
            except zipfile.BadZipFile:
                errors.append('Invalid authorized DOCX container.')
            warnings.append(
                'PRIVATE_REVIEWER_ONLY: manuscript content and embedded media require separate confidentiality review; scanner does not inspect the DOCX internally.'
            )
        else:
            warnings.append('Authorized manuscript absent; editorial handoff remains blocked.')

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
        if manuscript in contents:
            errors.extend(validate_manuscript_hash(contents[manuscript], manifest_data))
            if manifest_data.get('privacy_classification') != 'PRIVATE_REVIEWER_ONLY':
                errors.append('Manifest must classify the manuscript package PRIVATE_REVIEWER_ONLY.')

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
                    else:
                        structured_rows = [dict(zip(rows[0], row, strict=True)) for row in rows[1:]]
                        errors.extend(
                            validate_numeric_rows(
                                relative, structured_rows, str(manifest_data.get('run_id', '')), rows[0]
                            )
                        )
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
        warnings.append(
            'Scanner checks common credential and formatted identifier patterns only; it does not certify absence of raw commercial records, routes, unformatted identifiers, or confidential data in embedded media. SEC_001 is not established by this scan.'
        )
        warnings.append(
            'Numeric checks cover listed CSV schemas and identities only when required values are present; provenance mapping and source validity are not independently established.'
        )

    return {
        'schema_version': 'tcc-handoff-validation-1.0',
        'validated_at_utc': datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'archive': str(zip_path),
        'files_checked': checked,
        'structural_status': 'PASS' if not errors else 'FAIL',
        'scientific_status': scientific_readiness(scientific_status, blocked=bool(blocked_rows), errors=errors),
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
