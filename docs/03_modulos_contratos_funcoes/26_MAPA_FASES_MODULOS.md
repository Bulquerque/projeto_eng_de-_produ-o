# Mapa de fases, módulos e entregas

Este documento mostra a arquitetura em 5 fases e quais módulos pertencem a cada uma.


# Fase 1 — Fundação do site, separação das empresas, carregamento de dados e validação inicial.

| Módulo | Status | Página | Responsabilidade |
|---|---|---|---|
| AppBootstrap | implemented_phase_1 | / e /fase-1-validacao/ | Inicializa o site estático, carrega os artefatos mínimos da Fase 1 e dispara a primeira renderização segura da interface. |
| DataLoader | implemented_phase_1 | global | Centraliza a leitura dos arquivos estáticos JSON/CSV usados pela interface. É o módulo que garante que os dados vêm dos caminhos relativos corretos. |
| CompanySelector | implemented_phase_1 | / e /fase-1-validacao/ | Permite alternar entre Empresa 1 e Empresa 2 mantendo isolamento total de datasets, indicadores e mensagens. |
| DatasetPanel | implemented_phase_1 | / e /fase-1-validacao/ | Mostra os datasets core e arquivos brutos vinculados à empresa selecionada, com caminhos relativos visíveis para auditoria manual. |
| DataQualityPanel | implemented_phase_1 | / e /fase-1-validacao/ | Exibe score de qualidade, contagens, warnings e erros já apurados na preparação dos dados. |
| PathAuditPanel | implemented_phase_1 | / e /fase-1-validacao/ | Mostra a auditoria dos caminhos do pacote: quantidade checada, faltantes, abas auditadas e arquivos core obrigatórios. |
| WorkbookInventoryPanel | implemented_phase_1 | / e /fase-1-validacao/ | Mostra o inventário de abas dos workbooks, especialmente para provar que as abas da Empresa 2 foram exportadas e mapeadas. |
| ManualChecklist | implemented_phase_1 | / e /fase-1-validacao/ | Permite ao usuário marcar manualmente validações da Fase 1 e salvar o progresso no navegador. |
| Phase1TestPanel | implemented_phase_1 | / e /fase-1-validacao/ | Mostra no navegador os testes automáticos básicos da Fase 1, permitindo checagem rápida sem terminal. |

# Fase 2 — Construção do cenário base, cálculo de custos/tributos e paridade com a realidade.

| Módulo | Status | Página | Responsabilidade |
|---|---|---|---|
| BaselineBuilder | planned_phase_2 | /fase-2-baseline | Reconstrói o cenário atual de cada empresa a partir dos dados core, gerando a estrutura AS-IS que será usada como comparação oficial. |
| FlowBuilder | planned_phase_2 | /fase-2-baseline | Normaliza os fluxos logísticos usados por custo, serviço, cenário e comparação. |
| CostEngine | planned_phase_2 | /fase-2-baseline e /fase-3-cenarios | Calcula as parcelas de custo logístico: transferência, distribuição, armazenagem, estoque e total. |
| TaxEngine | planned_phase_2 | /fase-2-baseline e /fase-3-cenarios | Calcula camada tributária parametrizada, sem assumir regra fiscal hardcoded não validada. Deve suportar regime atual, sem efeito tributário e horizonte de reforma quando os dados existirem. |
| BaseFitScore | planned_phase_2 | /fase-2-baseline | Mede a paridade entre resultado simulado e cenário real/base. Essa é a prova de que o simulador replica a realidade antes de simular futuro. |
| CalibrationPanel | planned_phase_2 | /fase-2-baseline | Mostra visualmente paridade, erros por componente e pontos que precisam de calibração. |

# Fase 3 — Criação manual de cenários, validação, comparação e qualidade operacional.

| Módulo | Status | Página | Responsabilidade |
|---|---|---|---|
| ScenarioBuilder | planned_phase_3 | /fase-3-cenarios | Permite criar cenários manuais a partir do baseline, mudando CDs ativos, alocação, frete, estoque, demanda, modo tributário e outras premissas controladas. |
| ScenarioValidator | planned_phase_3 | /fase-3-cenarios | Bloqueia ou alerta cenários impossíveis: sem CD ativo, demanda sem atendimento, capacidade estourada, distância ausente ou empresa misturada. |
| ScenarioComparator | planned_phase_3 | /fase-3-cenarios | Compara múltiplos cenários da mesma empresa contra o baseline correto, mostrando custo, saving, serviço, risco e tributo. |
| ScenarioQualityCheck | planned_phase_3 | /fase-3-cenarios e /fase-4-score-otimizador | Avalia plausibilidade operacional do cenário, separando cenário barato de cenário realmente executável. |
| ScenarioPersistence | planned_phase_3 | /fase-3-cenarios | Salva cenários criados pelo usuário no navegador e permite exportar/importar JSON de cenário. |

# Fase 4 — Função objetivo customizada, score, restrições e otimização exata discreta.

| Módulo | Status | Página | Responsabilidade |
|---|---|---|---|
| ObjectiveBuilder | planned_phase_4 | /fase-4-score-otimizador | Permite ao usuário criar sua própria função objetivo com pesos de custo, serviço, risco, tributo e estoque. |
| ScenarioScoring | planned_phase_4 | /fase-4-score-otimizador | Normaliza métricas heterogêneas e calcula o score final de cada cenário conforme função objetivo escolhida. |
| ConstraintEngine | planned_phase_4 | /fase-4-score-otimizador | Define e valida restrições usadas pelo otimizador: mínimo/máximo de CDs, capacidade, concentração, cobertura e lead time. |
| ScenarioOptimizer | planned_phase_4 | /fase-4-score-otimizador | Enumera o espaço discreto modelado, aplica restrições, calcula score e retorna o melhor cenário viável com desempate determinístico. |
| SearchLogPanel | planned_phase_4 | /fase-4-score-otimizador | Mostra rastreabilidade da busca: método, seed, candidatos testados, rejeições e top cenários. |

# Fase 5 — Stress test, explicabilidade, auditoria, exportação e relatório executivo.

| Módulo | Status | Página | Responsabilidade |
|---|---|---|---|
| StressTestEngine | planned_phase_5 | /fase-5-entrega-final | Aplica choques de frete, demanda, WACC, armazenagem, capacidade e tributo para testar robustez do cenário. |
| ExplainabilityEngine | planned_phase_5 | /fase-5-entrega-final | Gera explicações textuais simples e auditáveis sobre por que um cenário ganhou, perdeu ou ficou arriscado. |
| AuditTrail | planned_phase_5 | /fase-5-entrega-final e global | Registra dados, premissas, versão do modelo, cenário, objetivo e resultados para cada simulação exportável. |
| ExecutiveReport | planned_phase_5 | /fase-5-entrega-final | Monta relatório executivo do cenário: resumo, comparação, saving, riscos, stress, premissas e recomendação defendível. |
| ExportEngine | planned_phase_5 | /fase-5-entrega-final | Exporta resultados, cenários, auditoria e relatórios em formatos simples para entrega ou reuso. |
| RecommendationPanel | planned_phase_5 | /fase-5-entrega-final | Apresenta recomendação final com ressalvas: melhor cenário por objetivo, robustez, riscos e próximos passos. |
