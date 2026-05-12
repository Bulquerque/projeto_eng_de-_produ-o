# TaxEngineBasic

## Fase
Fase 2 — `phase-02-baseline-parity`

## O que faz
Resume e valida a camada tributária básica da Fase 2.

## Implementação real
`assets/js/phase2/tax-engine-basic.js`

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
- `summarizeTaxResults`
- `validateTaxResults`

## Módulos chamados
- `FlowBuilder`
- `CostEngine`

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
Abra `/debug/`, procure `TaxEngineBasic` e rode os testes listados.
