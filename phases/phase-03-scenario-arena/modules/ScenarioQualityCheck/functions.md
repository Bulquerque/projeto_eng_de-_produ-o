# Funções internas

- `['calculateConcentrationRisk(scenario)', 'Mede dependência de poucos CDs.']`
- `['calculateCapacityRisk(scenario, constraints)', 'Mede estouro de capacidade.']`
- `['calculateServiceProxy(scenario)', 'Usa distância/lead time proxy.']`
- `['aggregateQualityScore(parts)', 'Agrega qualidade 0-100.']`

# Dependências externas

Recebe resultados depois da simulação; a validação estrutural anterior é orquestrada pelo dashboard e pelo simulador.

- `['ScenarioScoring', 'Entrega qualityScore para ranking.']`
- `['ExplainabilityEngine', 'Entrega alertas para explicação.']`
