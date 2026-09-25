# Funções

| Função | Responsabilidade |
|---|---|
| `validateScenario({ companyId, scenario, baselineBundle })` | Valida a estrutura e o vínculo do cenário antes da simulação e retorna checks, erros, avisos e resumo. |

As validações individuais são registradas pelos códigos descritos em [`contract.json`](contract.json). Capacidade, cobertura da demanda e distâncias não fazem parte desta função; consulte o simulador e a avaliação de qualidade.
