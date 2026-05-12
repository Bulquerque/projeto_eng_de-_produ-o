# Funções internas

- `['identifyMainDrivers(delta)', 'Escolhe maiores variações.']`
- `['describeTradeoffs(delta, alerts)', 'Gera texto de trade-off.']`
- `['describeStressBehavior(stressResults)', 'Resume robustez.']`
- `['guardAgainstOverclaim(text, evidence)', 'Evita afirmações sem dado.']`

# Dependências externas

- `['ScenarioComparator', 'Recebe delta.']`
- `['ScenarioQualityCheck', 'Recebe alertas.']`
- `['StressTestEngine', 'Recebe stress.']`
- `['ExecutiveReport', 'Envia narrativa final.']`