# ETL da Fase 2

## Papel no projeto

[`build_phase2_baseline.py`](build_phase2_baseline.py) é o gerador versionado dos artefatos de baseline da Fase 2. É executável manualmente (`python etl/build_phase2_baseline.py`), mas não é chamado pelo site nem pelo fluxo de testes de qualidade. O site consome os artefatos já preparados; a suíte valida seus contratos sem regenerá-los.

Este script não extrai planilhas XLSX. Ele lê JSON normalizado em `data/empresa1/core/` e `data/empresa2/core/`, além de `data/catalog.json`. Para arquivos registrados em `data/encrypted_manifest.json`, `jload` usa `VISAGIO_DATA_PASSWORD` para descriptografar os dados em memória. Os caminhos do projeto e a leitura opcional de `.env.local` são centralizados em [`project_paths.py`](project_paths.py).

## Efeitos da execução

`main()` constrói os artefatos de ambas as empresas, atualiza o catálogo e grava:

- `data/empresa{1,2}/phase2/{baseline_model,baseline_flows,baseline_costs,tax_results,base_fit,phase2_bundle}.json`;
- `data/catalog.json`, incluindo a seção `phase2`;
- `data/validation/phase2_implementation_report.json`.

Os arquivos JSON de saída são gravados em texto simples nos caminhos acima. Portanto, executar o script pode criar ou sobrescrever dados derivados protegidos e arquivos do pacote. Faça isso somente em uma cópia de trabalho controlada, com os insumos e a chave corretos, e revise `git status` e os diffs antes de manter qualquer resultado. O script não implementa escrita atômica nem opção de diretório de saída alternativo.

## Uso e validação

Para uma regeneração deliberada, configure `VISAGIO_DATA_PASSWORD` no ambiente ou em `.env.local` local (não versionado) e execute, a partir da raiz do repositório:

```bash
python etl/build_phase2_baseline.py
```

Não execute esse comando como parte de uma auditoria somente de leitura. Para validar os artefatos existentes sem regravá-los, use a suíte do projeto:

```bash
python tests/05_fase2_baseline/test_phase2_data_contracts.py
python tests/05_fase2_baseline/test_phase2_reconciliation_logic.py
```

Esses testes conferem dados atuais e cálculos do baseline; não provam que uma regeneração do ETL preserva byte a byte todos os arquivos. O relatório de caminhos e fontes está em [`docs/04_dados_caminhos_auditoria/11_CAMINHOS_E_REGENERACAO.md`](../docs/04_dados_caminhos_auditoria/11_CAMINHOS_E_REGENERACAO.md).
