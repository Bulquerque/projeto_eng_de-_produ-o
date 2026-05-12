# Funções internas

- `['getCompanyDatasets(catalog, companyId)', 'Filtra datasets pela empresa selecionada.']`
- `['normalizeDatasetRecord(record)', 'Padroniza nome, descrição, formato e path.']`
- `['renderDatasetCard(dataset)', 'Cria o card visual do dataset.']`
- `['markDatasetStatus(dataset, pathReport)', 'Marca OK/warning/error conforme auditoria de paths.']`

# Dependências externas

- `['PathAuditPanel.getPathStatus', 'Checar se o caminho está em missing_paths.']`
- `['DataLoader.fetchJson', 'Opcionalmente carregar metadados dos datasets.']`