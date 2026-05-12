# phase-05-final-delivery

Organização por feature da Fase 5.

- [`AuditTrail`](modules/AuditTrail/README.md) — Registra dados, premissas, versão do modelo, cenário, objetivo e resultados para cada simulação exportável.
- [`AuditTrailEngine`](modules/AuditTrailEngine/README.md) — Gera trilha de auditoria com fontes, baseline, objetivo e cenário.
- [`ExecutiveReport`](modules/ExecutiveReport/README.md) — Monta relatório executivo do cenário: resumo, comparação, saving, riscos, stress, premissas e recomendação defendível.
- [`ExecutiveReportBuilder`](modules/ExecutiveReportBuilder/README.md) — Gera relatório executivo HTML.
- [`ExplainabilityEngine`](modules/ExplainabilityEngine/README.md) — Gera explicações textuais simples e auditáveis sobre por que um cenário ganhou, perdeu ou ficou arriscado.
- [`ExportCenter`](modules/ExportCenter/README.md) — Prepara exportações JSON, CSV e HTML.
- [`ExportEngine`](modules/ExportEngine/README.md) — Exporta resultados, cenários, auditoria e relatórios em formatos simples para entrega ou reuso.
- [`FinalQAChecker`](modules/FinalQAChecker/README.md) — Executa checagens finais do simulador e isolamento de empresas.
- [`FinalScenarioSelector`](modules/FinalScenarioSelector/README.md) — Seleciona o cenário final por score, custo, robustez ou escolha manual.
- [`Phase5Dashboard`](modules/Phase5Dashboard/README.md) — Renderiza a página final da Fase 5.
- [`Phase5TestPanel`](modules/Phase5TestPanel/README.md) — Executa testes automáticos da Fase 5 no navegador.
- [`RecommendationEngine`](modules/RecommendationEngine/README.md) — Gera recomendação executiva explicável.
- [`RecommendationPanel`](modules/RecommendationPanel/README.md) — Apresenta recomendação final com ressalvas: melhor cenário por objetivo, robustez, riscos e próximos passos.
- [`ReleaseValidator`](modules/ReleaseValidator/README.md) — Define se o release final está pronto ou bloqueado.
- [`RobustnessScorer`](modules/RobustnessScorer/README.md) — Calcula score de robustez a partir de stress test, qualidade e risco.
- [`SensitivityEngine`](modules/SensitivityEngine/README.md) — Varia uma premissa e mede impacto de custo e saving.
- [`StressCaseLibrary`](modules/StressCaseLibrary/README.md) — Fornece casos padrão e conservadores de stress test.
- [`StressTestEngine`](modules/StressTestEngine/README.md) — Aplica choques de frete, demanda, WACC, armazenagem, capacidade e tributo para testar robustez do cenário.
