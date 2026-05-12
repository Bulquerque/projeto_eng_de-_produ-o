# phase-01-data-validation

Organização por feature da Fase 1.

- [`AppBootstrap`](modules/AppBootstrap/README.md) — Inicializa o site estático, carrega os artefatos mínimos da Fase 1 e dispara a primeira renderização segura da interface.
- [`CompanySelector`](modules/CompanySelector/README.md) — Permite alternar entre Empresa 1 e Empresa 2 mantendo isolamento total de datasets, indicadores e mensagens.
- [`DataLoader`](modules/DataLoader/README.md) — Centraliza a leitura dos arquivos estáticos JSON/CSV usados pela interface. É o módulo que garante que os dados vêm dos caminhos relativos corretos.
- [`DataQualityPanel`](modules/DataQualityPanel/README.md) — Exibe score de qualidade, contagens, warnings e erros já apurados na preparação dos dados.
- [`DatasetPanel`](modules/DatasetPanel/README.md) — Mostra os datasets core e arquivos brutos vinculados à empresa selecionada, com caminhos relativos visíveis para auditoria manual.
- [`ManualChecklist`](modules/ManualChecklist/README.md) — Permite ao usuário marcar manualmente validações da Fase 1 e salvar o progresso no navegador.
- [`PathAuditPanel`](modules/PathAuditPanel/README.md) — Mostra a auditoria dos caminhos do pacote: quantidade checada, faltantes, abas auditadas e arquivos core obrigatórios.
- [`Phase1TestPanel`](modules/Phase1TestPanel/README.md) — Mostra no navegador os testes automáticos básicos da Fase 1, permitindo checagem rápida sem terminal.
- [`WorkbookInventoryPanel`](modules/WorkbookInventoryPanel/README.md) — Mostra o inventário de abas dos workbooks, especialmente para provar que as abas da Empresa 2 foram exportadas e mapeadas.
