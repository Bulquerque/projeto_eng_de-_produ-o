from __future__ import annotations

import base64
import json
import math
import sys
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from etl.project_paths import (  # noqa: E402
    MANIFEST_PATH,
    PROJECT_ROOT,
    read_env_value,
    rel,
    resolve_project_path,
)

ROOT = PROJECT_ROOT
BAD = {None, '', '#REF!', '#DIV/0!', '#VALUE!', '#N/A'}
BAD_TEXT = {value for value in BAD if isinstance(value, str)}


class DataContractError(ValueError):
    """Raised when a protected input no longer matches the ETL contract."""


def _password():
    value = read_env_value('VISAGIO_DATA_PASSWORD')
    if not value:
        raise RuntimeError('VISAGIO_DATA_PASSWORD missing for encrypted data load')
    return value


def _manifest():
    if not MANIFEST_PATH.is_file():
        raise DataContractError(f'Manifesto criptográfico ausente: {rel(MANIFEST_PATH)}')
    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
    except json.JSONDecodeError as exc:
        raise DataContractError(f'Manifesto criptográfico inválido: {rel(MANIFEST_PATH)}') from exc
    entries = manifest.get('entries') if isinstance(manifest, dict) else None
    if not isinstance(entries, list):
        raise DataContractError('Manifesto criptográfico não contém uma lista entries.')
    seen = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise DataContractError('Manifesto criptográfico contém uma entrada que não é objeto.')
        original = entry.get('original_path')
        encrypted = entry.get('encrypted_path')
        if not isinstance(original, str) or not isinstance(encrypted, str):
            raise DataContractError('Manifesto criptográfico contém paths ausentes ou não textuais.')
        if original in seen:
            raise DataContractError(f'Entrada duplicada no manifesto: {original}')
        seen.add(original)
        if not original.startswith(('data/empresa1/', 'data/empresa2/')):
            raise DataContractError(f'Original fora do escopo protegido: {original}')
        if not encrypted.endswith('.enc.json'):
            raise DataContractError(f'Ciphertext fora do padrão .enc.json: {encrypted}')
        resolve_project_path(original, field='original_path')
        resolve_project_path(encrypted, field='encrypted_path')
    return manifest


def _decrypt_json(rel_path, manifest=None):
    rel_path = rel(resolve_project_path(rel_path, field='original_path'))
    manifest = manifest or _manifest()
    entry = next((item for item in manifest['entries'] if item['original_path'] == rel_path), None)
    if not entry:
        raise DataContractError(f'Arquivo JSON não está registrado no manifesto: {rel_path}')
    encrypted_path = resolve_project_path(entry['encrypted_path'], field='encrypted_path')
    if not encrypted_path.is_file():
        raise FileNotFoundError(entry['encrypted_path'])
    try:
        envelope = json.loads(encrypted_path.read_text(encoding='utf-8'))
        if not isinstance(envelope, dict):
            raise DataContractError(f'Envelope não é objeto: {entry["encrypted_path"]}')
        required = {'salt', 'iv', 'ciphertext', 'iterations', 'aad'}
        missing = sorted(required - envelope.keys())
        if missing:
            raise DataContractError(f'Envelope incompleto ({", ".join(missing)}): {entry["encrypted_path"]}')
        if envelope['aad'] != rel_path:
            raise DataContractError(f'AAD divergente para {rel_path}: {envelope["aad"]!r}')
        salt = base64.b64decode(envelope['salt'], validate=True)
        iv = base64.b64decode(envelope['iv'], validate=True)
        ciphertext = base64.b64decode(envelope['ciphertext'], validate=True)
        iterations = int(envelope['iterations'])
        if len(salt) < 16 or len(iv) != 12 or len(ciphertext) <= 16 or iterations <= 0:
            raise DataContractError(f'Parâmetros criptográficos inválidos: {entry["encrypted_path"]}')
        kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iterations)
        key = kdf.derive(_password().encode('utf-8'))
        plaintext = AESGCM(key).decrypt(iv, ciphertext, rel_path.encode('utf-8'))
        return json.loads(plaintext.decode('utf-8'))
    except DataContractError:
        raise
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise DataContractError(f'Envelope inválido ou JSON não decodificável: {entry["encrypted_path"]}') from exc
    except Exception as exc:
        raise DataContractError(f'Falha ao descriptografar {rel_path}: {entry["encrypted_path"]}') from exc


def jload(p):
    path = resolve_project_path(p)
    rel_path = rel(path)
    manifest = _manifest()
    if any(item['original_path'] == rel_path for item in manifest['entries']):
        return _decrypt_json(rel_path, manifest)
    if path.is_file():
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except json.JSONDecodeError as exc:
            raise DataContractError(f'JSON inválido: {rel_path}') from exc
    raise FileNotFoundError(rel_path)


def jsave(p, o):
    path = resolve_project_path(p)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(o, ensure_ascii=False, indent=2), encoding='utf-8')


def num(x, d=0.0, *, issues=None, field=None, row=None):
    if x is None or (isinstance(x, str) and not x.strip()):
        return d
    if isinstance(x, str) and x.strip() in BAD_TEXT:
        if issues is not None:
            issues.append({'field': field, 'row': row, 'value': x, 'default': d})
        return d
    try:
        value = float(x)
    except (TypeError, ValueError):
        if issues is not None:
            issues.append({'field': field, 'row': row, 'value': str(x), 'default': d})
        return d
    if not math.isfinite(value):
        if issues is not None:
            issues.append({'field': field, 'row': row, 'value': str(x), 'default': d})
        return d
    return value


def txt(x):
    value = '' if x is None else str(x).strip()
    return '' if value in BAD_TEXT else value


def norm_text(x):
    value = ' '.join(txt(x).split())
    return ''.join(char for char in unicodedata.normalize('NFKD', value.casefold()) if not unicodedata.combining(char))


def perr(sim, ref):
    return None if ref == 0 else (sim - ref) / ref * 100


def fit(company, scenario, simulated, reference, source=None):
    if not reference:
        return {
            'company_id': company,
            'scenario_id': scenario,
            'base_fit_score': None,
            'status': 'benchmark_pending',
            'reference_source': None,
            'errors_by_metric': [],
            'warnings': [
                'Sem benchmark histórico consolidado independente no pacote para calcular Base Fit Score sem inventar benchmark.'
            ],
            'errors': [],
        }
    rows = []
    for k, ref in reference.items():
        if k not in simulated:
            continue
        s = num(simulated[k])
        r = num(ref)
        pe = perr(s, r)
        ap = abs(pe) if pe is not None else None
        st = (
            'OK'
            if ap is not None and ap <= 3
            else ('atenção' if ap is not None and ap <= 10 else ('alto_desvio' if ap is not None else 'sem_referencia'))
        )
        rows.append(
            {'metric': k, 'reference': r, 'simulated': s, 'absolute_error': s - r, 'percentage_error': pe, 'status': st}
        )
    usable = [x for x in rows if x['percentage_error'] is not None]
    score = round(sum(max(0, 100 - abs(x['percentage_error']) * 4) for x in usable) / len(usable)) if usable else None
    return {
        'company_id': company,
        'scenario_id': scenario,
        'base_fit_score': score,
        'status': 'OK'
        if score is not None and score >= 90
        else ('atenção' if score is not None and score >= 70 else 'alto_desvio'),
        'reference_source': source,
        'errors_by_metric': rows,
        'warnings': [x['metric'] + ' com desvio alto' for x in rows if x['status'] == 'alto_desvio'],
        'errors': [],
    }


def reconcile_tax(canonical_total, raw_matrix_total, tolerance_pct=1.0, adjustment_factor=None):
    adjusted_matrix_total = raw_matrix_total
    notes = []
    if adjustment_factor is not None:
        adjusted_matrix_total = raw_matrix_total * ((1 + adjustment_factor) * (1 + adjustment_factor))
        notes.append(
            f'O ajuste de sensibilidade Δ Faturamento={adjustment_factor:.12f} foi preservado separadamente; o status usa a diferença bruta e não mascara a reconciliação observada.'
        )
    raw_diff = raw_matrix_total - canonical_total
    raw_pct = None if canonical_total == 0 else (raw_diff / canonical_total * 100)
    adjusted_diff = adjusted_matrix_total - canonical_total
    adjusted_pct = None if canonical_total == 0 else (adjusted_diff / canonical_total * 100)
    within_tolerance = raw_matrix_total == canonical_total if canonical_total == 0 else abs(raw_pct) <= tolerance_pct
    warning = (
        None
        if within_tolerance
        else f'Reconciliação tributária divergente: scenario_totals={canonical_total:.2f}, matriz_bruta={raw_matrix_total:.2f}, delta={raw_diff:.2f} ({raw_pct:.2f}%).'
    )
    return {
        'canonical_total': canonical_total,
        'raw_matrix_total': raw_matrix_total,
        'matrix_total': raw_matrix_total,
        'adjusted_matrix_total': adjusted_matrix_total,
        'raw_difference': raw_diff,
        'raw_difference_pct': raw_pct,
        'difference': raw_diff,
        'difference_pct': raw_pct,
        'adjusted_difference': adjusted_diff,
        'adjusted_difference_pct': adjusted_pct,
        'tolerance_pct': tolerance_pct,
        'status': 'within_tolerance' if within_tolerance else 'divergent',
        'warning': warning,
        'adjustment_factor': adjustment_factor,
        'adjustment_applied': adjustment_factor is not None,
        'notes': notes,
    }


def reconcile_costs(simulated, reference):
    if not reference:
        return {
            'status': 'pending',
            'label': 'reconciliação operacional pendente',
            'source': None,
            'rows': [],
            'summary': {
                'compared_metrics': 0,
                'missing_metrics': 0,
                'mean_abs_error_pct': None,
                'max_abs_error_pct': None,
                'aligned_metrics': 0,
                'tolerable_metrics': 0,
                'divergent_metrics': 0,
            },
            'warnings': ['Sem referência operacional consolidada para comparar custos.'],
        }
    rows = []
    for metric, ref in reference.items():
        has_simulated = metric in simulated
        s = num(simulated[metric], None) if has_simulated else None
        r = num(ref, None)
        pe = None if s is None or r in (None, 0) else (s - r) / r * 100
        ap = abs(pe) if pe is not None else None
        status = (
            'aligned'
            if ap is not None and ap <= 3
            else ('tolerable' if ap is not None and ap <= 10 else ('divergent' if ap is not None else 'pending'))
        )
        rows.append(
            {
                'metric': metric,
                'reference': r,
                'simulated': s,
                'absolute_error': None if s is None or r is None else s - r,
                'percentage_error': pe,
                'status': status,
            }
        )
    abs_values = [abs(x['percentage_error']) for x in rows if x['percentage_error'] is not None]
    summary = {
        'compared_metrics': len(rows),
        'missing_metrics': sum(1 for x in rows if x['simulated'] is None or x['reference'] is None),
        'mean_abs_error_pct': sum(abs_values) / len(abs_values) if abs_values else None,
        'max_abs_error_pct': max(abs_values) if abs_values else None,
        'aligned_metrics': sum(1 for x in rows if x['status'] == 'aligned'),
        'tolerable_metrics': sum(1 for x in rows if x['status'] == 'tolerable'),
        'divergent_metrics': sum(1 for x in rows if x['status'] == 'divergent'),
    }
    if not rows or summary['missing_metrics']:
        status = 'pending'
    else:
        status = 'aligned' if summary['divergent_metrics'] == 0 else 'partial'
    label = 'reconciliação operacional alinhada' if status == 'aligned' else 'reconciliação operacional parcial'
    if status == 'pending':
        label = 'reconciliação operacional pendente'
    warnings = []
    if summary['missing_metrics']:
        warnings.append('A referência operacional possui métricas sem valor comparável no resultado simulado.')
    if not rows:
        warnings.append('Nenhuma métrica operacional comum foi encontrada para reconciliação.')
    return {
        'status': status,
        'label': label,
        'source': 'workbook_scenario_totals_cenario_1',
        'rows': rows,
        'summary': summary,
        'warnings': warnings,
    }


def build_bundle_reconciliation(model, costs, tax, base_fit):
    operational = reconcile_costs(costs.get('costs', {}), costs.get('reference_results'))
    tax_recon = tax.get('tax_reconciliation') or tax.get('tax_results', {}).get('tax_reconciliation')
    if not tax_recon:
        tax_recon = {'status': 'pending', 'warning': 'Reconciliação tributária ausente.'}
    tax_block = {
        'status': tax_recon.get('status', 'pending'),
        'label': 'reconciliação tributária alinhada'
        if tax_recon.get('status') == 'within_tolerance'
        else (
            'reconciliação tributária divergente'
            if tax_recon.get('status') == 'divergent'
            else 'reconciliação tributária pendente'
        ),
        'source': 'dados_tributario / scenario_totals / parâmetros do workbook',
        'summary': tax_recon,
        'warnings': [*(tax_recon.get('notes') or []), *([tax_recon['warning']] if tax_recon.get('warning') else [])],
    }
    if (
        operational['status'] == 'pending'
        and tax_block['status'] == 'pending'
        and base_fit.get('status') == 'benchmark_pending'
    ):
        overall = {'status': 'pending', 'label': 'reconciliação plena pendente'}
    elif operational['status'] == 'aligned' and tax_block['status'] == 'within_tolerance':
        overall = {'status': 'fully_reconciled', 'label': 'reconciliação plena'}
    elif operational['status'] == 'aligned' and tax_block['status'] == 'divergent':
        overall = {
            'status': 'partial_tax_divergence',
            'label': 'reconciliação operacional completa com divergência tributária',
        }
    elif operational['status'] == 'partial' or tax_block['status'] == 'divergent':
        overall = {'status': 'partial', 'label': 'reconciliação parcial'}
    else:
        overall = {'status': 'pending', 'label': 'reconciliação pendente'}
    return {
        'company_id': model.get('company_id'),
        'scenario_id': model.get('scenario_id'),
        'operational': operational,
        'tax': tax_block,
        'overall': overall,
        'warnings': [*(operational.get('warnings') or []), *(tax_block.get('warnings') or [])],
    }


def bestdist(matrix, uf, city):
    expected_uf = norm_text(uf)
    expected_city = norm_text(city)
    exact = [
        r
        for r in matrix
        if norm_text(r.get('UF_DESTINO')) == expected_uf and norm_text(r.get('DESTINO')) == expected_city
    ]
    rows = exact
    status = 'exact_match'
    if not rows:
        city_rows = [r for r in matrix if norm_text(r.get('DESTINO')) == expected_city]
        city_ufs = {norm_text(r.get('UF_DESTINO')) for r in city_rows if norm_text(r.get('UF_DESTINO'))}
        if city_rows and city_ufs == {expected_uf}:
            rows = city_rows
            status = 'city_name_fallback'
        elif city_rows:
            return None, 'uf_mismatch'
        else:
            status = 'missing_distance'
    if not rows:
        return None, status
    rows = sorted(rows, key=lambda r: (num(r.get('Frete (R$/Kg)'), 10**9), num(r.get('Distancia(KM)'), 10**9)))
    return rows[0], status


def build_empresa1():
    demand = jload('data/empresa1/core/demand_records.json')
    matrix = jload('data/empresa1/core/distance_matrix.json')
    prem = jload('data/empresa1/core/premissas.json')
    numeric_issues = []
    ass = {
        txt(p.get('premissa')): num(
            p.get('valor'), issues=numeric_issues, field='premissas.valor', row=p.get('__excel_row')
        )
        for p in prem
    }
    missing_assumptions = [name for name in ('Custo Armazenagem', 'WACC') if name not in ass]
    if missing_assumptions:
        raise DataContractError('Premissas obrigatórias ausentes: ' + ', '.join(missing_assumptions))
    agg = defaultdict(
        lambda: {
            'uf': '',
            'destination': '',
            'monthly_weight_kg': 0,
            'monthly_revenue': 0,
            'monthly_items': 0,
            'records': 0,
        }
    )
    invalid = 0
    for r in demand:
        uf = txt(r.get('UF'))
        city = txt(r.get('CENTROIDE'))
        if not uf or not city:
            invalid += 1
            continue
        k = (uf, city)
        a = agg[k]
        a['uf'] = uf
        a['destination'] = city
        a['records'] += 1
        a['monthly_weight_kg'] += num(
            r.get('PESO_DEMANDA_KG'),
            issues=numeric_issues,
            field='demand_records.PESO_DEMANDA_KG',
            row=r.get('__excel_row'),
        )
        a['monthly_revenue'] += num(
            r.get('FATURAMENTO_MENSAL'),
            issues=numeric_issues,
            field='demand_records.FATURAMENTO_MENSAL',
            row=r.get('__excel_row'),
        )
        a['monthly_items'] += num(
            r.get('QTD_ITENS_UNID'),
            issues=numeric_issues,
            field='demand_records.QTD_ITENS_UNID',
            row=r.get('__excel_row'),
        )
    flows = []
    warnings = []
    fallback = 0
    dropped = 0
    idx = 1
    for (uf, city), a in sorted(agg.items()):
        d, status = bestdist(matrix, uf, city)
        if status == 'city_name_fallback':
            fallback += 1
        if status != 'exact_match':
            warnings.append(f'Destino {uf}/{city}: resolução de distância com status {status}.')
        if not d:
            dropped += 1
            continue
        annual = a['monthly_weight_kg'] * 12
        freight = num(
            d.get('Frete (R$/Kg)'),
            issues=numeric_issues,
            field='distance_matrix.Frete (R$/Kg)',
            row=d.get('__excel_row'),
        )
        flows.append(
            {
                'flow_id': f'empresa1_base_{idx:03d}',
                'company_id': 'empresa1',
                'flow_type': 'cd_to_destination_proxy',
                'origin': txt(d.get('ORIGEM')),
                'origin_uf': txt(d.get('UF_ORIGEM')),
                'cd': txt(d.get('ORIGEM')),
                'cd_uf': txt(d.get('UF_ORIGEM')),
                'destination': city,
                'destination_uf': uf,
                'monthly_weight_kg': a['monthly_weight_kg'],
                'annual_weight_kg': annual,
                'monthly_revenue': a['monthly_revenue'],
                'annual_revenue': a['monthly_revenue'] * 12,
                'distance_km': num(
                    d.get('Distancia(KM)'),
                    issues=numeric_issues,
                    field='distance_matrix.Distancia(KM)',
                    row=d.get('__excel_row'),
                ),
                'freight_per_kg': freight,
                'distribution_cost': annual * freight,
                'distance_status': status,
                'source': 'demand_records + distance_matrix',
            }
        )
        idx += 1
    total_w = sum(f['monthly_weight_kg'] for f in flows)
    total_rev = sum(f['monthly_revenue'] for f in flows)
    dist = sum(f['distribution_cost'] for f in flows)
    storage = total_w * ass.get('Custo Armazenagem', 0) * 12
    inventory = total_rev * ass.get('WACC', 0)
    costs = {
        'transfer_cost': 0,
        'distribution_cost': dist,
        'storage_cost': storage,
        'inventory_cost': inventory,
        'tax_impact': 0,
        'total_logistics_cost': dist + storage + inventory,
        'total_with_tax': dist + storage + inventory,
    }
    if numeric_issues:
        warnings.append(
            f'{len(numeric_issues)} valor(es) numérico(s) inválido(s) foram substituídos por default explícito.'
        )
    model = {
        'scenario_id': 'baseline_empresa1',
        'scenario_type': 'baseline',
        'company_id': 'empresa1',
        'baseline_ready': True,
        'baseline_status': 'computed_baseline_without_historical_reference',
        'calculation_mode': 'proxy_from_demand_distance_premissas',
        'active_cds': sorted({f['cd_uf'] + ' / ' + f['cd'] for f in flows}),
        'origins': sorted({f['origin_uf'] + ' / ' + f['origin'] for f in flows}),
        'destinations': sorted({f['destination_uf'] + ' / ' + f['destination'] for f in flows}),
        'metadata': {
            'created_by': 'build_phase2_baseline.py',
            'phase': 2,
            'generated_at_utc': datetime.now(timezone.utc).isoformat(),
            'methodology': 'Demanda mensal agregada por UF/centroide; destino atendido pela origem/CD com menor frete R$/kg na matriz de distância. Transferência e tributo não são inferidos por ausência de fonte específica.',
            'demand_quality': {
                'raw_rows': len(demand),
                'canonical_rows': len(demand) - invalid,
                'invalid_rows_dropped': invalid,
                'invalid_row_rule': 'UF e CENTROIDE obrigatórios; linhas de rodapé/fórmula não entram no grão canônico.',
                'numeric_coercions': numeric_issues,
            },
        },
        'warnings': warnings
        + [
            'Empresa 1 não possui benchmark histórico consolidado; Base Fit Score fica pendente.',
            'Custo de transferência e tributo não foram inferidos para evitar inventar dado ausente.',
        ],
        'errors': [],
    }
    flow_summary = {
        'total_flows': len(flows),
        'demand_destinations_aggregated': len(agg),
        'invalid_demand_rows_dropped': invalid,
        'dropped_without_distance': dropped,
        'fallback_distance_count': fallback,
        'total_monthly_weight_kg': total_w,
        'total_annual_weight_kg': total_w * 12,
        'total_monthly_revenue': total_rev,
        'total_annual_revenue': total_rev * 12,
        'destinations_covered': len({(f['destination_uf'], f['destination']) for f in flows}),
        'unresolved_destinations': dropped,
        'numeric_coercion_count': len(numeric_issues),
    }
    cost_block = {
        'scenario_id': 'baseline_empresa1',
        'company_id': 'empresa1',
        'cost_basis': 'computed_proxy',
        'costs': costs,
        'assumptions_used': {
            'storage_cost_per_kg_month': ass.get('Custo Armazenagem', 0),
            'wacc': ass.get('WACC', 0),
            'inventory_value_proxy': 'one average month of revenue',
            'transfer_cost': 'not_available_in_source_data',
            'tax_impact': 'not_available_in_source_data',
        },
        'cost_breakdown': [
            {'metric': 'transfer_cost', 'value': 0, 'source': 'not_available_zeroed_with_warning'},
            {'metric': 'distribution_cost', 'value': dist, 'source': 'demand_weight_x_freight_per_kg'},
            {'metric': 'storage_cost', 'value': storage, 'source': 'monthly_weight_x_storage_cost_per_kg_month_x_12'},
            {'metric': 'inventory_cost', 'value': inventory, 'source': 'monthly_revenue_x_wacc'},
            {'metric': 'tax_impact', 'value': 0, 'source': 'not_available_zeroed_with_warning'},
        ],
        'warnings': model['warnings'],
        'errors': [],
    }
    tax = {
        'scenario_id': 'baseline_empresa1',
        'company_id': 'empresa1',
        'tax_results': {'icms_estimated': 0, 'difal_estimated': 0, 'total_tax_impact': 0},
        'tax_coverage': {'flows_with_tax_data': 0, 'flows_without_tax_data': len(flows), 'coverage_pct': 0},
        'warnings': ['Sem matriz tributária específica da Empresa 1 no pacote da Fase 2.'],
        'errors': [],
    }
    bf = fit('empresa1', 'baseline_empresa1', costs, None, None)
    reconciliation = build_bundle_reconciliation(model, cost_block, tax, bf)
    bundle = {
        'model': model,
        'flows': flows,
        'flow_summary': flow_summary,
        'costs': cost_block,
        'tax_results': tax,
        'base_fit': bf,
        'reconciliation': reconciliation,
    }
    for name, obj in [
        ('baseline_model', model),
        ('baseline_flows', {'flows': flows, 'flow_summary': flow_summary}),
        ('baseline_costs', cost_block),
        ('tax_results', tax),
        ('base_fit', bf),
        ('phase2_bundle', bundle),
    ]:
        jsave(f'data/empresa1/phase2/{name}.json', obj)
    return bundle


def filial_label(code):
    try:
        c = int(code)
    except Exception:
        return str(code)
    return {
        2001: 'Red-RJ',
        2002: 'Red-ES/Regional',
        2003: 'Red-SP',
        2004: 'Red-MG',
        1001: 'Indústria/1001',
        3001: 'Filial/3001',
    }.get(c, str(code))


def select_scenario(rows, scenario_name, source_name):
    if not isinstance(rows, list) or not rows:
        raise DataContractError(f'{source_name} não contém linhas.')
    matches = [row for row in rows if row.get('scenario_name') == scenario_name]
    if len(matches) != 1:
        raise DataContractError(
            f'{source_name} deve conter exatamente um {scenario_name!r}; encontrados {len(matches)}.'
        )
    return matches[0]


def build_empresa2():
    core = {
        k: jload(f'data/empresa2/core/{k}.json')
        for k in [
            'faturamento_uf',
            'distribuicao_fabrica_cd',
            'faturamento_filial_uf',
            'scenario_totals',
            'scenario_blocks',
            'aux_custo_transferencia',
            'aux_custo_distribuicao',
            'aux_custo_armazenagem',
            'estoque',
            'dados_tributario',
            'parametros',
        ]
    }
    base = select_scenario(core['scenario_totals'], 'Cenário 1', 'scenario_totals')
    block = select_scenario(core['scenario_blocks'], 'Cenário 1', 'scenario_blocks')
    numeric_issues = []
    params = {
        txt(r.get('Parâmetro')): num(
            r.get('Valor'), issues=numeric_issues, field='parametros.Valor', row=r.get('__excel_row')
        )
        for r in core['parametros']
    }
    delta_fat = num(params.get('Δ Faturamento'), issues=numeric_issues, field='parametros.Δ Faturamento')
    active = [
        txt(r.get('Filial')) for r in block.get('rows', []) if txt(r.get('Filial')) and txt(r.get('Filial')) != 'Total'
    ]
    flows = []
    idx = 1
    for r in core['distribuicao_fabrica_cd']:
        if not txt(r.get('Origem')) or not txt(r.get('Destino')):
            continue
        flows.append(
            {
                'flow_id': f'empresa2_factory_cd_{idx:03d}',
                'company_id': 'empresa2',
                'flow_type': 'factory_to_cd',
                'origin': txt(r.get('Origem')),
                'origin_uf': txt(r.get('Origem UF')),
                'cd': txt(r.get('Destino')),
                'cd_uf': txt(r.get('Destino UF')),
                'destination': txt(r.get('Destino')),
                'destination_uf': txt(r.get('Destino UF')),
                'volume': num(
                    r.get('Quantidade'),
                    issues=numeric_issues,
                    field='distribuicao_fabrica_cd.Quantidade',
                    row=r.get('__excel_row'),
                ),
                'batch': num(
                    r.get('Batelada'),
                    issues=numeric_issues,
                    field='distribuicao_fabrica_cd.Batelada',
                    row=r.get('__excel_row'),
                ),
                'revenue': num(
                    r.get('$'), issues=numeric_issues, field='distribuicao_fabrica_cd.$', row=r.get('__excel_row')
                ),
                'source': 'distribuicao_fabrica_cd',
            }
        )
        idx += 1
    for r in core['faturamento_filial_uf']:
        rev = num(
            r.get('Faturamento 2025'),
            issues=numeric_issues,
            field='faturamento_filial_uf.Faturamento 2025',
            row=r.get('__excel_row'),
        )
        if rev <= 0:
            continue
        code = r.get('Filial Origem')
        lab = filial_label(code)
        flows.append(
            {
                'flow_id': f'empresa2_cd_uf_{idx:03d}',
                'company_id': 'empresa2',
                'flow_type': 'cd_to_destination',
                'origin': lab,
                'origin_code': code,
                'cd': lab,
                'destination': txt(r.get('UF Destino')),
                'destination_uf': txt(r.get('UF Destino')),
                'revenue': rev,
                'share': num(
                    r.get('%'), issues=numeric_issues, field='faturamento_filial_uf.%', row=r.get('__excel_row')
                ),
                'source': 'faturamento_filial_uf',
            }
        )
        idx += 1
    costs = {
        'transfer_cost': num(
            base.get('Custo Transferência'),
            issues=numeric_issues,
            field='scenario_totals.Custo Transferência',
            row=base.get('__excel_row'),
        ),
        'distribution_cost': num(
            base.get('Custo Distribuição'),
            issues=numeric_issues,
            field='scenario_totals.Custo Distribuição',
            row=base.get('__excel_row'),
        ),
        'storage_cost': num(
            base.get('Custo Armazenagem'),
            issues=numeric_issues,
            field='scenario_totals.Custo Armazenagem',
            row=base.get('__excel_row'),
        ),
        'inventory_cost': num(
            base.get('Custo de Estoque'),
            issues=numeric_issues,
            field='scenario_totals.Custo de Estoque',
            row=base.get('__excel_row'),
        ),
        'tax_impact': num(
            base.get('Efeitos Tributários'),
            issues=numeric_issues,
            field='scenario_totals.Efeitos Tributários',
            row=base.get('__excel_row'),
        ),
        'freight_cost': num(
            base.get('Custo Frete'),
            issues=numeric_issues,
            field='scenario_totals.Custo Frete',
            row=base.get('__excel_row'),
        ),
    }
    costs['total_logistics_cost'] = (
        costs['transfer_cost'] + costs['distribution_cost'] + costs['storage_cost'] + costs['inventory_cost']
    )
    costs['total_with_tax'] = num(
        base.get('Custo Total'), issues=numeric_issues, field='scenario_totals.Custo Total', row=base.get('__excel_row')
    )
    invval = sum(
        num(r.get('col_J'), issues=numeric_issues, field='estoque.col_J', row=r.get('__excel_row'))
        for r in core['estoque']
    )
    inferred = costs['inventory_cost'] / invval if invval else None
    taxrows = [r for r in core['dados_tributario'] if r.get('# Cenário') == 'Cenário 1']
    taxmatrix_raw = sum(
        num(
            r.get('Efeitos Débitos'),
            issues=numeric_issues,
            field='dados_tributario.Efeitos Débitos',
            row=r.get('__excel_row'),
        )
        - num(
            r.get('Efeitos Créditos'),
            issues=numeric_issues,
            field='dados_tributario.Efeitos Créditos',
            row=r.get('__excel_row'),
        )
        for r in taxrows
    )
    tax_reconciliation = reconcile_tax(costs['tax_impact'], taxmatrix_raw, adjustment_factor=delta_fat)
    model = {
        'scenario_id': 'baseline_empresa2',
        'scenario_type': 'baseline',
        'company_id': 'empresa2',
        'baseline_ready': True,
        'baseline_status': 'workbook_baseline_reconstructed',
        'calculation_mode': 'scenario_totals_reconstruction_with_raw_evidence',
        'active_cds': active,
        'origins': sorted(
            {
                txt(r.get('Origem UF')) + ' / ' + txt(r.get('Origem'))
                for r in core['distribuicao_fabrica_cd']
                if txt(r.get('Origem'))
            }
        ),
        'destinations': sorted(
            {txt(r.get('UF')) for r in core['faturamento_uf'] if txt(r.get('UF')) and txt(r.get('UF')) != 'Total'}
        ),
        'metadata': {
            'created_by': 'build_phase2_baseline.py',
            'phase': 2,
            'generated_at_utc': datetime.now(timezone.utc).isoformat(),
            'methodology': 'Cenário 1 da aba Cenários/scenario_totals é o baseline canônico. Abas auxiliares são usadas como evidência operacional, não como solver independente nesta fase.',
        },
        'warnings': [
            'Cenário 1 do workbook é a referência canônica para reconstrução nesta fase.',
            'Sem benchmark independente consolidado no pacote; Base Fit Score fica pendente.',
            'A aba Cenários é em blocos; usar scenario_blocks/scenario_totals.',
        ],
        'errors': [],
    }
    summary = {
        'total_flows': len(flows),
        'factory_to_cd_flows': sum(f['flow_type'] == 'factory_to_cd' for f in flows),
        'cd_to_destination_flows': sum(f['flow_type'] == 'cd_to_destination' for f in flows),
        'total_revenue_cd_to_destination': sum(
            num(f.get('revenue')) for f in flows if f['flow_type'] == 'cd_to_destination'
        ),
        'total_factory_to_cd_volume': sum(num(f.get('volume')) for f in flows if f['flow_type'] == 'factory_to_cd'),
        'destinations_covered': len({f.get('destination_uf') for f in flows if f.get('destination_uf')}),
    }
    cost_block = {
        'scenario_id': 'baseline_empresa2',
        'company_id': 'empresa2',
        'cost_basis': 'workbook_scenario_totals_cenario_1',
        'costs': costs,
        'reference_results': dict(costs),
        'raw_operational_evidence': {
            'transfer_freight_sum_aux_table': sum(num(r.get('FRETE VALOR')) for r in core['aux_custo_transferencia']),
            'distribution_freight_sum_aux_table': sum(
                num(r.get('FRETE VALOR')) for r in core['aux_custo_distribuicao']
            ),
            'storage_monthly_sum_aux_table': sum(num(r.get('Custo')) for r in core['aux_custo_armazenagem']),
            'storage_annualized_sum_aux_table': sum(num(r.get('Custo')) for r in core['aux_custo_armazenagem']) * 12,
            'inventory_value_sum_estoque': invval,
            'inventory_cost_using_inferred_wacc': invval * inferred if inferred else 0,
            'inferred_wacc_from_workbook_inventory_cost': inferred,
            'tax_effect_from_tax_matrix_raw': taxmatrix_raw,
            'tax_effect_from_tax_matrix_reconciled': tax_reconciliation['adjusted_matrix_total'],
            'workbook_adjustment_factor': delta_fat,
        },
        'cost_breakdown': [
            {'metric': 'storage_cost', 'value': costs['storage_cost'], 'source': 'scenario_totals:Cenário 1'},
            {'metric': 'transfer_cost', 'value': costs['transfer_cost'], 'source': 'scenario_totals:Cenário 1'},
            {'metric': 'distribution_cost', 'value': costs['distribution_cost'], 'source': 'scenario_totals:Cenário 1'},
            {'metric': 'inventory_cost', 'value': costs['inventory_cost'], 'source': 'scenario_totals:Cenário 1'},
            {'metric': 'tax_impact', 'value': costs['tax_impact'], 'source': 'scenario_totals:Cenário 1'},
        ],
        'warnings': model['warnings'],
        'errors': [],
    }
    tax_warnings = [
        'TaxEngineBasic usa Efeitos Tributários do Cenário 1 como valor canônico; a matriz tributária é registrada como evidência bruta e o ajuste da aba Cenários fica separado como sensibilidade.'
    ]
    tax_warnings.extend(tax_reconciliation.get('notes') or [])
    if tax_reconciliation['warning']:
        tax_warnings.append(tax_reconciliation['warning'])
    tax = {
        'scenario_id': 'baseline_empresa2',
        'company_id': 'empresa2',
        'tax_results': {
            'icms_estimated': None,
            'difal_estimated': None,
            'total_tax_impact': costs['tax_impact'],
            'tax_effect_from_matrix_raw': taxmatrix_raw,
            'tax_effect_from_matrix': tax_reconciliation['matrix_total'],
            'difference_matrix_vs_scenario_total': tax_reconciliation['difference'],
            'difference_raw_matrix_vs_scenario_total': taxmatrix_raw - costs['tax_impact'],
            'workbook_adjustment_factor': delta_fat,
            'tax_reconciliation': tax_reconciliation,
        },
        'tax_reconciliation': tax_reconciliation,
        'tax_coverage': {
            'flows_with_tax_data': len(taxrows),
            'flows_without_tax_data': 0,
            'coverage_pct': 100 if taxrows else 0,
        },
        'warnings': tax_warnings,
        'errors': [],
    }
    bf = fit('empresa2', 'baseline_empresa2', costs, None, None)
    reconciliation = build_bundle_reconciliation(model, cost_block, tax, bf)
    bundle = {
        'model': model,
        'flows': flows,
        'flow_summary': summary,
        'costs': cost_block,
        'tax_results': tax,
        'base_fit': bf,
        'reconciliation': reconciliation,
    }
    for name, obj in [
        ('baseline_model', model),
        ('baseline_flows', {'flows': flows, 'flow_summary': summary}),
        ('baseline_costs', cost_block),
        ('tax_results', tax),
        ('base_fit', bf),
        ('phase2_bundle', bundle),
    ]:
        jsave(f'data/empresa2/phase2/{name}.json', obj)
    return bundle


def main():
    e1 = build_empresa1()
    e2 = build_empresa2()
    cat = jload('data/catalog.json')
    cat['version'] = '8.0-phase2-baseline-implemented'
    cat['phase2'] = {
        'status': 'implemented',
        'page': 'fase-2-baseline/index.html',
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'companies': {
            'empresa1': {
                'phase2_bundle': 'data/empresa1/phase2/phase2_bundle.json',
                'baseline_model': 'data/empresa1/phase2/baseline_model.json',
                'baseline_flows': 'data/empresa1/phase2/baseline_flows.json',
                'baseline_costs': 'data/empresa1/phase2/baseline_costs.json',
                'tax_results': 'data/empresa1/phase2/tax_results.json',
                'base_fit': 'data/empresa1/phase2/base_fit.json',
                'baseline_status': e1['model']['baseline_status'],
                'flow_count': e1['flow_summary']['total_flows'],
                'base_fit_status': e1['base_fit']['status'],
            },
            'empresa2': {
                'phase2_bundle': 'data/empresa2/phase2/phase2_bundle.json',
                'baseline_model': 'data/empresa2/phase2/baseline_model.json',
                'baseline_flows': 'data/empresa2/phase2/baseline_flows.json',
                'baseline_costs': 'data/empresa2/phase2/baseline_costs.json',
                'tax_results': 'data/empresa2/phase2/tax_results.json',
                'base_fit': 'data/empresa2/phase2/base_fit.json',
                'baseline_status': e2['model']['baseline_status'],
                'flow_count': e2['flow_summary']['total_flows'],
                'base_fit_status': e2['base_fit']['status'],
                'base_fit_score': e2['base_fit']['base_fit_score'],
            },
        },
    }
    jsave('data/catalog.json', cat)
    report = {
        'result': 'OK',
        'phase': 2,
        'implemented_at_utc': datetime.now(timezone.utc).isoformat(),
        'companies': {
            'empresa1': {
                'baseline_ready': e1['model']['baseline_ready'],
                'flow_count': e1['flow_summary']['total_flows'],
                'total_with_tax': e1['costs']['costs']['total_with_tax'],
                'base_fit_status': e1['base_fit']['status'],
            },
            'empresa2': {
                'baseline_ready': e2['model']['baseline_ready'],
                'flow_count': e2['flow_summary']['total_flows'],
                'total_with_tax': e2['costs']['costs']['total_with_tax'],
                'base_fit_status': e2['base_fit']['status'],
                'base_fit_score': e2['base_fit']['base_fit_score'],
            },
        },
        'generated_files': [
            f'data/{c}/phase2/{n}.json'
            for c in ['empresa1', 'empresa2']
            for n in ['baseline_model', 'baseline_flows', 'baseline_costs', 'tax_results', 'base_fit', 'phase2_bundle']
        ],
    }
    jsave('data/validation/phase2_implementation_report.json', report)
    print('PHASE2_BASELINE_ARTIFACTS_BUILT')


if __name__ == '__main__':
    main()
