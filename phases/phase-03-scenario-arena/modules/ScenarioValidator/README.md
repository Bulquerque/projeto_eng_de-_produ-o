# ScenarioValidator

## Papel

Valida a estrutura do cenário antes de chamar o simulador. Confere o vínculo com a empresa e o baseline carregados, a existência e o conhecimento dos CDs ativos, parâmetros numéricos e regras tributárias/de realocação.

Esta etapa **não** verifica capacidade operacional, cobertura real da demanda ou disponibilidade de distâncias. Esses resultados dependem dos fluxos produzidos pelo simulador e aparecem na avaliação de qualidade.

## Interface

Arquivo: `assets/js/phase3/scenario-validator.js`.

```js
validateScenario({ companyId, scenario, baselineBundle })
```

A função retorna `scenario_id`, `valid`, `severity`, `errors`, `warnings`, `checks` e `validation_summary`. Os códigos de check estão relacionados em [`contract.json`](contract.json).

Exemplo da forma do resumo:

```json
{
  "active_cds_count": 2,
  "closed_cds_count": 1,
  "requires_reallocation": true
}
```

## Avisos

- Cenários que fecham um ou mais CDs recebem o aviso `REALLOCATION_REQUIRED`.
- Cenários com um único CD ativo recebem `SINGLE_CD_CONCENTRATION`.

Avisos não tornam o cenário inválido. Erros estruturais impedem que o dashboard execute a simulação.

## Dependências e testes

O módulo reutiliza `core/tax-reform-config.js` e `core/cd-utils.js`; não chama o painel de qualidade nem o simulador. Os testes de validação estão em `tests/06_fase3_cenarios/test_phase3_logic.py` e na auditoria de regressão `tests/11_regression_e2e/regression_logic_audit.mjs`. O fluxo de apresentação é exercitado em `tests/10_presentation_e2e/test_presentation_flow_playwright.py`.
