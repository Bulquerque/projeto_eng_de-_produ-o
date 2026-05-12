# phase-03-scenario-arena

Organização por feature da Fase 3.

- [`Phase3TestPanel`](modules/Phase3TestPanel/README.md) — Executa testes automáticos da Fase 3 na interface.
- [`ScenarioArenaDashboard`](modules/ScenarioArenaDashboard/README.md) — Renderiza a página principal da Fase 3.
- [`ScenarioBuilder`](modules/ScenarioBuilder/README.md) — Permite criar cenários manuais a partir do baseline, mudando CDs ativos, alocação, frete, estoque, demanda, modo tributário e outras premissas controladas.
- [`ScenarioChangeExplainer`](modules/ScenarioChangeExplainer/README.md) — Gera explicação textual do que mudou e por que o cenário ganhou ou perdeu.
- [`ScenarioComparator`](modules/ScenarioComparator/README.md) — Compara múltiplos cenários da mesma empresa contra o baseline correto, mostrando custo, saving, serviço, risco e tributo.
- [`ScenarioFlowRebuilder`](modules/ScenarioFlowRebuilder/README.md) — Reconstrói fluxos quando CDs são fechados e registra realocações.
- [`ScenarioImportExport`](modules/ScenarioImportExport/README.md) — Exporta e importa cenários em JSON.
- [`ScenarioLibrary`](modules/ScenarioLibrary/README.md) — Carrega baseline, cenários exemplo e cenários salvos por empresa.
- [`ScenarioPersistence`](modules/ScenarioPersistence/README.md) — Salva cenários criados pelo usuário no navegador e permite exportar/importar JSON de cenário.
- [`ScenarioQualityCheck`](modules/ScenarioQualityCheck/README.md) — Avalia plausibilidade operacional do cenário, separando cenário barato de cenário realmente executável.
- [`ScenarioSimulator`](modules/ScenarioSimulator/README.md) — Executa cenário validado, recalcula fluxos, custos e tributo básico.
- [`ScenarioValidator`](modules/ScenarioValidator/README.md) — Bloqueia ou alerta cenários impossíveis: sem CD ativo, demanda sem atendimento, capacidade estourada, distância ausente ou empresa misturada.
