# BaselineDataAdapter

## Fase
Fase 2 — `phase-02-baseline-parity`

## O que faz
Normaliza o bundle da Fase 2 para um contrato comum entre Empresa 1 e Empresa 2.

## Implementação real
`assets/js/phase2/baseline-data-adapter.js`

## Input JSON
```json
{
  "company_id": "empresa1|empresa2",
  "phase2_bundle": "data/{company}/phase2/phase2_bundle.json"
}
```

## Output JSON
```json
{
  "result": "objeto/tabela/renderização específica do módulo",
  "warnings": "[]",
  "errors": "[]"
}
```

## Funções internas
- `normalizePhase2Bundle`
- `validateNormalizedInput`

## Módulos chamados
- `DataLoader`
- `DataQualityPanel`

## Testes
```json
{
  "unit": [
    "tests/05_fase2_baseline/test_phase2_static_site.py",
    "tests/05_fase2_baseline/test_phase2_data_contracts.py"
  ],
  "integration": [
    "tests/05_fase2_baseline/test_phase2_http_server.py"
  ],
  "manual": [
    "checklist na página /fase-2-baseline/"
  ],
  "acceptance": [
    "python tests/run_all_tests.py"
  ]
}
```

## Debug
Abra `/debug/`, procure `BaselineDataAdapter` e rode os testes listados.
