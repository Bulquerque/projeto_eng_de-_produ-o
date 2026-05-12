# Contratos dos módulos — todas as fases

Este documento é a especificação principal dos módulos do simulador estático. Ele foi reorganizado para servir como base de reconstrução do projeto, não só como texto explicativo.

Cada módulo tem: fase, status, página prevista, descrição, input JSON, output JSON, funções internas, chamadas para outros módulos e testes. A versão estruturada em JSON fica em `data/contracts/module_contracts_all_phases.json`.

Regra central: Empresa 1 e Empresa 2 são empresas diferentes. Nenhum módulo pode misturar dados, cenários, baseline, score ou relatório entre elas.

## Sumário dos módulos


| Fase | Módulo | Status | Descrição curta |
|---|---|---|---|
| 1 | AppBootstrap | implemented_phase_1 | Inicializa o site estático, carrega os artefatos mínimos da Fase 1 e dispara a primeira renderização segura da inte... |
| 1 | DataLoader | implemented_phase_1 | Centraliza a leitura dos arquivos estáticos JSON/CSV usados pela interface. É o módulo que garante que os dados vêm... |
| 1 | CompanySelector | implemented_phase_1 | Permite alternar entre Empresa 1 e Empresa 2 mantendo isolamento total de datasets, indicadores e mensagens. |
| 1 | DatasetPanel | implemented_phase_1 | Mostra os datasets core e arquivos brutos vinculados à empresa selecionada, com caminhos relativos visíveis para au... |
| 1 | DataQualityPanel | implemented_phase_1 | Exibe score de qualidade, contagens, warnings e erros já apurados na preparação dos dados. |
| 1 | PathAuditPanel | implemented_phase_1 | Mostra a auditoria dos caminhos do pacote: quantidade checada, faltantes, abas auditadas e arquivos core obrigatóri... |
| 1 | WorkbookInventoryPanel | implemented_phase_1 | Mostra o inventário de abas dos workbooks, especialmente para provar que as abas da Empresa 2 foram exportadas e ma... |
| 1 | ManualChecklist | implemented_phase_1 | Permite ao usuário marcar manualmente validações da Fase 1 e salvar o progresso no navegador. |
| 1 | Phase1TestPanel | implemented_phase_1 | Mostra no navegador os testes automáticos básicos da Fase 1, permitindo checagem rápida sem terminal. |
| 2 | BaselineBuilder | planned_phase_2 | Reconstrói o cenário atual de cada empresa a partir dos dados core, gerando a estrutura AS-IS que será usada como c... |
| 2 | FlowBuilder | planned_phase_2 | Normaliza os fluxos logísticos usados por custo, serviço, cenário e comparação. |
| 2 | CostEngine | planned_phase_2 | Calcula as parcelas de custo logístico: transferência, distribuição, armazenagem, estoque e total. |
| 2 | TaxEngine | planned_phase_2 | Calcula camada tributária parametrizada, sem assumir regra fiscal hardcoded não validada. Deve suportar regime atua... |
| 2 | BaseFitScore | planned_phase_2 | Mede a paridade entre resultado simulado e cenário real/base. Essa é a prova de que o simulador replica a realidade... |
| 2 | CalibrationPanel | planned_phase_2 | Mostra visualmente paridade, erros por componente e pontos que precisam de calibração. |
| 3 | ScenarioBuilder | planned_phase_3 | Permite criar cenários manuais a partir do baseline, mudando CDs ativos, alocação, frete, estoque, demanda, modo tr... |
| 3 | ScenarioValidator | planned_phase_3 | Bloqueia ou alerta cenários impossíveis: sem CD ativo, demanda sem atendimento, capacidade estourada, distância aus... |
| 3 | ScenarioComparator | planned_phase_3 | Compara múltiplos cenários da mesma empresa contra o baseline correto, mostrando custo, saving, serviço, risco e tr... |
| 3 | ScenarioQualityCheck | planned_phase_3 | Avalia plausibilidade operacional do cenário, separando cenário barato de cenário realmente executável. |
| 3 | ScenarioPersistence | planned_phase_3 | Salva cenários criados pelo usuário no navegador e permite exportar/importar JSON de cenário. |
| 4 | ObjectiveBuilder | planned_phase_4 | Permite ao usuário criar sua própria função objetivo com pesos de custo, serviço, risco, tributo e estoque. |
| 4 | ScenarioScoring | planned_phase_4 | Normaliza métricas heterogêneas e calcula o score final de cada cenário conforme função objetivo escolhida. |
| 4 | ConstraintEngine | planned_phase_4 | Define e valida restrições usadas pelo otimizador: mínimo/máximo de CDs, capacidade, concentração, cobertura e lead... |
| 4 | ScenarioOptimizer | planned_phase_4 | Enumera o espaço discreto modelado, aplica restrições, calcula score e retorna o melhor cenário viável com desempate determinístico. |
| 4 | SearchLogPanel | planned_phase_4 | Mostra rastreabilidade da busca: método, seed, candidatos testados, rejeições e top cenários. |
| 5 | StressTestEngine | planned_phase_5 | Aplica choques de frete, demanda, WACC, armazenagem, capacidade e tributo para testar robustez do cenário. |
| 5 | ExplainabilityEngine | planned_phase_5 | Gera explicações textuais simples e auditáveis sobre por que um cenário ganhou, perdeu ou ficou arriscado. |
| 5 | AuditTrail | planned_phase_5 | Registra dados, premissas, versão do modelo, cenário, objetivo e resultados para cada simulação exportável. |
| 5 | ExecutiveReport | planned_phase_5 | Monta relatório executivo do cenário: resumo, comparação, saving, riscos, stress, premissas e recomendação defendív... |
| 5 | ExportEngine | planned_phase_5 | Exporta resultados, cenários, auditoria e relatórios em formatos simples para entrega ou reuso. |
| 5 | RecommendationPanel | planned_phase_5 | Apresenta recomendação final com ressalvas: melhor cenário por objetivo, robustez, riscos e próximos passos. |


# Fase 1


## AppBootstrap

**Status:** `implemented_phase_1`  
**Página/tela:** `/ e /fase-1-validacao/`


**O que faz:** Inicializa o site estático, carrega os artefatos mínimos da Fase 1 e dispara a primeira renderização segura da interface.


### Input JSON

```json
{
  "rootElementId": "app",
  "paths": {
    "catalog": "data/catalog.json",
    "qualitySummary": "data/data_quality_summary.json",
    "pathReport": "data/validation/path_resolution_report.json",
    "auditSummary": "data/validation/final_v6_audit_summary.json",
    "workbookInventory": "data/validation/workbook_sheet_inventory.csv"
  },
  "defaultCompany": "empresa1"
}
```

### Output JSON

```json
{
  "appState": {
    "selectedCompany": "empresa1",
    "loaded": true,
    "loadErrors": []
  },
  "renderedSections": [
    "company-selector",
    "dataset-panel",
    "quality-panel",
    "audit-panel",
    "manual-checklist"
  ]
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| initApp() | Cria o estado inicial e coordena a sequência de carregamento. |
| loadPhase1Artifacts(paths) | Busca catálogo, qualidade, auditoria e inventário. |
| renderApp(state) | Renderiza a interface conforme a empresa selecionada. |
| showFatalError(error) | Mostra erro visível quando a inicialização falha. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| DataLoader.fetchJson | Carregar JSONs declarados em paths. |
| CompanySelector.render | Renderizar seleção Empresa 1 / Empresa 2. |
| DatasetPanel.render | Mostrar datasets da empresa selecionada. |
| PathAuditPanel.render | Mostrar status dos caminhos auditados. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | initApp cria estado inicial com empresa1 |
| unit | showFatalError não deixa a página em branco |
| integration | site abre via http.server |
| integration | todos os artefatos da Fase 1 são carregados |
| manual | abrir / e confirmar que os painéis aparecem |
| manual | abrir /fase-1-validacao/ e confirmar que redireciona/mostra o mesmo app |
| acceptance | não usa path absoluto |
| acceptance | não quebra se um painel tiver warning |


## DataLoader

**Status:** `implemented_phase_1`  
**Página/tela:** `global`


**O que faz:** Centraliza a leitura dos arquivos estáticos JSON/CSV usados pela interface. É o módulo que garante que os dados vêm dos caminhos relativos corretos.


### Input JSON

```json
{
  "requests": [
    {
      "key": "catalog",
      "path": "data/catalog.json",
      "type": "json"
    },
    {
      "key": "inventory",
      "path": "data/validation/workbook_sheet_inventory.csv",
      "type": "csv"
    }
  ]
}
```

### Output JSON

```json
{
  "loaded": {
    "catalog": {},
    "inventory": []
  },
  "errors": [],
  "missing": []
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| fetchJson(path) | Carrega JSON e retorna objeto parseado com erro amigável. |
| fetchText(path) | Carrega CSV/texto sem tentar converter automaticamente. |
| parseCsv(text) | Converte CSV simples para array de objetos quando necessário. |
| loadAll(requests) | Executa as leituras essenciais e acumula erros. |


### Funções/módulos chamados de fora


Este módulo não depende diretamente de outro módulo de domínio.


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | fetchJson rejeita JSON inválido com mensagem clara |
| unit | parseCsv preserva cabeçalhos |
| integration | catalog.json carrega |
| integration | workbook_sheet_inventory.csv carrega |
| manual | abrir DevTools e confirmar ausência de 404 nos arquivos principais |
| acceptance | falha de um arquivo aparece na tela e não some silenciosamente |


## CompanySelector

**Status:** `implemented_phase_1`  
**Página/tela:** `/ e /fase-1-validacao/`


**O que faz:** Permite alternar entre Empresa 1 e Empresa 2 mantendo isolamento total de datasets, indicadores e mensagens.


### Input JSON

```json
{
  "companies": [
    {
      "id": "empresa1",
      "name": "Empresa 1",
      "description": "Demanda + Distância + Premissas"
    },
    {
      "id": "empresa2",
      "name": "Empresa 2",
      "description": "Workbook de malha logística"
    }
  ],
  "selectedCompany": "empresa1"
}
```

### Output JSON

```json
{
  "selectedCompany": "empresa2",
  "selectionChanged": true
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| renderCompanyCards(companies) | Monta os cards/botões das empresas. |
| selectCompany(companyId) | Atualiza estado global e solicita rerender. |
| getSelectedCompany(state) | Retorna a empresa ativa de forma segura. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| DatasetPanel.render | Re-renderizar datasets da empresa. |
| DataQualityPanel.render | Re-renderizar qualidade da empresa. |
| ManualChecklist.render | Atualizar checklist sem perder estado. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | empresa1 é padrão |
| unit | selectCompany troca para empresa2 |
| integration | trocar empresa muda cards de datasets |
| integration | trocar empresa não mistura paths |
| manual | clicar Empresa 1 e depois Empresa 2 |
| manual | confirmar que os títulos/datasets mudam |
| acceptance | nenhum dataset da Empresa 2 aparece quando Empresa 1 está selecionada |


## DatasetPanel

**Status:** `implemented_phase_1`  
**Página/tela:** `/ e /fase-1-validacao/`


**O que faz:** Mostra os datasets core e arquivos brutos vinculados à empresa selecionada, com caminhos relativos visíveis para auditoria manual.


### Input JSON

```json
{
  "selectedCompany": "empresa1",
  "catalog": {
    "companies": {
      "empresa1": {
        "coreDatasets": []
      }
    }
  },
  "pathReport": {
    "missing_paths": []
  }
}
```

### Output JSON

```json
{
  "visibleDatasets": [
    {
      "name": "demand_records",
      "path": "data/empresa1/core/demand_records.json",
      "status": "OK"
    }
  ],
  "missingDatasets": []
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| getCompanyDatasets(catalog, companyId) | Filtra datasets pela empresa selecionada. |
| normalizeDatasetRecord(record) | Padroniza nome, descrição, formato e path. |
| renderDatasetCard(dataset) | Cria o card visual do dataset. |
| markDatasetStatus(dataset, pathReport) | Marca OK/warning/error conforme auditoria de paths. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| PathAuditPanel.getPathStatus | Checar se o caminho está em missing_paths. |
| DataLoader.fetchJson | Opcionalmente carregar metadados dos datasets. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | getCompanyDatasets filtra corretamente |
| unit | path absoluto é sinalizado |
| integration | Empresa 1 mostra demanda/distância/premissas |
| integration | Empresa 2 mostra tabelas core e scenario_blocks |
| manual | copiar um caminho exibido e conferir que existe na pasta |
| acceptance | todo dataset obrigatório tem path visível |


## DataQualityPanel

**Status:** `implemented_phase_1`  
**Página/tela:** `/ e /fase-1-validacao/`


**O que faz:** Exibe score de qualidade, contagens, warnings e erros já apurados na preparação dos dados.


### Input JSON

```json
{
  "selectedCompany": "empresa1",
  "qualitySummary": {
    "empresa1": {
      "score": 92,
      "errors": [],
      "warnings": []
    }
  }
}
```

### Output JSON

```json
{
  "qualityViewModel": {
    "score": 92,
    "status": "OK",
    "errors": [],
    "warnings": []
  }
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| getQualityForCompany(summary, companyId) | Obtém o bloco de qualidade da empresa. |
| classifyQualityStatus(score, errors) | Traduz score e erros em OK/warning/error. |
| renderQualityMetric(metric) | Renderiza indicador principal. |
| renderWarnings(warnings) | Lista alertas sem esconder informação. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| DatasetPanel.getCompanyDatasets | Cruzar qualidade com datasets exibidos, se necessário. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | erro gera status error |
| unit | score baixo gera warning |
| integration | painel muda ao trocar empresa |
| manual | verificar se warnings aparecem em amarelo e erros em vermelho |
| acceptance | não esconder problemas de dados |


## PathAuditPanel

**Status:** `implemented_phase_1`  
**Página/tela:** `/ e /fase-1-validacao/`


**O que faz:** Mostra a auditoria dos caminhos do pacote: quantidade checada, faltantes, abas auditadas e arquivos core obrigatórios.


### Input JSON

```json
{
  "pathReport": {
    "result": "OK",
    "path_count_checked": 55,
    "missing_paths": []
  },
  "auditSummary": {
    "workbooks_checked": 5,
    "sheets_checked": 53
  }
}
```

### Output JSON

```json
{
  "auditStatus": "OK",
  "missingCount": 0,
  "checkedPaths": 55,
  "workbooksChecked": 5,
  "sheetsChecked": 53
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| getPathStatus(path, report) | Retorna OK/missing para um path. |
| summarizeAudit(report, summary) | Cria indicadores de auditoria. |
| renderAuditBadges(summary) | Mostra badges visuais de OK/warning/error. |
| renderMissingPaths(paths) | Lista paths faltantes quando existirem. |


### Funções/módulos chamados de fora


Este módulo não depende diretamente de outro módulo de domínio.


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | missing_paths vazio gera OK |
| unit | missing_paths > 0 gera error |
| integration | path report é exibido na página |
| manual | confirmar visualmente missing_paths = 0 |
| acceptance | nenhum caminho crítico pode ficar invisível |


## WorkbookInventoryPanel

**Status:** `implemented_phase_1`  
**Página/tela:** `/ e /fase-1-validacao/`


**O que faz:** Mostra o inventário de abas dos workbooks, especialmente para provar que as abas da Empresa 2 foram exportadas e mapeadas.


### Input JSON

```json
{
  "inventoryRows": [
    {
      "empresa": "empresa2",
      "workbook": "Analise_Malha_Empresa2(1).xlsx",
      "sheet": "Cenários",
      "csv_export_path": "data/empresa2/source_exports/.../Cenários.csv"
    }
  ],
  "selectedCompany": "empresa2"
}
```

### Output JSON

```json
{
  "visibleSheets": [
    {
      "sheet": "Cenários",
      "status": "mapped",
      "coreMapping": [
        "scenario_blocks.json",
        "scenario_totals.json"
      ]
    }
  ],
  "sheetCount": 25
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| parseWorkbookInventory(csvText) | Converte o inventário CSV em linhas. |
| filterInventoryByCompany(rows, companyId) | Filtra abas por empresa. |
| detectSpecialSheets(rows) | Marca abas com tratamento especial, como Cenários. |
| renderSheetInventoryTable(rows) | Mostra tabela compacta de abas e exports. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| DataLoader.fetchText | Carregar workbook_sheet_inventory.csv. |
| PathAuditPanel.getPathStatus | Validar paths de exports. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | Cenários é detectada como special sheet |
| unit | filtro por empresa não mistura workbooks |
| integration | inventário mostra 53 abas auditadas |
| integration | Empresa 2 mostra 25 abas por workbook |
| manual | verificar se Cenários mostra scenario_blocks/scenario_totals |
| acceptance | toda aba auditada precisa ter export ou justificativa |


## ManualChecklist

**Status:** `implemented_phase_1`  
**Página/tela:** `/ e /fase-1-validacao/`


**O que faz:** Permite ao usuário marcar manualmente validações da Fase 1 e salvar o progresso no navegador.


### Input JSON

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

### Output JSON

```json
{
  "completed": 1,
  "total": 7,
  "storageKey": "phase1ManualChecklist"
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| loadChecklistState(key) | Lê checks salvos no localStorage. |
| toggleCheck(checkId) | Marca/desmarca uma validação. |
| saveChecklistState(key, state) | Persiste o progresso localmente. |
| resetChecklist() | Limpa o checklist manual. |


### Funções/módulos chamados de fora


Este módulo não depende diretamente de outro módulo de domínio.


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | toggleCheck alterna boolean |
| unit | reset limpa todos |
| integration | estado persiste após reload |
| manual | marcar checklist, recarregar página, conferir permanência |
| acceptance | usuário consegue auditar manualmente a Fase 1 sem abrir código |


## Phase1TestPanel

**Status:** `implemented_phase_1`  
**Página/tela:** `/ e /fase-1-validacao/`


**O que faz:** Mostra no navegador os testes automáticos básicos da Fase 1, permitindo checagem rápida sem terminal.


### Input JSON

```json
{
  "appState": {},
  "loadedArtifacts": {},
  "selectedCompany": "empresa1"
}
```

### Output JSON

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

### Funções internas do módulo


| Função | Descrição |
|---|---|
| runBrowserChecks(state) | Executa testes simples no estado carregado. |
| assertCondition(name, condition) | Converte condição em resultado pass/fail. |
| renderTestResults(results) | Mostra os testes em cards/tabela. |
| computeTestSummary(results) | Conta passes/fails. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| DataLoader | Usa estado carregado pelo DataLoader. |
| CompanySelector | Confirma empresa selecionada. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | assertCondition false gera fail |
| unit | summary conta resultados |
| integration | painel aparece depois do carregamento |
| manual | confirmar que todos os testes do navegador passam |
| acceptance | falha precisa aparecer visualmente |



# Fase 2


## BaselineBuilder

**Status:** `planned_phase_2`  
**Página/tela:** `/fase-2-baseline`


**O que faz:** Reconstrói o cenário atual de cada empresa a partir dos dados core, gerando a estrutura AS-IS que será usada como comparação oficial.


### Input JSON

```json
{
  "company": "empresa1",
  "coreData": {
    "demand": "data/empresa1/core/demand_records.json",
    "distances": "data/empresa1/core/distance_matrix.json",
    "assumptions": "data/empresa1/core/premissas.json"
  },
  "baselineRules": {
    "allocationPolicy": "current_or_nearest_valid",
    "timeGrain": "annual"
  }
}
```

### Output JSON

```json
{
  "baselineScenario": {
    "scenarioId": "baseline_empresa1",
    "company": "empresa1",
    "activeCds": [],
    "flows": [],
    "timeGrain": "annual",
    "isBaseline": true
  },
  "warnings": []
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| buildBaseline(company, coreData, rules) | Orquestra a construção do AS-IS. |
| inferActiveCds(coreData) | Identifica CDs ativos nos dados. |
| buildInitialFlows(demand, distances, rules) | Monta fluxos origem-CD-destino. |
| validateBaselineCompleteness(baseline) | Confere se demanda, CD e UF estão cobertos. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| DataLoader.fetchJson | Carregar dados core. |
| FlowBuilder.buildFlows | Construir fluxos normalizados. |
| BaselineValidator.validate | Validar AS-IS antes dos custos. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | baseline tem company |
| unit | baseline tem scenarioId |
| unit | demanda total preservada |
| integration | Empresa 1 gera baseline |
| integration | Empresa 2 gera baseline |
| manual | verificar CDs ativos e UFs atendidas |
| acceptance | não existe UF com demanda sem atendimento |


## FlowBuilder

**Status:** `planned_phase_2`  
**Página/tela:** `/fase-2-baseline`


**O que faz:** Normaliza os fluxos logísticos usados por custo, serviço, cenário e comparação.


### Input JSON

```json
{
  "demandRecords": [],
  "distanceMatrix": [],
  "allocationRules": {
    "eachDestinationAssignedTo": "one_cd",
    "fallback": "nearest_cd_with_distance"
  }
}
```

### Output JSON

```json
{
  "flows": [
    {
      "origin": "SP",
      "cd": "CD_SP",
      "destinationUf": "RJ",
      "volume": 1000,
      "distanceKm": 450,
      "flowType": "transfer_or_distribution"
    }
  ],
  "unassignedDemand": []
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| normalizeDemand(records) | Padroniza demanda por UF/CD/SKU/mês quando existir. |
| lookupDistance(origin, destination, matrix) | Busca distância de forma robusta. |
| assignDemandToCd(demand, rules) | Aplica política de atendimento. |
| buildFlowRecords(assignments) | Gera registros normalizados de fluxo. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| DataQualityPanel | Usa warnings de dados para não mascarar faltantes. |
| ScenarioValidator | Reaproveita regras de validade de cenário. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | distância faltante vira warning |
| unit | volume total dos flows = demanda total |
| integration | flows alimentam CostEngine |
| manual | checar top rotas em tabela |
| acceptance | nenhum fluxo crítico sem origem, CD, destino ou volume |


## CostEngine

**Status:** `planned_phase_2`  
**Página/tela:** `/fase-2-baseline e /fase-3-cenarios`


**O que faz:** Calcula as parcelas de custo logístico: transferência, distribuição, armazenagem, estoque e total.


### Input JSON

```json
{
  "scenario": {
    "company": "empresa1",
    "flows": []
  },
  "assumptions": {
    "freightRate": {
      "transfer": 4.3,
      "distribution": 6.8,
      "unit": "BRL/km_or_ton_km"
    },
    "storageCost": {},
    "inventoryDays": 45,
    "wacc": 0.15
  }
}
```

### Output JSON

```json
{
  "costs": {
    "transferCost": 0,
    "distributionCost": 0,
    "storageCost": 0,
    "inventoryCost": 0,
    "totalLogisticsCost": 0
  },
  "costByCd": [],
  "costByUf": [],
  "warnings": []
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| calculateTransferCost(flows, assumptions) | Calcula custo fábrica-CD. |
| calculateDistributionCost(flows, assumptions) | Calcula custo CD-cliente/UF. |
| calculateStorageCost(scenario, assumptions) | Calcula armazenagem por CD. |
| calculateInventoryCost(scenario, assumptions) | Calcula custo de capital em estoque. |
| sumCostComponents(components) | Fecha total logístico. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| FlowBuilder | Recebe fluxos normalizados. |
| TaxEngine | Opcionalmente compõe custo total com tributos. |
| ScenarioQualityCheck | Envia custos e alertas para score de qualidade. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | total = soma das parcelas |
| unit | custo nunca negativo |
| unit | frete maior aumenta transporte |
| integration | baseline alimenta BaseFitScore |
| integration | cenário alimenta Comparator |
| manual | alterar frete +10% e verificar transporte maior |
| acceptance | cada custo tem premissa rastreável |


## TaxEngine

**Status:** `planned_phase_2`  
**Página/tela:** `/fase-2-baseline e /fase-3-cenarios`


**O que faz:** Calcula camada tributária parametrizada, sem assumir regra fiscal hardcoded não validada. Deve suportar regime atual, sem efeito tributário e horizonte de reforma quando os dados existirem.


### Input JSON

```json
{
  "scenario": {},
  "taxTables": {
    "icmsRoutes": "data/empresa2/core/dados_tributario.json",
    "icms216": "references/raw_sources/icms_216_linhas.csv"
  },
  "taxMode": "current|no_tax|reform_transition|post_reform",
  "assumptions": {
    "useDifal": true,
    "useBenefits": false
  }
}
```

### Output JSON

```json
{
  "taxResults": {
    "icmsOwn": 0,
    "difal": 0,
    "taxBenefit": 0,
    "totalTaxImpact": 0
  },
  "taxByRoute": [],
  "warnings": []
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| resolveTaxMode(mode) | Seleciona regime tributário. |
| lookupRouteTax(origin, cd, destination, tables) | Busca regra por rota. |
| calculateDifal(route, assumptions) | Calcula DIFAL quando aplicável. |
| applyTaxBenefit(route, assumptions) | Aplica benefício somente se parametrizado. |
| aggregateTax(routeTaxes) | Consolida tributo por cenário. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| FlowBuilder | Recebe rotas. |
| AuditTrail | Registra premissas fiscais usadas. |
| ScenarioQualityCheck | Envia alertas de dependência tributária. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | no_tax retorna zero |
| unit | alíquota faltante gera warning |
| unit | DIFAL não pode ser negativo sem regra explícita |
| integration | resultado tributário entra no comparator |
| manual | ligar/desligar efeito tributário e ver diferença |
| acceptance | benefício fiscal precisa ficar explícito como premissa, nunca escondido |


## BaseFitScore

**Status:** `planned_phase_2`  
**Página/tela:** `/fase-2-baseline`


**O que faz:** Mede a paridade entre resultado simulado e cenário real/base. Essa é a prova de que o simulador replica a realidade antes de simular futuro.


### Input JSON

```json
{
  "actual": {
    "totalLogisticsCost": 10000000,
    "components": {}
  },
  "simulated": {
    "totalLogisticsCost": 9800000,
    "components": {}
  },
  "weights": {
    "total": 0.4,
    "components": 0.4,
    "cd": 0.1,
    "uf": 0.1
  }
}
```

### Output JSON

```json
{
  "baseFitScore": 91,
  "totalErrorPct": -2.0,
  "componentErrors": {},
  "status": "OK",
  "alerts": []
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| calculatePctError(actual, simulated) | Calcula erro percentual robusto. |
| scoreError(error, tolerance) | Converte erro em nota 0-100. |
| aggregateFitScore(scores, weights) | Agrega score ponderado. |
| classifyFitStatus(score, alerts) | Classifica OK/warning/error. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| CostEngine | Recebe custos simulados. |
| BaselineBuilder | Recebe cenário base. |
| CalibrationPanel | Mostra o resultado visual. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | simulado igual real => 100 |
| unit | erro alto reduz score |
| unit | divisão por zero tratada |
| integration | Fase 2 mostra score por empresa |
| manual | comparar tabela real vs simulado |
| acceptance | erro alto não pode ser vendido como OK |


## CalibrationPanel

**Status:** `planned_phase_2`  
**Página/tela:** `/fase-2-baseline`


**O que faz:** Mostra visualmente paridade, erros por componente e pontos que precisam de calibração.


### Input JSON

```json
{
  "baseFit": {},
  "actual": {},
  "simulated": {},
  "selectedCompany": "empresa1"
}
```

### Output JSON

```json
{
  "visibleRows": [
    {
      "metric": "total",
      "actual": 100,
      "simulated": 98,
      "errorPct": -2,
      "status": "OK"
    }
  ],
  "calibrationWarnings": []
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| buildCalibrationRows(actual, simulated) | Monta linhas de comparação. |
| renderFitScore(score) | Renderiza nota final. |
| renderErrorHeatmap(rows) | Mostra onde o modelo erra mais. |
| renderCalibrationHints(alerts) | Sugere checagens sem inventar correções. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| BaseFitScore | Recebe score e erros. |
| AuditTrail | Registra versão de calibração. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | linhas mostram real/simulado/erro |
| unit | warning aparece quando erro > tolerância |
| integration | troca de empresa troca calibração |
| manual | conferir se o erro total está visível |
| acceptance | não esconder erro de calibração |



# Fase 3


## ScenarioBuilder

**Status:** `planned_phase_3`  
**Página/tela:** `/fase-3-cenarios`


**O que faz:** Permite criar cenários manuais a partir do baseline, mudando CDs ativos, alocação, frete, estoque, demanda, modo tributário e outras premissas controladas.


### Input JSON

```json
{
  "baselineScenario": {
    "scenarioId": "baseline_empresa1"
  },
  "changes": {
    "activeCds": [
      "RJ",
      "SP",
      "ES"
    ],
    "freightMultiplier": 1.1,
    "inventoryDays": 35,
    "taxMode": "current"
  }
}
```

### Output JSON

```json
{
  "scenario": {
    "scenarioId": "empresa1_custom_001",
    "company": "empresa1",
    "isBaseline": false,
    "changesApplied": []
  },
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": []
  }
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| createScenarioFromBaseline(baseline) | Clona baseline com versionamento. |
| applyScenarioChanges(scenario, changes) | Aplica alterações do usuário. |
| rebuildScenarioFlows(scenario) | Recalcula fluxos quando CD/alocação muda. |
| nameScenario(scenario, name) | Define nome legível e ID. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| ScenarioValidator | Valida alterações. |
| FlowBuilder | Recria fluxos. |
| CostEngine | Calcula custos do cenário. |
| TaxEngine | Calcula tributos se ligado. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | cenário mantém company |
| unit | changesApplied registra mudanças |
| integration | cenário criado aparece no comparador |
| manual | fechar um CD e conferir mudança visual |
| acceptance | cenário inválido gera erro claro |


## ScenarioValidator

**Status:** `planned_phase_3`  
**Página/tela:** `/fase-3-cenarios`


**O que faz:** Bloqueia ou alerta cenários impossíveis: sem CD ativo, demanda sem atendimento, capacidade estourada, distância ausente ou empresa misturada.


### Input JSON

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

### Output JSON

```json
{
  "valid": true,
  "errors": [],
  "warnings": [],
  "blockingReasons": []
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| validateCompanyIsolation(scenario) | Garante que a empresa é única. |
| validateActiveCds(scenario) | Confere CDs ativos. |
| validateDemandCoverage(scenario) | Confere atendimento da demanda. |
| validateCapacity(scenario, constraints) | Confere capacidade. |
| validateDistances(scenario) | Confere rotas com distância. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| DataQualityPanel | Usa diagnóstico de dados. |
| ScenarioQualityCheck | Envia warnings não bloqueantes. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | sem CD ativo é inválido |
| unit | empresa misturada é inválida |
| integration | ScenarioBuilder chama validator antes de salvar |
| manual | tentar cenário absurdo e ver bloqueio |
| acceptance | nenhum cenário inválido entra no ranking |


## ScenarioComparator

**Status:** `planned_phase_3`  
**Página/tela:** `/fase-3-cenarios`


**O que faz:** Compara múltiplos cenários da mesma empresa contra o baseline correto, mostrando custo, saving, serviço, risco e tributo.


### Input JSON

```json
{
  "baselineScenarioId": "baseline_empresa1",
  "scenarios": [
    {
      "scenarioId": "baseline_empresa1"
    },
    {
      "scenarioId": "empresa1_custom_001"
    }
  ],
  "metrics": [
    "cost",
    "saving",
    "service",
    "risk",
    "tax"
  ]
}
```

### Output JSON

```json
{
  "comparisonTable": [],
  "deltaVsBaseline": [],
  "bestByCost": "empresa1_custom_001",
  "warnings": []
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| assertSameCompany(scenarios) | Impede comparação entre empresas. |
| computeScenarioDelta(baseline, scenario) | Calcula diferença contra base. |
| buildComparisonTable(scenarios) | Monta tabela lado a lado. |
| rankByMetric(scenarios, metric) | Ordena por métrica escolhida. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| CostEngine | Usa custos calculados. |
| TaxEngine | Usa tributos calculados. |
| ScenarioQualityCheck | Usa scores e alertas. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | baseline saving = 0 |
| unit | cross-company bloqueado |
| integration | cenários criados aparecem na tabela |
| manual | comparar Base, 3 CDs e ES |
| acceptance | saving sempre usa baseline da mesma empresa |


## ScenarioQualityCheck

**Status:** `planned_phase_3`  
**Página/tela:** `/fase-3-cenarios e /fase-4-score-otimizador`


**O que faz:** Avalia plausibilidade operacional do cenário, separando cenário barato de cenário realmente executável.


### Input JSON

```json
{
  "scenario": {},
  "results": {},
  "constraints": {
    "maxConcentration": 0.65,
    "maxCdUtilization": 0.9,
    "maxDistanceIncreasePct": 20
  }
}
```

### Output JSON

```json
{
  "qualityScore": 78,
  "alerts": [
    {
      "severity": "warning",
      "message": "CD ES concentra 82% do volume"
    }
  ],
  "riskFlags": []
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| calculateConcentrationRisk(scenario) | Mede dependência de poucos CDs. |
| calculateCapacityRisk(scenario, constraints) | Mede estouro de capacidade. |
| calculateServiceProxy(scenario) | Usa distância/lead time proxy. |
| aggregateQualityScore(parts) | Agrega qualidade 0-100. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| ScenarioValidator | Recebe validade básica. |
| ScenarioScoring | Entrega qualityScore para ranking. |
| ExplainabilityEngine | Entrega alertas para explicação. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | 100% volume em um CD gera alerta |
| unit | capacidade acima do limite gera severidade alta |
| integration | Comparator mostra qualityScore |
| manual | centralizar tudo e conferir alerta |
| acceptance | custo baixo não apaga risco alto |


## ScenarioPersistence

**Status:** `planned_phase_3`  
**Página/tela:** `/fase-3-cenarios`


**O que faz:** Salva cenários criados pelo usuário no navegador e permite exportar/importar JSON de cenário.


### Input JSON

```json
{
  "scenario": {},
  "storageKey": "savedScenarios_empresa1",
  "operation": "save|load|delete|export|import"
}
```

### Output JSON

```json
{
  "savedScenarios": [],
  "exportJson": {},
  "status": "OK"
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| saveScenario(scenario) | Salva no localStorage por empresa. |
| loadScenarios(company) | Lê cenários da empresa. |
| deleteScenario(id) | Remove cenário. |
| exportScenario(id) | Gera JSON baixável. |
| importScenario(json) | Importa e valida cenário. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| ScenarioValidator | Valida antes de salvar/importar. |
| AuditTrail | Registra origem do cenário importado/exportado. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | salva e carrega por empresa |
| unit | delete remove só o cenário escolhido |
| integration | cenário salvo aparece após reload |
| manual | salvar cenário, recarregar, conferir |
| acceptance | cenários da Empresa 1 não aparecem na Empresa 2 |



# Fase 4


## ObjectiveBuilder

**Status:** `planned_phase_4`  
**Página/tela:** `/fase-4-score-otimizador`


**O que faz:** Permite ao usuário criar sua própria função objetivo com pesos de custo, serviço, risco, tributo e estoque.


### Input JSON

```json
{
  "weights": {
    "cost": 0.4,
    "service": 0.25,
    "risk": 0.15,
    "tax": 0.1,
    "inventory": 0.1
  },
  "profileName": "Perfil CFO"
}
```

### Output JSON

```json
{
  "objective": {
    "objectiveId": "perfil_cfo",
    "weights": {},
    "valid": true,
    "normalization": "minmax_by_comparison_set"
  },
  "errors": []
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| normalizeWeights(weights) | Faz pesos somarem 1 quando possível. |
| validateWeights(weights) | Bloqueia negativos e soma inválida. |
| buildObjective(profileName, weights) | Cria objeto de objetivo. |
| loadPresetProfile(name) | Carrega CFO/Supply/Fiscal/Conservador. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| ScenarioScoring | Envia objetivo validado. |
| ScenarioOptimizer | Envia objetivo para busca. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | pesos somam 1 |
| unit | peso negativo bloqueado |
| integration | mudar pesos muda ranking |
| manual | criar Perfil CFO e Perfil Supply |
| acceptance | objetivo inválido não roda score |


## ScenarioScoring

**Status:** `planned_phase_4`  
**Página/tela:** `/fase-4-score-otimizador`


**O que faz:** Normaliza métricas heterogêneas e calcula o score final de cada cenário conforme função objetivo escolhida.


### Input JSON

```json
{
  "scenarioResults": [],
  "objective": {
    "weights": {
      "cost": 0.4,
      "service": 0.25,
      "risk": 0.15,
      "tax": 0.1,
      "inventory": 0.1
    }
  }
}
```

### Output JSON

```json
{
  "rankedScenarios": [
    {
      "scenarioId": "cenario_3cds",
      "score": 86,
      "rank": 1,
      "scoreBreakdown": {}
    }
  ],
  "normalizationDetails": {}
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| normalizeMetric(values, direction) | Converte métricas para 0-100. |
| calculateWeightedScore(metrics, weights) | Calcula score ponderado. |
| buildScoreBreakdown(scenario) | Mostra contribuição de cada métrica. |
| rankScenarios(scored) | Ordena cenários por score. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| ObjectiveBuilder | Recebe pesos. |
| ScenarioQualityCheck | Recebe risco/qualidade. |
| ScenarioComparator | Recebe métricas comparáveis. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | menor custo recebe score maior |
| unit | maior risco recebe score menor |
| unit | score entre 0 e 100 |
| integration | ranking muda com pesos |
| manual | aumentar peso de custo e observar ranking |
| acceptance | score sempre mostra decomposição |


## ConstraintEngine

**Status:** `planned_phase_4`  
**Página/tela:** `/fase-4-score-otimizador`


**O que faz:** Define e valida restrições usadas pelo otimizador: mínimo/máximo de CDs, capacidade, concentração, cobertura e lead time.


### Input JSON

```json
{
  "constraints": {
    "minCds": 2,
    "maxCds": 4,
    "maxConcentration": 0.65,
    "requireAllDemandCovered": true
  }
}
```

### Output JSON

```json
{
  "normalizedConstraints": {},
  "valid": true,
  "errors": []
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| validateConstraintSchema(constraints) | Confere tipos e limites. |
| applyHardConstraints(scenario) | Elimina cenário impossível. |
| applySoftConstraints(scenario) | Gera penalidades/alerts. |
| explainConstraintFailure(scenario) | Explica por que cenário foi rejeitado. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| ScenarioValidator | Reaproveita validade operacional. |
| ScenarioOptimizer | Filtra candidatos. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | minCds > maxCds é inválido |
| unit | maxConcentration fora de 0-1 é inválido |
| integration | otimizador rejeita candidato inválido |
| manual | limitar max CDs e conferir busca |
| acceptance | cenário que viola hard constraint não entra no top |


## ScenarioOptimizer

**Status:** `planned_phase_4`  
**Página/tela:** `/fase-4-score-otimizador`


**O que faz:** Enumera o espaço discreto modelado, aplica restrições, calcula score e retorna o melhor cenário viável com desempate determinístico.


### Input JSON

```json
{
  "company": "empresa1",
  "baseline": {},
  "objective": {},
  "constraints": {},
  "searchConfig": {
    "method": "exact_discrete",
    "max_candidates": 2000,
    "seed": 42
  }
}
```

### Output JSON

```json
{
  "bestScenarios": [],
  "searchLog": {
    "method_requested": "exact_discrete",
    "method_applied": "exact_discrete",
    "generated_candidates": 270,
    "valid_candidates": 240,
    "invalid_candidates": 30,
    "exact_search_space": true,
    "space_limited": false
  }
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| generateCandidate(scenario, rng) | Cria candidato a partir de mudanças. |
| evaluateCandidate(candidate) | Valida, calcula custo, qualidade e score. |
| runExhaustiveSearch(space) | Testa espaço pequeno inteiro. |
| runGreedySearch(space) | Busca incremental simples. |
| runIteratedGreedy(config) | Refina candidatos por iterações. |
| recordSearchLog(event) | Registra busca auditável. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| ScenarioBuilder | Criar candidatos. |
| ConstraintEngine | Filtrar candidatos. |
| CostEngine | Avaliar custo. |
| TaxEngine | Avaliar tributo. |
| ScenarioScoring | Avaliar score. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | mesma seed reproduz resultado |
| unit | não gera cenário sem CD |
| integration | top 5 aparecem na tela |
| manual | rodar busca e conferir log |
| acceptance | otimizador sempre informa quantos cenários testou |


## SearchLogPanel

**Status:** `planned_phase_4`  
**Página/tela:** `/fase-4-score-otimizador`


**O que faz:** Mostra rastreabilidade da busca: método, seed, candidatos testados, rejeições e top cenários.


### Input JSON

```json
{
  "searchLog": {
    "testedScenarios": 500,
    "validScenarios": 420,
    "invalidScenarios": 80,
    "rejectionReasons": []
  }
}
```

### Output JSON

```json
{
  "visibleLog": {},
  "rejectionSummary": [],
  "topCandidatesTable": []
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| summarizeSearchLog(log) | Consolida números da busca. |
| groupRejectionReasons(log) | Agrupa por restrição violada. |
| renderTopCandidates(candidates) | Mostra top cenários. |
| renderSearchConfig(config) | Mostra método/seed/iters. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| ScenarioOptimizer | Recebe log. |
| AuditTrail | Envia log para rastreabilidade. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | valid+invalid = tested |
| unit | rejection summary agrupa corretamente |
| integration | log aparece após otimização |
| manual | verificar método e seed usados |
| acceptance | busca sem log não é aceita |



# Fase 5


## StressTestEngine

**Status:** `planned_phase_5`  
**Página/tela:** `/fase-5-entrega-final`


**O que faz:** Aplica choques de frete, demanda, WACC, armazenagem, capacidade e tributo para testar robustez do cenário.


### Input JSON

```json
{
  "scenario": {},
  "stressCases": [
    {
      "name": "frete_mais_20",
      "changes": {
        "freightMultiplier": 1.2
      }
    }
  ],
  "baseline": {}
}
```

### Output JSON

```json
{
  "stressResults": [
    {
      "case": "frete_mais_20",
      "totalCost": 11000000,
      "savingVsBase": 0.03,
      "stillPositive": true
    }
  ],
  "robustnessScore": 74,
  "alerts": []
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| applyStressCase(scenario, stressCase) | Cria versão estressada. |
| runStressCase(stressedScenario) | Calcula cenário sob choque. |
| compareStressVsBaseline(result) | Mede saving e piora. |
| calculateRobustnessScore(results) | Agrega robustez. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| ScenarioBuilder | Aplicar mudanças temporárias. |
| CostEngine | Recalcular custos. |
| TaxEngine | Recalcular tributo. |
| ScenarioComparator | Comparar contra base. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | frete +20% aumenta transporte |
| unit | demanda +15% aumenta volume/custo variável |
| integration | stress roda nos top cenários |
| manual | rodar stress no cenário vencedor |
| acceptance | saving negativo em stress gera alerta |


## ExplainabilityEngine

**Status:** `planned_phase_5`  
**Página/tela:** `/fase-5-entrega-final`


**O que faz:** Gera explicações textuais simples e auditáveis sobre por que um cenário ganhou, perdeu ou ficou arriscado.


### Input JSON

```json
{
  "baselineResults": {},
  "scenarioResults": {},
  "delta": {},
  "qualityAlerts": [],
  "stressResults": []
}
```

### Output JSON

```json
{
  "explanation": "O cenário reduziu armazenagem, mas aumentou distribuição.",
  "mainDrivers": [
    "redução de armazenagem",
    "aumento de distância média"
  ],
  "riskNarrative": "Cenário concentra volume em um CD."
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| identifyMainDrivers(delta) | Escolhe maiores variações. |
| describeTradeoffs(delta, alerts) | Gera texto de trade-off. |
| describeStressBehavior(stressResults) | Resume robustez. |
| guardAgainstOverclaim(text, evidence) | Evita afirmações sem dado. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| ScenarioComparator | Recebe delta. |
| ScenarioQualityCheck | Recebe alertas. |
| StressTestEngine | Recebe stress. |
| ExecutiveReport | Envia narrativa final. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | se armazenagem cai, texto menciona queda |
| unit | se risco alto, texto menciona risco |
| integration | relatório inclui explicação |
| manual | ler explicação e conferir com gráficos |
| acceptance | não dizer que é melhor se score/robustez não sustentam |


## AuditTrail

**Status:** `planned_phase_5`  
**Página/tela:** `/fase-5-entrega-final e global`


**O que faz:** Registra dados, premissas, versão do modelo, cenário, objetivo e resultados para cada simulação exportável.


### Input JSON

```json
{
  "company": "empresa1",
  "scenario": {},
  "assumptions": {},
  "dataVersions": {},
  "modelVersion": "1.0.0",
  "results": {}
}
```

### Output JSON

```json
{
  "auditRecord": {
    "auditId": "audit_001",
    "company": "empresa1",
    "scenarioId": "cenario_3cds",
    "dataSources": [],
    "assumptionsUsed": {},
    "modelVersion": "1.0.0"
  }
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| createAuditRecord(payload) | Cria registro de auditoria. |
| hashScenarioInput(scenario) | Gera hash reprodutível. |
| attachDataSources(record, sources) | Anexa paths e hashes de fontes. |
| exportAuditJson(record) | Gera JSON exportável. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| ScenarioPersistence | Recebe cenários salvos/importados. |
| ScenarioOptimizer | Recebe search log. |
| ExecutiveReport | Inclui auditoria no relatório. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | audit tem empresa, cenário, versão e premissas |
| unit | hash muda quando input muda |
| integration | relatório exporta audit trail |
| manual | abrir JSON de auditoria e conferir fontes |
| acceptance | nenhuma simulação final sem audit trail |


## ExecutiveReport

**Status:** `planned_phase_5`  
**Página/tela:** `/fase-5-entrega-final`


**O que faz:** Monta relatório executivo do cenário: resumo, comparação, saving, riscos, stress, premissas e recomendação defendível.


### Input JSON

```json
{
  "company": "empresa1",
  "baseline": {},
  "selectedScenario": {},
  "comparison": {},
  "stress": {},
  "explanation": {},
  "audit": {}
}
```

### Output JSON

```json
{
  "report": {
    "title": "Relatório Executivo - Empresa 1",
    "sections": [
      "Resumo",
      "Comparação",
      "Riscos",
      "Stress",
      "Premissas"
    ]
  },
  "exportFormats": [
    "html",
    "json",
    "csv_summary"
  ]
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| buildExecutiveSummary(inputs) | Cria resumo de decisão. |
| buildCostWaterfallData(comparison) | Prepara decomposição de saving. |
| buildRiskSection(alerts) | Monta seção de riscos. |
| buildAssumptionsSection(audit) | Lista premissas. |
| renderReport(report) | Renderiza relatório. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| ExplainabilityEngine | Recebe narrativa. |
| AuditTrail | Recebe premissas/fontes. |
| ExportEngine | Exporta arquivos. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | relatório tem empresa e cenário |
| unit | relatório inclui saving e premissas |
| integration | relatório gera após stress |
| manual | ler relatório e ver se conta a história |
| acceptance | relatório não pode faltar audit trail |


## ExportEngine

**Status:** `planned_phase_5`  
**Página/tela:** `/fase-5-entrega-final`


**O que faz:** Exporta resultados, cenários, auditoria e relatórios em formatos simples para entrega ou reuso.


### Input JSON

```json
{
  "payload": {},
  "format": "json|csv|html",
  "filename": "resultado_empresa1_cenario3.json"
}
```

### Output JSON

```json
{
  "downloadReady": true,
  "filename": "resultado_empresa1_cenario3.json",
  "mimeType": "application/json"
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| toJson(payload) | Serializa JSON. |
| toCsv(rows) | Converte linhas para CSV. |
| toHtml(report) | Gera HTML exportável. |
| triggerDownload(blob, filename) | Dispara download no navegador. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| ExecutiveReport | Exporta relatório. |
| AuditTrail | Exporta auditoria. |
| ScenarioPersistence | Exporta/importa cenários. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | JSON exportado é parseável |
| unit | CSV contém cabeçalho |
| integration | botão exportar gera arquivo |
| manual | baixar arquivo e abrir |
| acceptance | export não pode sair vazio |


## RecommendationPanel

**Status:** `planned_phase_5`  
**Página/tela:** `/fase-5-entrega-final`


**O que faz:** Apresenta recomendação final com ressalvas: melhor cenário por objetivo, robustez, riscos e próximos passos.


### Input JSON

```json
{
  "rankedScenarios": [],
  "stressResults": [],
  "explanations": [],
  "objective": {}
}
```

### Output JSON

```json
{
  "recommendation": {
    "recommendedScenarioId": "cenario_3cds",
    "confidence": "medium",
    "why": [],
    "caveats": []
  }
}
```

### Funções internas do módulo


| Função | Descrição |
|---|---|
| selectRecommendedScenario(ranked, stress) | Seleciona cenário equilibrando score e robustez. |
| buildCaveats(alerts) | Monta ressalvas. |
| classifyConfidence(evidence) | Classifica confiança. |
| renderRecommendation(rec) | Mostra recomendação visual. |


### Funções/módulos chamados de fora


| Módulo/função chamado | Por que chama |
|---|---|
| ScenarioScoring | Recebe ranking. |
| StressTestEngine | Recebe robustez. |
| ExplainabilityEngine | Recebe drivers e trade-offs. |


### Testes do módulo


| Tipo | Teste |
|---|---|
| unit | cenário com score alto e stress ruim recebe ressalva |
| unit | sem evidência suficiente => confiança baixa |
| integration | recomendação aparece no relatório |
| manual | conferir se recomendação não ignora riscos |
| acceptance | recomendação precisa citar caveats quando existirem |
