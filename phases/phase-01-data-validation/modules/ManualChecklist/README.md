# ManualChecklist

## Fase
Fase 1 — `phase-01-data-validation`

## O que faz
Permite ao usuário marcar manualmente validações da Fase 1 e salvar o progresso no navegador.

## Implementação real
`/ e /fase-1-validacao/`

## Input JSON
```json
{
  "phase": 1,
  "checks": [
    {
      "id": "empresa1_datasets",
      "label": "Empresa 1 mostra demanda, distância e premissas"
    }
  ]
}
```

## Output JSON
```json
{
  "completed": 1,
  "total": 7,
  "storageKey": "phase1ManualChecklist"
}
```

## Funções internas
- `['loadChecklistState(key)', 'Lê checks salvos no localStorage.']`
- `['toggleCheck(checkId)', 'Marca/desmarca uma validação.']`
- `['saveChecklistState(key, state)', 'Persiste o progresso localmente.']`
- `['resetChecklist()', 'Limpa o checklist manual.']`

## Módulos chamados
- nenhum declarado

## Testes
```json
{
  "unit": [
    "toggleCheck alterna boolean",
    "reset limpa todos"
  ],
  "integration": [
    "estado persiste após reload"
  ],
  "manual": [
    "marcar checklist, recarregar página, conferir permanência"
  ],
  "acceptance": [
    "usuário consegue auditar manualmente a Fase 1 sem abrir código"
  ]
}
```

## Debug
Abra `/debug/`, procure `ManualChecklist` e rode os testes listados.
