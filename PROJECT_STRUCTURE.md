# Estrutura organizada do pacote

Este pacote foi reorganizado para deixar cada tipo de artefato em uma pasta clara.

```text
/
├── index.html                      # página principal da Fase 1
├── fase-1-validacao/               # rota direta para validação da Fase 1
├── fase-2-baseline/                # baseline e paridade
├── fase-3-cenarios/                # simulação manual
├── fase-4-score-otimizador/        # score e otimização
├── fase-5-entrega-final/           # entrega final e decisão
├── debug/                          # Debug Center isolado
├── assets/
│   ├── styles.css                  # estilo global
│   ├── js/phase1/                  # entrypoint e módulos da Fase 1
│   └── js/
│       ├── core/                  # utilitários compartilhados únicos
│       ├── debug/                 # runtime do Debug Center
│       ├── phase1/                 # validação inicial
│       └── phase2/phase3/phase4/phase5  # módulos de domínio por fase
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

O runtime do site continua simples: `index.html` carrega cada fase por seu próprio `main.js` em `assets/js/phase1/` a `assets/js/phase5/`, sempre com caminhos relativos.


## Fase 2 adicionada

```text
fase-2-baseline/                  Página estática da Fase 2
assets/js/phase2/main.js          Entry point da Fase 2
assets/js/phase2/                 Módulos do domínio de baseline
assets/js/core/                   Única camada de utilitários compartilhados
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
