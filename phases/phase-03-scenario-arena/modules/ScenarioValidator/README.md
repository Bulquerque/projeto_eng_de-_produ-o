# ScenarioValidator

## Fase
Fase 3 — `phase-03-scenario-arena`

## O que faz
Bloqueia ou alerta cenários impossíveis: sem CD ativo, demanda sem atendimento, capacidade estourada, distância ausente ou empresa misturada.

## Implementação real
`assets/js/phase3/scenario-validator.js`

## Input JSON
```json
{
  "scenario": {},
  "constraints": {
    "minCds": 1,
    "maxCdUtilization": 0.9,
    "allowCrossCompanyComparison": false
  }
}
```

## Output JSON
```json
{
  "valid": true,
  "errors": [],
  "warnings": [],
  "blockingReasons": []
}
```

## Funções internas
- `['validateCompanyIsolation(scenario)', 'Garante que a empresa é única.']`
- `['validateActiveCds(scenario)', 'Confere CDs ativos.']`
- `['validateDemandCoverage(scenario)', 'Confere atendimento da demanda.']`
- `['validateCapacity(scenario, constraints)', 'Confere capacidade.']`
- `['validateDistances(scenario)', 'Confere rotas com distância.']`

## Módulos chamados
- `['DataQualityPanel', 'Usa diagnóstico de dados.']`
- `['ScenarioQualityCheck', 'Envia warnings não bloqueantes.']`

## Testes
```json
{
  "unit": [
    "sem CD ativo é inválido",
    "empresa misturada é inválida"
  ],
  "integration": [
    "ScenarioBuilder chama validator antes de salvar"
  ],
  "manual": [
    "tentar cenário absurdo e ver bloqueio"
  ],
  "acceptance": [
    "nenhum cenário inválido entra no ranking"
  ]
}
```

## Debug
Abra `/debug/`, procure `ScenarioValidator` e rode os testes listados.
