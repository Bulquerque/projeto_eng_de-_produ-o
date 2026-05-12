# Estrutura organizada do pacote

Este pacote foi reorganizado para deixar cada tipo de artefato em uma pasta clara.

```text
/
├── index.html                      # página principal da Fase 1
├── fase-1-validacao/               # rota direta para validação da Fase 1
├── assets/                         # CSS e JavaScript do site estático
├── data/                           # dados tratados, contratos e relatórios de validação
│   ├── empresa1/                   # dados da Empresa 1
│   ├── empresa2/                   # dados da Empresa 2
│   ├── contracts/                  # contratos de módulos de todas as fases
│   └── validation/                 # provas, auditorias e relatórios
├── docs/                           # documentação reorganizada por tema
├── etl/                            # apoio para geração/regeneração dos dados
├── references/                     # arquivos brutos e notas originais
└── tests/                          # testes separados por tipo
```

O runtime do site continua simples: `index.html` lê `assets/` e `data/` por caminhos relativos.


## Fase 2 adicionada

```text
fase-2-baseline/                  Página estática da Fase 2
assets/js/shared/                 Funções compartilhadas de formatação e carregamento
assets/js/phase2/                 Módulos JS da Fase 2
data/empresa1/phase2/             Artefatos derivados da Empresa 1 para baseline
data/empresa2/phase2/             Artefatos derivados da Empresa 2 para baseline
tests/05_fase2_baseline/          Testes da Fase 2
```


## Fase 3 implementada

Acesse `http://localhost:8000/fase-3-cenarios/` para criar, validar, simular, comparar, salvar, exportar e importar cenários manuais. Rode `python tests/run_all_tests.py` para validar o pacote completo.


## Fase 5 — Entrega Final

A Fase 5 foi implementada em `/fase-5-entrega-final/` com stress test, robustez, recomendação, audit trail, relatório executivo, exportação e QA final.

Para abrir:

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000/fase-5-entrega-final/`.


---
## Reestruturação final por fases/módulos

Use `phases/` para navegar por feature. Use `/debug/` para depurar paths, módulos e erros.
