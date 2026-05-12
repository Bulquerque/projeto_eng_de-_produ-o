# Phase1TestPanel

## Fase
Fase 1 — `phase-01-data-validation`

## O que faz
Mostra no navegador os testes automáticos básicos da Fase 1, permitindo checagem rápida sem terminal.

## Implementação real
`/ e /fase-1-validacao/`

## Input JSON
```json
{
  "appState": {},
  "loadedArtifacts": {},
  "selectedCompany": "empresa1"
}
```

## Output JSON
```json
{
  "browserTests": [
    {
      "name": "catalog_loaded",
      "status": "pass"
    }
  ],
  "summary": {
    "passed": 8,
    "failed": 0
  }
}
```

## Funções internas
- `['runBrowserChecks(state)', 'Executa testes simples no estado carregado.']`
- `['assertCondition(name, condition)', 'Converte condição em resultado pass/fail.']`
- `['renderTestResults(results)', 'Mostra os testes em cards/tabela.']`
- `['computeTestSummary(results)', 'Conta passes/fails.']`

## Módulos chamados
- `['DataLoader', 'Usa estado carregado pelo DataLoader.']`
- `['CompanySelector', 'Confirma empresa selecionada.']`

## Testes
```json
{
  "unit": [
    "assertCondition false gera fail",
    "summary conta resultados"
  ],
  "integration": [
    "painel aparece depois do carregamento"
  ],
  "manual": [
    "confirmar que todos os testes do navegador passam"
  ],
  "acceptance": [
    "falha precisa aparecer visualmente"
  ]
}
```

## Debug
Abra `/debug/`, procure `Phase1TestPanel` e rode os testes listados.
