# Phase2TestPanel

## Fase
Fase 2 — `phase-02-baseline-parity`

## O que faz
Executa e renderiza testes automáticos da Fase 2 no navegador.

## Implementação real
`assets/js/phase2/phase2-tests.js`

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
- `runPhase2Checks`
- `renderChecks`

## Módulos chamados
- `CostEngine`
- `BaseFitScore`
- `BaselineBuilder`

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
Abra `/debug/`, procure `Phase2TestPanel` e rode os testes listados.
