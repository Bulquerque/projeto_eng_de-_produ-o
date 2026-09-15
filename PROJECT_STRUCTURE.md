# Estrutura organizada do pacote

Este pacote foi reorganizado para deixar cada tipo de artefato em uma pasta clara.

```text
/
├── index.html                      # entrada compatível do portal e da Network UI
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
│       ├── app/                   # shell, rotas, estado e providers da Network UI
│       ├── core/                  # utilitários compartilhados únicos
│       ├── debug/                 # runtime do Debug Center
│       ├── phase1/                 # validação inicial
│       └── phase2/phase3/phase4/phase5  # módulos de domínio por fase
├── data/                           # dados tratados, contratos e relatórios de validação
│   ├── empresa1/                   # dados da Empresa 1
│   ├── empresa2/                   # dados da Empresa 2
│   ├── complements/                # complementos, referências e fontes tributárias
│   ├── contracts/                  # contratos de módulos de todas as fases
│   ├── release-manifest.json       # identidade e status da release validada
│   └── validation/                 # provas, auditorias e relatórios
├── docs/                           # documentação reorganizada por tema
├── etl/                            # apoio para geração/regeneração dos dados
├── references/                     # arquivos brutos e notas originais
└── tests/                          # testes separados por tipo
```

As pastas `fase-1-validacao/` a `fase-5-entrega-final/` são atalhos de navegação.
O runtime é único em `index.html`; as páginas de fase redirecionam para ele por hash,
e os dados versionados de empresa aparecem como `.enc.json`. O caminho sem essa extensão
é o caminho lógico usado pelo catálogo e pelo runtime antes da resolução criptográfica.

O pacote mantém duas superfícies compatíveis. `index.html` carrega a shell da Network UI
(`assets/js/app/main.js`) e, quando o modo Network não está ativo, importa os entrypoints
legados de `assets/js/phase1/` a `assets/js/phase5/` e o roteador legado. Assim, os hashes
históricos continuam funcionando sem inicializar os dois runtimes ao mesmo tempo.

## Network Intelligence

```text
assets/js/app/                  Shell moderna e orquestração da interface
assets/js/app/pages/            Renderers de Overview, Scenarios, Optimizer e Trust
assets/js/app/providers/        Provider demo isolado e provider real protegido
assets/js/app/services/         Pipelines de decisão e risco
assets/js/app/router.js         Rotas canônicas e aliases da Network UI
data-demo/empresa_mock/         Fixtures sintéticas públicas, sempre demo_only
tests/12_network_intelligence/  Contratos e E2E da interface moderna
```

Os engines continuam nas camadas `core/phase3/phase4/phase5`; a Network UI apresenta os
resultados e não cria uma segunda implementação de cálculo.


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
