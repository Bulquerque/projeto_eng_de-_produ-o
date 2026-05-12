# Arquitetura do site estático

Fluxo proposto:

```text
Excel/CSV brutos -> ETL Python -> JSON/CSV limpos -> site estático -> simulação no navegador
```

O site não precisa de backend. Ele lê `data/catalog.json`, carrega os arquivos da empresa escolhida e executa os módulos de validação, cenário, custo, score e comparação em JavaScript.

Componentes principais:

- `CompanySelector`
- `DataCatalog`
- `DataQualityPanel`
- `BaselineBuilder`
- `CostEngine`
- `BaseFitScore`
- `ScenarioBuilder`
- `ScenarioComparator`
- `ObjectiveBuilder`
- `ScenarioOptimizer`
- `StressTestEngine`
- `AuditTrail`
