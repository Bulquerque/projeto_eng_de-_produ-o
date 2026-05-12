# Auditoria completa de caminhos e abas — v5

Resultado: **OK**.

- Workbooks XLSX verificados: 5
- Abas verificadas: 53
- Abas com export por arquivo-fonte/source_id: 53
- Abas sem export por arquivo-fonte/source_id: 0
- Caminhos declarados faltantes: 0
- Core files obrigatórios faltantes: 0
- Fórmulas com vínculo externo: 0
- Relationships externas: 0
- Paths absolutos em arquivos de texto do pacote: 0

## Uso correto

- O simulador deve puxar dados de `data/empresa1/core/` e `data/empresa2/core/`.
- A auditoria aba por aba fica em `data/<empresa>/source_exports/<source_id>/`.
- O inventário completo fica em `data/validation/workbook_sheet_inventory.csv`.
- O relatório completo fica em `data/validation/full_workbook_path_audit.json`.

## Observação

`Analise_Malha_Empresa2(1).xlsx` e `Análise Malha Logística - vCaracol(3).xlsx` têm SHA256 idêntico. São o mesmo workbook com nomes diferentes. Mesmo assim, ambos estão preservados e ambos possuem exports próprios.
