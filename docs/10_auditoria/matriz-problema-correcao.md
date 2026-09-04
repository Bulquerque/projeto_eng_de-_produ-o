# Matriz problema → correção → teste → evidência

| Problema | Correção mínima | Teste/regressão | Evidência |
|---|---|---|---|
| Monte Carlo descrito como determinístico | Documentação do núcleo determinístico e da camada probabilística; seed, iterações, limites e drivers expostos | `tests/06_fase3_cenarios/test_phase3_logic.py`; prova-bala | `data/validation/prova_bala_evidence/logic_report.json` |
| Driver sorteado sem efeito | Correção do fluxo de baseline e validação de mudanças por driver | testes de lógica Monte Carlo | relatório de prova-bala |
| Tarifa da Empresa 1 usa dados da Empresa 2 | Proxy explicitada, centralizada e acompanhada de cobertura/sensibilidade | `test_phase3_assumptions_logic.py`; prova-bala | `fallback_usage` e sensitivity |
| Distâncias não encontradas | Fallback de distribuição mantido e identificado; nenhuma distância inventada | contratos e auditoria de cobertura | cobertura de 36 fluxos |
| Estoque não varia com CDs | Modo `days_wacc_only`; sem pooling não implementado | teste de invariância de CDs | `inventory_calculation_mode` e warning |
| Fallbacks espalhados | Catálogo em `assets/js/shared/model-assumptions.js` | testes de premissas | `assumption_catalog` |
| Aliases tributários confundidos com motores distintos | `shared/tax` documentado como fonte canônica; três arquivos mortos removidos e aliases de compatibilidade necessários preservados | `test_tax_aliases_and_regimes.py` | contratos tributários |
| Baseline fiscal incompatível | Comparação canônica no mesmo regime tributário | testes do otimizador e comparador | `comparison_baseline` |
| Status de reconciliação inconsistente | Régua única: aligned/tolerable/divergent | testes de reconciliação | `reconciliation-engine.js` |
| Tabela 7 sem compatibilidade aritmética | Valores extraídos da execução canônica, com baseline e saving explícitos | testes de baseline/cenários | `resultados-canonicos.md` |
| Score, risco e robustez sem ressalvas | Pesos, defaults e thresholds catalogados; índices tratados como proxies | testes de score e robustez | auditoria de Fase 4/5 |
| README, configuração e CI incompletos | README, `.env.example`, scripts e workflow revisados | pacote, padrões e CI | `README.md`, `.github/workflows/quality.yml` |
