# Módulos implementados na Fase 3

| Módulo | Arquivo | Função principal |
|---|---|---|
| ScenarioLibrary | `assets/js/phase3/scenario-library.js` | carrega baseline, cenários exemplo e salvos |
| ScenarioBuilder | `assets/js/phase3/scenario-builder.js` | cria objeto de cenário manual |
| ScenarioValidator | `assets/js/phase3/scenario-validator.js` | bloqueia cenários inválidos |
| ScenarioFlowRebuilder | `assets/js/phase3/scenario-flow-rebuilder.js` | realoca fluxos após fechamento de CD |
| ScenarioSimulator | `assets/js/phase3/scenario-simulator.js` | recalcula custos e tributo básico |
| ScenarioComparator | `assets/js/phase3/scenario-comparator.js` | compara contra baseline |
| ScenarioQualityCheck | `assets/js/phase3/scenario-quality-check.js` | calcula qualidade e risco |
| ScenarioChangeExplainer | `assets/js/phase3/scenario-change-explainer.js` | explica o que mudou |
| ScenarioPersistence | `assets/js/phase3/scenario-persistence.js` | salva/carrega cenários no localStorage |
| ScenarioImportExport | `assets/js/phase3/scenario-import-export.js` | importa/exporta JSON |
| ScenarioArenaDashboard | `assets/js/phase3/scenario-arena-dashboard.js` | renderiza a interface |
| Phase3TestPanel | `assets/js/phase3/phase3-tests.js` | roda testes no navegador |

Cada módulo também aparece em `data/contracts/module_contracts_all_phases.json`.
