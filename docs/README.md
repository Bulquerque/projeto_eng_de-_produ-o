# Documentação

Use este índice para localizar documentação por finalidade. Os documentos numerados de fases registram planos, decisões e evidências produzidos em momentos diferentes; a numeração é histórica, não garantia de que cada instrução ainda descreva o runtime atual.

## Leitura recomendada

1. [`00_inicio/00_README_DO_PACOTE.md`](00_inicio/00_README_DO_PACOTE.md) — orientação de leitura e documentos acadêmicos centrais.
2. [`01_visao_geral_do_projeto/`](01_visao_geral_do_projeto/) — desafio, arquitetura estática, features e separação das empresas.
3. [`02_fases_do_projeto/`](02_fases_do_projeto/) — planos, guias e registros de implementação por fase.
4. [`03_modulos_contratos_funcoes/`](03_modulos_contratos_funcoes/) — contratos, dependências, módulos e testes.
5. [`04_dados_caminhos_auditoria/`](04_dados_caminhos_auditoria/) — proveniência, caminhos, dicionário e auditorias de dados.
6. [`05_testes_aceite/README.md`](05_testes_aceite/README.md) — inventário, QA atual do Site e evidências de aceite.
7. [`06_manifestos/`](06_manifestos/) — manifestos de documentação e de release.

## Explorar implementação e execução

- [`../PROJECT_STRUCTURE.md`](../PROJECT_STRUCTURE.md) — árvore resumida e entry points reais.
- [`../phases/README.md`](../phases/README.md) — documentação organizada por módulo/feature.
- [`../assets/js/core/README.md`](../assets/js/core/README.md) — utilitários compartilhados.
- [`../tests/README.md`](../tests/README.md) — comandos e escopo dos testes.
- Debug Center: abra [`../debug/`](../debug/).

## Dados e compartilhamento

As fixtures em `data-demo/empresa_mock/` são sintéticas e destinadas à demonstração. Os conjuntos reais em `data/` têm regras próprias de proteção e podem incluir arquivos ignorados pelo Git. Consulte [`../README.md`](../README.md) e os documentos de dados antes de compartilhar arquivos ou gerar um pacote. Não use relatórios históricos como prova de que o checkout atual passou nos mesmos testes.
