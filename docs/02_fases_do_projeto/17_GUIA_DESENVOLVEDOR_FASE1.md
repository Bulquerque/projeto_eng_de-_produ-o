# Guia do desenvolvedor — Fase 1

Este documento explica como a Fase 1 está organizada tecnicamente.

## Arquivos principais

```text
index.html
assets/styles.css
assets/app.js
data/catalog.json
data/data_quality_summary.json
data/validation/path_resolution_report.json
data/validation/final_v6_audit_summary.json
data/validation/workbook_sheet_inventory.csv
```

## Responsabilidade de cada arquivo

### `index.html`

Define a estrutura da página. Ele não deve conter lógica pesada. A página chama o CSS e o JS.

### `assets/styles.css`

Define a identidade visual da Fase 1. Usa paleta inspirada no material institucional da Visagio, com fundo claro, verde escuro, verde médio, verde água e cards limpos.

### `assets/app.js`

Contém a lógica da interface estática.

Módulos implementados:

```text
DataLoader
CompanySelector
DatasetPanel
DataQualityPanel
PathAuditPanel
WorkbookInventoryPanel
ManualChecklist
Phase1AutoChecks
```

## Fluxo de carregamento

```text
1. Página abre.
2. app.js chama DataLoader.
3. DataLoader busca catalog.json e relatórios de validação.
4. Empresa 1 é selecionada por padrão.
5. DatasetPanel renderiza os datasets da empresa selecionada.
6. DataQualityPanel renderiza qualidade.
7. PathAuditPanel renderiza paths e auditoria.
8. ManualChecklist carrega estado salvo no localStorage.
```

## Dados carregados pelo frontend

O frontend lê principalmente:

```text
data/catalog.json
data/data_quality_summary.json
data/validation/path_resolution_report.json
data/validation/final_v6_audit_summary.json
data/validation/workbook_sheet_inventory.csv
data/validation/phase_tests.json
```

Ele não deve depender de path absoluto, tipo `/mnt/data`, `C:\...` ou caminho da máquina de quem gerou o pacote.

## Contrato do catálogo

O `catalog.json` deve ter:

```json
{
  "companies": {
    "empresa1": {
      "label": "Empresa 1",
      "core_files": []
    },
    "empresa2": {
      "label": "Empresa 2",
      "core_files": []
    }
  }
}
```

Cada item em `core_files` pode ter:

```json
{
  "id": "nome_do_dataset",
  "csv": "data/.../arquivo.csv",
  "json": "data/.../arquivo.json",
  "rows": 0,
  "columns": 0,
  "description": "descrição curta"
}
```

## Regras de desenvolvimento

1. Não misturar Empresa 1 e Empresa 2.
2. Não usar caminhos absolutos no frontend.
3. Toda nova fonte precisa entrar em `data/catalog.json`.
4. Todo novo arquivo core precisa entrar nos testes de path.
5. Não colocar lógica de simulação pesada na Fase 1.
6. Quando criar Fase 2, manter compatibilidade com os painéis da Fase 1.

## Como adicionar um novo dataset

1. Salvar o CSV/JSON em `data/empresaX/core/`.
2. Adicionar o dataset em `data/catalog.json`.
3. Atualizar `data/validation/path_resolution_report.json` via script de auditoria.
4. Rodar `python tests/test_phase1_static_site.py`.
5. Abrir o site e conferir se o dataset aparece no painel.

## Observação sobre Playwright

O teste Playwright foi incluído, mas pode ser bloqueado por política do navegador no ambiente. Isso não significa necessariamente que a página está quebrada. Quando isso acontecer, use o teste HTTP e a validação manual no navegador.
