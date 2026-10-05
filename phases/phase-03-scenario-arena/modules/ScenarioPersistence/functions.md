# Funções internas

- `['saveScenario(scenario)', 'Salva no localStorage por empresa.']`
- `['loadScenarios(company)', 'Lê cenários da empresa.']`
- `['deleteScenario(id)', 'Remove cenário.']`
- `['exportScenario(id)', 'Gera JSON baixável.']`
- `['importScenario(json)', 'Confere empresa e IDs do objeto importado.']`

# Dependências externas

A persistência/importação confere empresa e IDs com suas próprias funções; a validação estrutural do cenário é orquestrada pelo dashboard e pelo simulador.

- `['AuditTrail', 'Registra origem do cenário importado/exportado.']`
