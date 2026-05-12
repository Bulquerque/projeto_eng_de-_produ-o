# Funções compostas e dependências entre módulos

Este documento separa duas coisas para cada módulo: funções internas, que o próprio módulo define, e chamadas externas, que dependem de outros módulos. Isso ajuda a reconstruir o projeto sem acoplamento confuso.


# Fase 1


## AppBootstrap


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| initApp() | Cria o estado inicial e coordena a sequência de carregamento. |
| loadPhase1Artifacts(paths) | Busca catálogo, qualidade, auditoria e inventário. |
| renderApp(state) | Renderiza a interface conforme a empresa selecionada. |
| showFatalError(error) | Mostra erro visível quando a inicialização falha. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| DataLoader.fetchJson | Carregar JSONs declarados em paths. |
| CompanySelector.render | Renderizar seleção Empresa 1 / Empresa 2. |
| DatasetPanel.render | Mostrar datasets da empresa selecionada. |
| PathAuditPanel.render | Mostrar status dos caminhos auditados. |

## DataLoader


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| fetchJson(path) | Carrega JSON e retorna objeto parseado com erro amigável. |
| fetchText(path) | Carrega CSV/texto sem tentar converter automaticamente. |
| parseCsv(text) | Converte CSV simples para array de objetos quando necessário. |
| loadAll(requests) | Executa as leituras essenciais e acumula erros. |

### Chamadas externas

Sem chamadas externas diretas.

## CompanySelector


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| renderCompanyCards(companies) | Monta os cards/botões das empresas. |
| selectCompany(companyId) | Atualiza estado global e solicita rerender. |
| getSelectedCompany(state) | Retorna a empresa ativa de forma segura. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| DatasetPanel.render | Re-renderizar datasets da empresa. |
| DataQualityPanel.render | Re-renderizar qualidade da empresa. |
| ManualChecklist.render | Atualizar checklist sem perder estado. |

## DatasetPanel


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| getCompanyDatasets(catalog, companyId) | Filtra datasets pela empresa selecionada. |
| normalizeDatasetRecord(record) | Padroniza nome, descrição, formato e path. |
| renderDatasetCard(dataset) | Cria o card visual do dataset. |
| markDatasetStatus(dataset, pathReport) | Marca OK/warning/error conforme auditoria de paths. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| PathAuditPanel.getPathStatus | Checar se o caminho está em missing_paths. |
| DataLoader.fetchJson | Opcionalmente carregar metadados dos datasets. |

## DataQualityPanel


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| getQualityForCompany(summary, companyId) | Obtém o bloco de qualidade da empresa. |
| classifyQualityStatus(score, errors) | Traduz score e erros em OK/warning/error. |
| renderQualityMetric(metric) | Renderiza indicador principal. |
| renderWarnings(warnings) | Lista alertas sem esconder informação. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| DatasetPanel.getCompanyDatasets | Cruzar qualidade com datasets exibidos, se necessário. |

## PathAuditPanel


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| getPathStatus(path, report) | Retorna OK/missing para um path. |
| summarizeAudit(report, summary) | Cria indicadores de auditoria. |
| renderAuditBadges(summary) | Mostra badges visuais de OK/warning/error. |
| renderMissingPaths(paths) | Lista paths faltantes quando existirem. |

### Chamadas externas

Sem chamadas externas diretas.

## WorkbookInventoryPanel


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| parseWorkbookInventory(csvText) | Converte o inventário CSV em linhas. |
| filterInventoryByCompany(rows, companyId) | Filtra abas por empresa. |
| detectSpecialSheets(rows) | Marca abas com tratamento especial, como Cenários. |
| renderSheetInventoryTable(rows) | Mostra tabela compacta de abas e exports. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| DataLoader.fetchText | Carregar workbook_sheet_inventory.csv. |
| PathAuditPanel.getPathStatus | Validar paths de exports. |

## ManualChecklist


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| loadChecklistState(key) | Lê checks salvos no localStorage. |
| toggleCheck(checkId) | Marca/desmarca uma validação. |
| saveChecklistState(key, state) | Persiste o progresso localmente. |
| resetChecklist() | Limpa o checklist manual. |

### Chamadas externas

Sem chamadas externas diretas.

## Phase1TestPanel


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| runBrowserChecks(state) | Executa testes simples no estado carregado. |
| assertCondition(name, condition) | Converte condição em resultado pass/fail. |
| renderTestResults(results) | Mostra os testes em cards/tabela. |
| computeTestSummary(results) | Conta passes/fails. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| DataLoader | Usa estado carregado pelo DataLoader. |
| CompanySelector | Confirma empresa selecionada. |

# Fase 2


## BaselineBuilder


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| buildBaseline(company, coreData, rules) | Orquestra a construção do AS-IS. |
| inferActiveCds(coreData) | Identifica CDs ativos nos dados. |
| buildInitialFlows(demand, distances, rules) | Monta fluxos origem-CD-destino. |
| validateBaselineCompleteness(baseline) | Confere se demanda, CD e UF estão cobertos. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| DataLoader.fetchJson | Carregar dados core. |
| FlowBuilder.buildFlows | Construir fluxos normalizados. |
| BaselineValidator.validate | Validar AS-IS antes dos custos. |

## FlowBuilder


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| normalizeDemand(records) | Padroniza demanda por UF/CD/SKU/mês quando existir. |
| lookupDistance(origin, destination, matrix) | Busca distância de forma robusta. |
| assignDemandToCd(demand, rules) | Aplica política de atendimento. |
| buildFlowRecords(assignments) | Gera registros normalizados de fluxo. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| DataQualityPanel | Usa warnings de dados para não mascarar faltantes. |
| ScenarioValidator | Reaproveita regras de validade de cenário. |

## CostEngine


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| calculateTransferCost(flows, assumptions) | Calcula custo fábrica-CD. |
| calculateDistributionCost(flows, assumptions) | Calcula custo CD-cliente/UF. |
| calculateStorageCost(scenario, assumptions) | Calcula armazenagem por CD. |
| calculateInventoryCost(scenario, assumptions) | Calcula custo de capital em estoque. |
| sumCostComponents(components) | Fecha total logístico. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| FlowBuilder | Recebe fluxos normalizados. |
| TaxEngine | Opcionalmente compõe custo total com tributos. |
| ScenarioQualityCheck | Envia custos e alertas para score de qualidade. |

## TaxEngine


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| resolveTaxMode(mode) | Seleciona regime tributário. |
| lookupRouteTax(origin, cd, destination, tables) | Busca regra por rota. |
| calculateDifal(route, assumptions) | Calcula DIFAL quando aplicável. |
| applyTaxBenefit(route, assumptions) | Aplica benefício somente se parametrizado. |
| aggregateTax(routeTaxes) | Consolida tributo por cenário. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| FlowBuilder | Recebe rotas. |
| AuditTrail | Registra premissas fiscais usadas. |
| ScenarioQualityCheck | Envia alertas de dependência tributária. |

## BaseFitScore


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| calculatePctError(actual, simulated) | Calcula erro percentual robusto. |
| scoreError(error, tolerance) | Converte erro em nota 0-100. |
| aggregateFitScore(scores, weights) | Agrega score ponderado. |
| classifyFitStatus(score, alerts) | Classifica OK/warning/error. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| CostEngine | Recebe custos simulados. |
| BaselineBuilder | Recebe cenário base. |
| CalibrationPanel | Mostra o resultado visual. |

## CalibrationPanel


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| buildCalibrationRows(actual, simulated) | Monta linhas de comparação. |
| renderFitScore(score) | Renderiza nota final. |
| renderErrorHeatmap(rows) | Mostra onde o modelo erra mais. |
| renderCalibrationHints(alerts) | Sugere checagens sem inventar correções. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| BaseFitScore | Recebe score e erros. |
| AuditTrail | Registra versão de calibração. |

# Fase 3


## ScenarioBuilder


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| createScenarioFromBaseline(baseline) | Clona baseline com versionamento. |
| applyScenarioChanges(scenario, changes) | Aplica alterações do usuário. |
| rebuildScenarioFlows(scenario) | Recalcula fluxos quando CD/alocação muda. |
| nameScenario(scenario, name) | Define nome legível e ID. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| ScenarioValidator | Valida alterações. |
| FlowBuilder | Recria fluxos. |
| CostEngine | Calcula custos do cenário. |
| TaxEngine | Calcula tributos se ligado. |

## ScenarioValidator


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| validateCompanyIsolation(scenario) | Garante que a empresa é única. |
| validateActiveCds(scenario) | Confere CDs ativos. |
| validateDemandCoverage(scenario) | Confere atendimento da demanda. |
| validateCapacity(scenario, constraints) | Confere capacidade. |
| validateDistances(scenario) | Confere rotas com distância. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| DataQualityPanel | Usa diagnóstico de dados. |
| ScenarioQualityCheck | Envia warnings não bloqueantes. |

## ScenarioComparator


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| assertSameCompany(scenarios) | Impede comparação entre empresas. |
| computeScenarioDelta(baseline, scenario) | Calcula diferença contra base. |
| buildComparisonTable(scenarios) | Monta tabela lado a lado. |
| rankByMetric(scenarios, metric) | Ordena por métrica escolhida. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| CostEngine | Usa custos calculados. |
| TaxEngine | Usa tributos calculados. |
| ScenarioQualityCheck | Usa scores e alertas. |

## ScenarioQualityCheck


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| calculateConcentrationRisk(scenario) | Mede dependência de poucos CDs. |
| calculateCapacityRisk(scenario, constraints) | Mede estouro de capacidade. |
| calculateServiceProxy(scenario) | Usa distância/lead time proxy. |
| aggregateQualityScore(parts) | Agrega qualidade 0-100. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| ScenarioValidator | Recebe validade básica. |
| ScenarioScoring | Entrega qualityScore para ranking. |
| ExplainabilityEngine | Entrega alertas para explicação. |

## ScenarioPersistence


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| saveScenario(scenario) | Salva no localStorage por empresa. |
| loadScenarios(company) | Lê cenários da empresa. |
| deleteScenario(id) | Remove cenário. |
| exportScenario(id) | Gera JSON baixável. |
| importScenario(json) | Importa e valida cenário. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| ScenarioValidator | Valida antes de salvar/importar. |
| AuditTrail | Registra origem do cenário importado/exportado. |

# Fase 4


## ObjectiveBuilder


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| normalizeWeights(weights) | Faz pesos somarem 1 quando possível. |
| validateWeights(weights) | Bloqueia negativos e soma inválida. |
| buildObjective(profileName, weights) | Cria objeto de objetivo. |
| loadPresetProfile(name) | Carrega CFO/Supply/Fiscal/Conservador. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| ScenarioScoring | Envia objetivo validado. |
| ScenarioOptimizer | Envia objetivo para busca. |

## ScenarioScoring


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| normalizeMetric(values, direction) | Converte métricas para 0-100. |
| calculateWeightedScore(metrics, weights) | Calcula score ponderado. |
| buildScoreBreakdown(scenario) | Mostra contribuição de cada métrica. |
| rankScenarios(scored) | Ordena cenários por score. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| ObjectiveBuilder | Recebe pesos. |
| ScenarioQualityCheck | Recebe risco/qualidade. |
| ScenarioComparator | Recebe métricas comparáveis. |

## ConstraintEngine


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| validateConstraintSchema(constraints) | Confere tipos e limites. |
| applyHardConstraints(scenario) | Elimina cenário impossível. |
| applySoftConstraints(scenario) | Gera penalidades/alerts. |
| explainConstraintFailure(scenario) | Explica por que cenário foi rejeitado. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| ScenarioValidator | Reaproveita validade operacional. |
| ScenarioOptimizer | Filtra candidatos. |

## ScenarioOptimizer


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| generateCandidate(scenario, rng) | Cria candidato a partir de mudanças. |
| evaluateCandidate(candidate) | Valida, calcula custo, qualidade e score. |
| runExhaustiveSearch(space) | Testa espaço pequeno inteiro. |
| runGreedySearch(space) | Busca incremental simples. |
| runIteratedGreedy(config) | Refina candidatos por iterações. |
| recordSearchLog(event) | Registra busca auditável. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| ScenarioBuilder | Criar candidatos. |
| ConstraintEngine | Filtrar candidatos. |
| CostEngine | Avaliar custo. |
| TaxEngine | Avaliar tributo. |
| ScenarioScoring | Avaliar score. |

## SearchLogPanel


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| summarizeSearchLog(log) | Consolida números da busca. |
| groupRejectionReasons(log) | Agrupa por restrição violada. |
| renderTopCandidates(candidates) | Mostra top cenários. |
| renderSearchConfig(config) | Mostra método/seed/iters. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| ScenarioOptimizer | Recebe log. |
| AuditTrail | Envia log para rastreabilidade. |

# Fase 5


## StressTestEngine


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| applyStressCase(scenario, stressCase) | Cria versão estressada. |
| runStressCase(stressedScenario) | Calcula cenário sob choque. |
| compareStressVsBaseline(result) | Mede saving e piora. |
| calculateRobustnessScore(results) | Agrega robustez. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| ScenarioBuilder | Aplicar mudanças temporárias. |
| CostEngine | Recalcular custos. |
| TaxEngine | Recalcular tributo. |
| ScenarioComparator | Comparar contra base. |

## ExplainabilityEngine


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| identifyMainDrivers(delta) | Escolhe maiores variações. |
| describeTradeoffs(delta, alerts) | Gera texto de trade-off. |
| describeStressBehavior(stressResults) | Resume robustez. |
| guardAgainstOverclaim(text, evidence) | Evita afirmações sem dado. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| ScenarioComparator | Recebe delta. |
| ScenarioQualityCheck | Recebe alertas. |
| StressTestEngine | Recebe stress. |
| ExecutiveReport | Envia narrativa final. |

## AuditTrail


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| createAuditRecord(payload) | Cria registro de auditoria. |
| hashScenarioInput(scenario) | Gera hash reprodutível. |
| attachDataSources(record, sources) | Anexa paths e hashes de fontes. |
| exportAuditJson(record) | Gera JSON exportável. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| ScenarioPersistence | Recebe cenários salvos/importados. |
| ScenarioOptimizer | Recebe search log. |
| ExecutiveReport | Inclui auditoria no relatório. |

## ExecutiveReport


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| buildExecutiveSummary(inputs) | Cria resumo de decisão. |
| buildCostWaterfallData(comparison) | Prepara decomposição de saving. |
| buildRiskSection(alerts) | Monta seção de riscos. |
| buildAssumptionsSection(audit) | Lista premissas. |
| renderReport(report) | Renderiza relatório. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| ExplainabilityEngine | Recebe narrativa. |
| AuditTrail | Recebe premissas/fontes. |
| ExportEngine | Exporta arquivos. |

## ExportEngine


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| toJson(payload) | Serializa JSON. |
| toCsv(rows) | Converte linhas para CSV. |
| toHtml(report) | Gera HTML exportável. |
| triggerDownload(blob, filename) | Dispara download no navegador. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| ExecutiveReport | Exporta relatório. |
| AuditTrail | Exporta auditoria. |
| ScenarioPersistence | Exporta/importa cenários. |

## RecommendationPanel


### Funções internas

| Função interna | Responsabilidade |
|---|---|
| selectRecommendedScenario(ranked, stress) | Seleciona cenário equilibrando score e robustez. |
| buildCaveats(alerts) | Monta ressalvas. |
| classifyConfidence(evidence) | Classifica confiança. |
| renderRecommendation(rec) | Mostra recomendação visual. |

### Chamadas externas

| Chamada externa | Motivo |
|---|---|
| ScenarioScoring | Recebe ranking. |
| StressTestEngine | Recebe robustez. |
| ExplainabilityEngine | Recebe drivers e trade-offs. |