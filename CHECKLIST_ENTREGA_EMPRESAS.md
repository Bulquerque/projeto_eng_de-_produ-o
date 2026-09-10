# Checklist completo de validação do simulador

Este checklist é a lista operacional de entrega do simulador Visagio. Cada item
deve ser executado separadamente para a Empresa 1 e para a Empresa 2 quando
houver dados, telas ou comportamento específico da empresa. Marque também a
evidência produzida: captura de tela, JSON exportado, CSV, log do navegador ou
resultado do teste automatizado.

Legenda: `[ ]` pendente, `[x]` aprovado, `[!]` bloqueado ou com ressalva.

## Registro de execução da release final — 2026-09-09

Esta lista mantém os casos individuais para homologação por empresa. O status
consolidado abaixo é a evidência produzida nesta release; uma linha individual
permanece pendente quando o teste automatizado ou a captura atual não prova
aquele caso específico.

- `[x]` Código: lint, formatação, auditoria de dependências e `git diff --check` aprovados.
- `[x]` Dados: build criptografado verificado com 144 arquivos; segredo não encontrado no repositório.
- `[x]` Cálculos: suíte completa, invariantes, regressão, contratos de dados, reconciliação, otimização e Monte Carlo aprovados.
- `[x]` Navegador: fluxo de apresentação desktop/mobile e regressão E2E aprovados; Fase 5 exercitada no navegador embutido.
- `[x]` Rotas diretas: Fase 3/4/5 carregam a empresa ativa ao entrar pelo hash, sem depender de clique prévio no seletor.
- `[x]` Bloqueio honesto: Empresa 2 exibe `—` para saving, custo final e robustez quando nenhum cenário é elegível.
- `[x]` Consistência: relatório executivo, auditoria, JSON/CSV e estado de release recebem a mesma seleção e os mesmos gates.
- `[!]` Navegador: o conector `@Chrome` não estava disponível nesta execução; a evidência equivalente local está registrada no relatório final.
- `[!]` Evidência manual: não marcar individualmente todos os casos apenas por herança de um teste agregado; usar as linhas abaixo para a homologação final por empresa.

## 0 Preparação geral

- [ ] Empresa 1 — abrir o projeto por servidor HTTP, não por `file://`.
- [ ] Empresa 2 — abrir o projeto por servidor HTTP, não por `file://`.
- [ ] Empresa 1 — confirmar que o segredo local está em `.env.local`, ignorado pelo Git e não aparece em logs, capturas ou exports.
- [ ] Empresa 2 — confirmar o mesmo contrato de segredo e isolamento.
- [ ] Empresa 1 — confirmar que o botão/aba da empresa altera somente dados, métricas e mensagens da Empresa 1.
- [ ] Empresa 2 — confirmar que o botão/aba da empresa altera somente dados, métricas e mensagens da Empresa 2.
- [ ] Empresa 1 — registrar commit, data, navegador, resolução e comando de validação.
- [ ] Empresa 2 — registrar commit, data, navegador, resolução e comando de validação.
- [ ] Global — executar `npm run lint`.
- [ ] Global — executar `npm run format:check`.
- [ ] Global — executar `ruff check .`.
- [ ] Global — executar `ruff format --check .`.
- [ ] Global — executar `python tests/run_all_tests.py`.
- [ ] Global — confirmar `git diff --check` e working tree limpo após os testes.

## 1 Portal e seleção de empresa

Controles: abas `[data-company="empresa1"]`, `[data-company="empresa2"]`,
`#selectEmpresa1`, `#selectEmpresa2` e navegação para diagnóstico, cenários e
entrega.

- [ ] Empresa 1 — carregar o portal inicial.
- [ ] Empresa 2 — carregar o portal inicial.
- [ ] Empresa 1 — clicar em `Abrir Empresa 1`.
- [ ] Empresa 2 — clicar em `Abrir Empresa 2`.
- [ ] Empresa 1 — selecionar a aba da Empresa 1 no cabeçalho.
- [ ] Empresa 2 — selecionar a aba da Empresa 2 no cabeçalho.
- [ ] Empresa 1 — navegar para `Diagnóstico & Baseline`.
- [ ] Empresa 2 — navegar para `Diagnóstico & Baseline`.
- [ ] Empresa 1 — navegar para `Cenários & Otimização`.
- [ ] Empresa 2 — navegar para `Cenários & Otimização`.
- [ ] Empresa 1 — navegar para `Decisão & Entrega`.
- [ ] Empresa 2 — navegar para `Decisão & Entrega`.
- [ ] Empresa 1 — confirmar que a empresa selecionada permanece correta ao trocar de fase.
- [ ] Empresa 2 — confirmar que a empresa selecionada permanece correta ao trocar de fase.
- [ ] Empresa 1 — confirmar que não há dados ou cenário salvo da Empresa 2 misturado na tela.
- [ ] Empresa 2 — confirmar que não há dados ou cenário salvo da Empresa 1 misturado na tela.

## 2 Fase 1 Diagnóstico e validação de dados

### Funcionalidades e botões

- [ ] Empresa 1 — carregar dados públicos e bundle protegido.
- [ ] Empresa 2 — carregar dados públicos e bundle protegido.
- [ ] Empresa 1 — confirmar painel de qualidade, score, erros e warnings.
- [ ] Empresa 2 — confirmar painel de qualidade, score, erros e warnings.
- [ ] Empresa 1 — clicar em `#runLivePathCheck` e confirmar auditoria de paths.
- [ ] Empresa 2 — clicar em `#runLivePathCheck` e confirmar auditoria de paths.
- [ ] Empresa 1 — abrir/fechar `#toggleSheetTable` e conferir inventário de abas.
- [ ] Empresa 2 — abrir/fechar `#toggleSheetTable` e conferir inventário de abas.
- [ ] Empresa 1 — conferir tabela técnica de datasets.
- [ ] Empresa 2 — conferir tabela técnica de datasets.
- [ ] Empresa 1 — clicar em `#rerunPhase1Checks` e confirmar reexecução dos testes.
- [ ] Empresa 2 — clicar em `#rerunPhase1Checks` e confirmar reexecução dos testes.
- [ ] Empresa 1 — marcar cada item da checklist manual.
- [ ] Empresa 2 — marcar cada item da checklist manual.
- [ ] Empresa 1 — clicar em `#clearManualChecklist` e confirmar limpeza apenas da Empresa 1.
- [ ] Empresa 2 — clicar em `#clearManualChecklist` e confirmar limpeza apenas da Empresa 2.
- [ ] Empresa 1 — conferir tabela de amostra de fluxos.
- [ ] Empresa 2 — conferir tabela de amostra de fluxos.
- [ ] Empresa 1 — conferir evidência bruta, arquivos core e caminhos relativos.
- [ ] Empresa 2 — conferir evidência bruta, arquivos core e caminhos relativos.
- [ ] Empresa 1 — verificar nós, arestas, produtos, demanda, custos, estoque e fontes.
- [ ] Empresa 2 — verificar nós, arestas, produtos, demanda, custos, estoque, tributos e fontes.
- [ ] Empresa 1 — confirmar isolamento dos dados protegidos.
- [ ] Empresa 2 — confirmar isolamento dos dados protegidos.

### Critérios de aceitação da Fase 1

- [ ] Empresa 1 — zero path obrigatório ausente.
- [ ] Empresa 2 — zero path obrigatório ausente.
- [ ] Empresa 1 — zero erro de carregamento silencioso.
- [ ] Empresa 2 — zero erro de carregamento silencioso.
- [ ] Empresa 1 — três linhas inválidas da demanda aparecem como descartadas, não como demanda operacional.
- [ ] Empresa 2 — cabeçalhos, separadores, totais e placeholders não são tratados como transações.
- [ ] Empresa 1 — a limitação de benchmark histórico aparece visível.
- [ ] Empresa 2 — a cobertura e as limitações das tabelas tributárias aparecem visíveis.

## 3 Fase 2 Baseline e paridade

### Funcionalidades e elementos

- [ ] Empresa 1 — conferir resumo executivo do baseline.
- [ ] Empresa 2 — conferir resumo executivo do baseline.
- [ ] Empresa 1 — conferir custos de transferência, distribuição, armazenagem, estoque e tributo.
- [ ] Empresa 2 — conferir custos de transferência, distribuição, armazenagem, estoque e tributo.
- [ ] Empresa 1 — conferir tabela de fluxos e agregações por UF/CD.
- [ ] Empresa 2 — conferir tabela de fluxos e agregações por UF/CD.
- [ ] Empresa 1 — conferir warnings de proxy de transferência e tributação.
- [ ] Empresa 2 — conferir warnings de peso ausente, CIF, transferência e armazenagem.
- [ ] Empresa 1 — conferir `Base Fit Score`, erros e status de calibração.
- [ ] Empresa 2 — conferir `Base Fit Score`, erros e status de calibração.
- [ ] Empresa 1 — conferir tabela de paridade/reconciliação quando houver referência.
- [ ] Empresa 2 — conferir tabela de paridade/reconciliação quando houver referência.
- [ ] Empresa 1 — conferir painel de calibração.
- [ ] Empresa 2 — conferir painel de calibração.
- [ ] Empresa 1 — executar `Phase2TestPanel` no navegador.
- [ ] Empresa 2 — executar `Phase2TestPanel` no navegador.
- [ ] Empresa 1 — validar `TaxEngineBasic` como resumo, não como cálculo independente.
- [ ] Empresa 2 — validar `TaxEngineBasic` como resumo, não como cálculo independente.

### Invariantes do baseline

- [ ] Empresa 1 — `total_logistics_cost` fecha com todos os componentes logísticos.
- [ ] Empresa 2 — `total_logistics_cost` fecha com todos os componentes logísticos.
- [ ] Empresa 1 — `total_with_tax` fecha com logística mais impacto tributário.
- [ ] Empresa 2 — `total_with_tax` fecha com logística mais impacto tributário.
- [ ] Empresa 1 — baseline reproduz o bundle canônico quando o cenário é o baseline.
- [ ] Empresa 2 — baseline reproduz o bundle canônico quando o cenário é o baseline.
- [ ] Empresa 1 — demanda canônica é 60.308 linhas após exclusão das três linhas inválidas.
- [ ] Empresa 2 — os cenários e totais usados são os do workbook canônico.
- [ ] Empresa 1 — proxy cross-company não é apresentado como tarifa histórica própria.
- [ ] Empresa 2 — fluxos fábrica → CD não são precificados como distribuição CIF.

## 4 Fase 3 Cenários e simulação

### Construção do cenário

- [ ] Empresa 1 — preencher `#scenarioName`.
- [ ] Empresa 2 — preencher `#scenarioName`.
- [ ] Empresa 1 — selecionar um ou mais CDs em `#cdSelector`.
- [ ] Empresa 2 — selecionar um ou mais CDs em `#cdSelector`.
- [ ] Empresa 1 — alterar `#freightMultiplier`.
- [ ] Empresa 2 — alterar `#freightMultiplier`.
- [ ] Empresa 1 — alterar `#demandMultiplier`.
- [ ] Empresa 2 — alterar `#demandMultiplier`.
- [ ] Empresa 1 — alterar `#inventoryDays`.
- [ ] Empresa 2 — alterar `#inventoryDays`.
- [ ] Empresa 1 — alterar `#waccValue`.
- [ ] Empresa 2 — alterar `#waccValue`.
- [ ] Empresa 1 — selecionar regime em `#taxMode`.
- [ ] Empresa 2 — selecionar regime em `#taxMode`.
- [ ] Empresa 1 — selecionar regra de realocação em `#reallocationRule`.
- [ ] Empresa 2 — selecionar regra de realocação em `#reallocationRule`.
- [ ] Empresa 1 — clicar em `#simulateScenario`.
- [ ] Empresa 2 — clicar em `#simulateScenario`.
- [ ] Empresa 1 — validar mensagem de cenário válido ou inválido.
- [ ] Empresa 2 — validar mensagem de cenário válido ou inválido.
- [ ] Empresa 1 — conferir explicação das mudanças e dos custos.
- [ ] Empresa 2 — conferir explicação das mudanças e dos custos.
- [ ] Empresa 1 — conferir tabela executiva, comparação com baseline e saving.
- [ ] Empresa 2 — conferir tabela executiva, comparação com baseline e saving.
- [ ] Empresa 1 — conferir tabela de fluxos reconstruídos e realocações.
- [ ] Empresa 2 — conferir tabela de fluxos reconstruídos e realocações.
- [ ] Empresa 1 — testar cenário sem CD ativo e confirmar bloqueio.
- [ ] Empresa 2 — testar cenário sem CD ativo e confirmar bloqueio.
- [ ] Empresa 1 — testar multiplicador inválido e confirmar bloqueio.
- [ ] Empresa 2 — testar multiplicador inválido e confirmar bloqueio.

### Persistência e intercâmbio

- [ ] Empresa 1 — clicar em `#saveScenario`.
- [ ] Empresa 2 — clicar em `#saveScenario`.
- [ ] Empresa 1 — confirmar cenário salvo na biblioteca.
- [ ] Empresa 2 — confirmar cenário salvo na biblioteca.
- [ ] Empresa 1 — clicar em `#clearSavedScenarios` e confirmar que somente os salvos da Empresa 1 são removidos.
- [ ] Empresa 2 — clicar em `#clearSavedScenarios` e confirmar que somente os salvos da Empresa 2 são removidos.
- [ ] Empresa 1 — clicar em `#exportScenario` e abrir o JSON exportado.
- [ ] Empresa 2 — clicar em `#exportScenario` e abrir o JSON exportado.
- [ ] Empresa 1 — importar JSON em `#importScenarioFile`.
- [ ] Empresa 2 — importar JSON em `#importScenarioFile`.
- [ ] Empresa 1 — tentar importar cenário da Empresa 2 e confirmar rejeição.
- [ ] Empresa 2 — tentar importar cenário da Empresa 1 e confirmar rejeição.

## 5 Fase 3 Monte Carlo e incerteza

- [ ] Empresa 1 — informar iterações em `#phase3MonteCarloIterations`.
- [ ] Empresa 2 — informar iterações em `#phase3MonteCarloIterations`.
- [ ] Empresa 1 — informar seed em `#phase3MonteCarloSeed`.
- [ ] Empresa 2 — informar seed em `#phase3MonteCarloSeed`.
- [ ] Empresa 1 — testar perfil em `#phase3MonteCarloProfile`.
- [ ] Empresa 2 — testar perfil em `#phase3MonteCarloProfile`.
- [ ] Empresa 1 — testar driver em `#phase3MonteCarloDriver`.
- [ ] Empresa 2 — testar driver em `#phase3MonteCarloDriver`.
- [ ] Empresa 1 — clicar em `#runMonteCarloScenario`.
- [ ] Empresa 2 — clicar em `#runMonteCarloScenario`.
- [ ] Empresa 1 — confirmar seed efetiva, algoritmo RNG e reprodutibilidade.
- [ ] Empresa 2 — confirmar bloqueio quando a cobertura fiscal não sustentar a distribuição.
- [ ] Empresa 1 — conferir p10, p50, p90, média, desvio, histograma e CDF.
- [ ] Empresa 2 — conferir mensagem de bloqueio e motivo da insuficiência de dados.
- [ ] Empresa 1 — conferir correlação e driver mais sensível.
- [ ] Empresa 2 — conferir que nenhum resultado bloqueado é tratado como número oficial.
- [ ] Empresa 1 — confirmar `forecast: false`.
- [ ] Empresa 2 — confirmar `forecast: false`.
- [ ] Empresa 1 — confirmar que a probabilidade é condicional às premissas/proxies.
- [ ] Empresa 2 — confirmar a mesma ressalva quando o cenário for permitido.
- [ ] Empresa 1 — repetir com a mesma seed e confirmar resultado idêntico.
- [ ] Empresa 2 — repetir com a mesma seed e confirmar resultado idêntico quando executável.
- [ ] Empresa 1 — testar histórico customizado somente com proveniência completa.
- [ ] Empresa 2 — testar histórico customizado somente com proveniência completa.

## 6 Fase 4 Score e otimização

### Objetivo e restrições

- [ ] Empresa 1 — preencher `#objectiveName`.
- [ ] Empresa 2 — preencher `#objectiveName`.
- [ ] Empresa 1 — configurar `#weight_total_cost`.
- [ ] Empresa 2 — configurar `#weight_total_cost`.
- [ ] Empresa 1 — configurar `#weight_service_quality`.
- [ ] Empresa 2 — configurar `#weight_service_quality`.
- [ ] Empresa 1 — configurar `#weight_operational_risk`.
- [ ] Empresa 2 — configurar `#weight_operational_risk`.
- [ ] Empresa 1 — configurar `#weight_tax_impact`.
- [ ] Empresa 2 — configurar `#weight_tax_impact`.
- [ ] Empresa 1 — configurar `#weight_inventory_efficiency`.
- [ ] Empresa 2 — configurar `#weight_inventory_efficiency`.
- [ ] Empresa 1 — validar pesos negativos, desconhecidos e soma zero.
- [ ] Empresa 2 — validar pesos negativos, desconhecidos e soma zero.
- [ ] Empresa 1 — configurar `#minActiveCds` e `#maxActiveCds`.
- [ ] Empresa 2 — configurar `#minActiveCds` e `#maxActiveCds`.
- [ ] Empresa 1 — configurar `#maxCdShare`.
- [ ] Empresa 2 — configurar `#maxCdShare`.
- [ ] Empresa 1 — configurar `#maxRiskLevel`.
- [ ] Empresa 2 — configurar `#maxRiskLevel`.
- [ ] Empresa 1 — conferir política tributária em `#optimizationTaxMode`.
- [ ] Empresa 2 — conferir política tributária em `#optimizationTaxMode`.
- [ ] Empresa 1 — conferir `#allowTaxDisabled` desabilitado quando aplicável.
- [ ] Empresa 2 — conferir `#allowTaxDisabled` desabilitado quando aplicável.

### Busca, ranking e explicabilidade

- [ ] Empresa 1 — escolher `#optimizerMethod`.
- [ ] Empresa 2 — escolher `#optimizerMethod`.
- [ ] Empresa 1 — configurar `#maxCandidates`.
- [ ] Empresa 2 — configurar `#maxCandidates`.
- [ ] Empresa 1 — configurar `#optimizerSeed`.
- [ ] Empresa 2 — configurar `#optimizerSeed`.
- [ ] Empresa 1 — clicar em `#runOptimizer`.
- [ ] Empresa 2 — clicar em `#runOptimizer`.
- [ ] Empresa 1 — conferir candidatos gerados, simulados, válidos e inválidos.
- [ ] Empresa 2 — conferir candidatos gerados, simulados, válidos e inválidos.
- [ ] Empresa 1 — conferir `exact_search_space`, cobertura e limite de candidatos.
- [ ] Empresa 2 — conferir `exact_search_space`, cobertura e limite de candidatos.
- [ ] Empresa 1 — conferir ranking e score ponderado.
- [ ] Empresa 2 — conferir ranking e score ponderado.
- [ ] Empresa 1 — conferir explicação do vencedor.
- [ ] Empresa 2 — conferir explicação do vencedor.
- [ ] Empresa 1 — conferir fronteira de trade-off.
- [ ] Empresa 2 — conferir fronteira de trade-off.
- [ ] Empresa 1 — repetir a busca com a mesma seed e confirmar ranking idêntico.
- [ ] Empresa 2 — repetir a busca com a mesma seed e confirmar ranking idêntico.
- [ ] Empresa 1 — rodar os seis perfis de pesos e registrar vencedor/frequência.
- [ ] Empresa 2 — rodar os seis perfis de pesos e registrar vencedor/frequência.
- [ ] Empresa 1 — confirmar alerta se o vencedor mudar entre perfis.
- [ ] Empresa 2 — confirmar alerta se o vencedor mudar entre perfis.
- [ ] Empresa 1 — não chamar o resultado de ótimo global quando a busca for parcial.
- [ ] Empresa 2 — não chamar o resultado de ótimo global quando a busca for parcial.
- [ ] Empresa 2 — confirmar bloqueio quando a cobertura fiscal não sustentar a otimização.

## 7 Fase 5 Decisão e entrega

### Seleção e reexecução

- [ ] Empresa 1 — escolher modo em `#phase5SelectionMode`.
- [ ] Empresa 2 — escolher modo em `#phase5SelectionMode`.
- [ ] Empresa 1 — testar seleção automática, por score, custo e robustez.
- [ ] Empresa 2 — testar seleção automática, por score, custo e robustez.
- [ ] Empresa 1 — testar seleção manual em `#phase5ManualScenarioId`.
- [ ] Empresa 2 — testar seleção manual em `#phase5ManualScenarioId`.
- [ ] Empresa 1 — configurar `#phase5StressProfile`.
- [ ] Empresa 2 — configurar `#phase5StressProfile`.
- [ ] Empresa 1 — configurar `#phase5SensitivityVariable`.
- [ ] Empresa 2 — configurar `#phase5SensitivityVariable`.
- [ ] Empresa 1 — configurar `#phase5SensitivityX` e `#phase5SensitivityY`.
- [ ] Empresa 2 — configurar `#phase5SensitivityX` e `#phase5SensitivityY`.
- [ ] Empresa 1 — configurar `#phase5MaxCandidates`.
- [ ] Empresa 2 — configurar `#phase5MaxCandidates`.
- [ ] Empresa 1 — clicar em `#rerunPhase5`.
- [ ] Empresa 2 — clicar em `#rerunPhase5`.

### Resultado final

- [ ] Empresa 1 — conferir situação final e cenário selecionado.
- [ ] Empresa 2 — conferir situação final e cenário selecionado.
- [ ] Empresa 1 — conferir períodos tributários e origem dos parâmetros.
- [ ] Empresa 2 — conferir períodos tributários e origem dos parâmetros.
- [ ] Empresa 1 — conferir stress test e gráfico `#stressChart`.
- [ ] Empresa 2 — conferir stress test e gráfico `#stressChart`.
- [ ] Empresa 1 — conferir tabela de stress em `#stressPanel`.
- [ ] Empresa 2 — conferir tabela de stress em `#stressPanel`.
- [ ] Empresa 1 — conferir sensibilidade e gráfico `#sensitivityChart`.
- [ ] Empresa 2 — conferir sensibilidade e gráfico `#sensitivityChart`.
- [ ] Empresa 1 — conferir matriz de sensibilidade em `#sensitivityMatrixPanel`.
- [ ] Empresa 2 — conferir matriz de sensibilidade em `#sensitivityMatrixPanel`.
- [ ] Empresa 1 — conferir recomendação, robustez, riscos e ressalvas.
- [ ] Empresa 2 — conferir recomendação, robustez, riscos e ressalvas.
- [ ] Empresa 1 — confirmar que recomendação limpa exige saving positivo, risco controlado, robustez, evidência e estabilidade.
- [ ] Empresa 2 — confirmar que recomendação limpa exige saving positivo, risco controlado, robustez, evidência e estabilidade.
- [ ] Empresa 1 — conferir bloqueadores de evidência.
- [ ] Empresa 2 — conferir bloqueadores de evidência.
- [ ] Empresa 1 — conferir auditoria e trilha de fontes/premissas.
- [ ] Empresa 2 — conferir auditoria e trilha de fontes/premissas.

### Exportação

- [ ] Empresa 1 — exportar pacote JSON completo.
- [ ] Empresa 2 — exportar pacote JSON completo.
- [ ] Empresa 1 — exportar cenários CSV.
- [ ] Empresa 2 — exportar cenários CSV.
- [ ] Empresa 1 — exportar resultados de stress CSV.
- [ ] Empresa 2 — exportar resultados de stress CSV.
- [ ] Empresa 1 — exportar resultados de sensibilidade CSV.
- [ ] Empresa 2 — exportar resultados de sensibilidade CSV.
- [ ] Empresa 1 — exportar HTML do relatório executivo.
- [ ] Empresa 2 — exportar HTML do relatório executivo.
- [ ] Empresa 1 — abrir cada export e conferir empresa, cenário, baseline, seed e versão.
- [ ] Empresa 2 — abrir cada export e conferir empresa, cenário, baseline, seed e versão.
- [ ] Empresa 1 — confirmar que nenhum export contém segredo local.
- [ ] Empresa 2 — confirmar que nenhum export contém segredo local.

## 8 Área de debug

- [ ] Empresa 1 — abrir `debug/index.html` por HTTP.
- [ ] Empresa 2 — abrir `debug/index.html` por HTTP.
- [ ] Empresa 1 — conferir tabela de módulos.
- [ ] Empresa 2 — conferir tabela de módulos.
- [ ] Empresa 1 — conferir tabela de paths.
- [ ] Empresa 2 — conferir tabela de paths.
- [ ] Empresa 1 — conferir eventos e erros registrados.
- [ ] Empresa 2 — conferir eventos e erros registrados.
- [ ] Empresa 1 — confirmar ausência de falha crítica de carregamento.
- [ ] Empresa 2 — confirmar ausência de falha crítica de carregamento.

## 9 Checklist técnico automatizado final

- [ ] Global — `PACKAGE_CHECK_OK`.
- [ ] Global — `FULL_WORKBOOK_PATH_AUDIT_OK`.
- [ ] Global — `FINAL_DEEP_AUDIT_OK`.
- [ ] Global — `MODULE_CONTRACT_DOCUMENTATION_OK`.
- [ ] Global — `PHASE2_DATA_CONTRACTS_OK`.
- [ ] Global — `PHASE2_RECONCILIATION_OK`.
- [ ] Global — `PHASE2_COMPLEMENTS_OK`.
- [ ] Global — `PHASE3_CONTRACTS_OK`.
- [ ] Global — `PHASE3_LOGIC_OK`.
- [ ] Global — `PHASE4_SCORING_LOGIC_OK`.
- [ ] Global — `PHASE4_OPTIMIZER_LOGIC_OK`.
- [ ] Global — `PHASE5_STRESS_LOGIC_OK`.
- [ ] Global — `PHASE5_RECOMMENDATION_LOGIC_OK`.
- [ ] Global — `PHASE5_AUDIT_EXPORT_OK`.
- [ ] Global — `PHASE5_FINAL_QA_OK`.
- [ ] Global — `PROTECTED_DATA_INTEGRITY_OK`.
- [ ] Global — `MODEL_INVARIANTS_OK`.
- [ ] Global — `EVIDENCE_UNCERTAINTY_CONTRACTS_OK`.
- [ ] Global — `PRESENTATION_E2E_OK`.
- [ ] Global — `REGRESSION_E2E_OK`.
- [ ] Global — `ALL_PHASE5_PACKAGE_TESTS_OK`.

## 10 Ressalvas que devem ser registradas na entrega

- [ ] Empresa 1 — registrar que a transferência usa proxy cross-company calibrado a partir da Empresa 2.
- [ ] Empresa 1 — registrar que a armazenagem por quantidade de CDs usa hipótese de engenharia quando não há tarifa por CD.
- [ ] Empresa 1 — registrar que a cobertura tributária específica e o benchmark histórico independente são limitados.
- [ ] Empresa 2 — registrar a dependência financeira dos fallbacks de peso/receita.
- [ ] Empresa 2 — registrar que fluxos fábrica → CD e distribuição CD → destino têm tratamentos diferentes.
- [ ] Empresa 2 — registrar que os cenários 2 e N exigem adaptador de participação para reprodução like-for-like.
- [ ] Empresa 1 — registrar que Monte Carlo é exploratório e condicional às premissas/proxies.
- [ ] Empresa 2 — registrar que Monte Carlo/otimização podem ser bloqueados por qualidade fiscal.
- [ ] Global — registrar que reconciliação não equivale a validação fiscal oficial.
- [ ] Global — registrar commit e relatório de validação junto à versão entregue.

## 11 Evidências anexadas

- [ ] Capturas desktop da home, baseline, cenário, otimizador e entrega para Empresa 1.
- [ ] Capturas desktop da home, baseline, cenário, otimizador e entrega para Empresa 2.
- [ ] Capturas mobile das mesmas jornadas para Empresa 1.
- [ ] Capturas mobile das mesmas jornadas para Empresa 2.
- [ ] JSON exportado de cenário para cada empresa.
- [ ] CSV de ranking, stress e sensibilidade para cada empresa.
- [ ] HTML do relatório executivo para cada empresa.
- [ ] Log completo de `python tests/run_all_tests.py`.
- [ ] Registro do commit entregue.
- [ ] Registro de limitações conhecidas e decisões metodológicas.
