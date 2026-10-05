# Funções internas

- `['createScenarioFromBaseline(baseline)', 'Clona baseline com versionamento.']`
- `['applyScenarioChanges(scenario, changes)', 'Aplica alterações do usuário.']`
- `['rebuildScenarioFlows(scenario)', 'Recalcula fluxos quando CD/alocação muda.']`
- `['nameScenario(scenario, name)', 'Define nome legível e ID.']`

# Dependências externas

A validação do cenário é orquestrada pelo dashboard e também aplicada pelo simulador; o ScenarioBuilder apenas constrói o objeto de cenário.

- `['FlowBuilder', 'Recria fluxos.']`
- `['CostEngine', 'Calcula custos do cenário.']`
- `['TaxEngine', 'Calcula tributos se ligado.']`
