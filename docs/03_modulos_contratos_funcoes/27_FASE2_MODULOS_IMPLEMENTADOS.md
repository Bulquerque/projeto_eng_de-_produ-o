# Fase 2 — Módulos Implementados

## BaselineDataAdapter

**Fase:** 2

**O que faz:** normaliza as estruturas diferentes da Empresa 1 e da Empresa 2 para o baseline.

**Input:**

```json
{
  "company_id": "empresa1",
  "core_data": {
    "demand_records": [],
    "distance_matrix": [],
    "premissas": []
  }
}
```

**Output:**

```json
{
  "company_id": "empresa1",
  "demand": [],
  "distances": [],
  "assumptions": {},
  "reference_results": null,
  "warnings": [],
  "errors": []
}
```

**Funções internas:** `normalizeCompany1Data`, `normalizeCompany2Data`, `filialCodeLabel`.

**Módulos chamados:** `DataLoader`, `CostEngine`, `FlowBuilder`.

**Testes:** valida separação de empresas, existência de dados mínimos e referência pendente quando aplicável.

## FlowBuilder

**Fase:** 2

**O que faz:** monta os fluxos físicos do baseline.

**Input:**

```json
{
  "company_id": "empresa2",
  "normalized_input": {
    "active_cds": ["Red-RJ", "Red-SP", "Red-ES", "Red-MG"],
    "source_tables": {}
  }
}
```

**Output:**

```json
{
  "flows": [],
  "flow_summary": {
    "total_flows": 76,
    "destinations_covered": 28
  },
  "warnings": [],
  "errors": []
}
```

**Funções internas:** `buildEmpresa1Flows`, `buildEmpresa2Flows`.

**Módulos chamados:** `DistanceResolver`, `BaselineDataAdapter`.

**Testes:** verifica se há fluxos, se empresa é preservada e se destinos são cobertos.

## CostEngine

**Fase:** 2

**O que faz:** calcula ou reconstrói custos do baseline.

**Input:**

```json
{
  "scenario_id": "baseline_empresa2",
  "flows": [],
  "assumptions": {},
  "reference_results": {}
}
```

**Output:**

```json
{
  "costs": {
    "transfer_cost": 3148100.51,
    "distribution_cost": 7637802.74,
    "storage_cost": 8647999.46,
    "inventory_cost": 4140531.30,
    "tax_impact": 26081451.58,
    "total_logistics_cost": 23574434.01,
    "total_with_tax": 49655885.59
  }
}
```

**Funções internas:** `calculateEmpresa1Costs`, `calculateEmpresa2Costs`, `validateCostClosure`.

**Módulos chamados:** `FlowBuilder`, `BaseFitScore`.

**Testes:** custo total precisa fechar com as parcelas, custo não pode ser negativo e Empresa 2 precisa reproduzir o Cenário 1.

## TaxEngineBasic

**Fase:** 2

**O que faz:** adiciona uma camada tributária básica.

**Input:**

```json
{
  "company_id": "empresa2",
  "tax_data": [],
  "costs": {}
}
```

**Output:**

```json
{
  "tax_results": {
    "total_tax_impact": 26081451.58,
    "tax_effect_from_matrix": 25567543.94
  },
  "tax_coverage": {
    "coverage_pct": 100
  }
}
```

**Funções internas:** cálculo do efeito tributário por matriz e comparação contra total canônico.

**Módulos chamados:** `CostEngine`.

**Testes:** cobertura entre 0 e 100, tributo não negativo e warning quando não há matriz.

## BaseFitScore

**Fase:** 2

**O que faz:** compara simulado vs referência.

**Input:**

```json
{
  "simulated_results": {},
  "reference_results": {}
}
```

**Output:**

```json
{
  "base_fit_score": 100,
  "status": "OK",
  "errors_by_metric": []
}
```

**Funções internas:** cálculo de erro absoluto, erro percentual, classificação e score agregado.

**Módulos chamados:** `CostEngine`, `ReferenceResultExtractor`.

**Testes:** Empresa 1 deve retornar benchmark pendente; Empresa 2 deve retornar benchmark pendente também, com a reconciliação tributária explícita entre `scenario_totals` e `dados_tributario`.
