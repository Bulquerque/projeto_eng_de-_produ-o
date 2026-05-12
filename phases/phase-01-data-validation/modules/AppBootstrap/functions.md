# Funções internas

- `['initApp()', 'Cria o estado inicial e coordena a sequência de carregamento.']`
- `['loadPhase1Artifacts(paths)', 'Busca catálogo, qualidade, auditoria e inventário.']`
- `['renderApp(state)', 'Renderiza a interface conforme a empresa selecionada.']`
- `['showFatalError(error)', 'Mostra erro visível quando a inicialização falha.']`

# Dependências externas

- `['DataLoader.fetchJson', 'Carregar JSONs declarados em paths.']`
- `['CompanySelector.render', 'Renderizar seleção Empresa 1 / Empresa 2.']`
- `['DatasetPanel.render', 'Mostrar datasets da empresa selecionada.']`
- `['PathAuditPanel.render', 'Mostrar status dos caminhos auditados.']`