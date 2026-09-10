# Guia de manutenção

Este arquivo define o fluxo mínimo para alterar o simulador sem quebrar as rotas, os contratos das fases ou a proteção dos dados.

## Organização canônica

| Área | Responsabilidade |
|---|---|
| `index.html` e `fase-*/` | Páginas estáticas públicas do simulador. |
| `assets/js/core/` | Utilitários compartilhados, contratos, configuração e tributação. |
| `assets/js/phase1/` a `assets/js/phase5/` | Entry points e módulos específicos de cada fase. |
| `data/` | Catálogos, contratos, dados derivados e fontes criptografadas. |
| `phases/` | Contratos, funções, testes e documentação por módulo. |
| `tests/` | Testes automatizados agrupados por fase e por tipo. |
| `etl/` | Scripts de preparação e regeneração de dados. |
| `scripts/` | Geração de evidências e artefatos acadêmicos. |
| `docs/` | Documentação técnica, auditorias e critérios de aceite. |
| `references/` | Fontes originais; não são dados de runtime. |

## Regras de código

- Mantenha módulos pequenos e com uma responsabilidade clara.
- Coloque lógica reutilizável em `assets/js/core/`; não duplique helpers entre fases.
- Preserve os caminhos relativos do site estático e o isolamento entre Empresa 1 e Empresa 2.
- Não use dados descriptografados diretamente no runtime nem grave senha em código, documentação ou Git.
- Trate proxy, fallback, parâmetro e dado observado como classes diferentes de evidência.
- Ao alterar um contrato, atualize o módulo, a documentação correspondente e o teste que o protege.
- Prefira nomes explícitos e funções puras para cálculos de custo, tributo, score e reconciliação.

## Fluxo local

```bash
npm ci
npm run quality
```

Para abrir a aplicação:

```bash
python -m http.server 8000
```

Para regenerar a evidência acadêmica e a planilha, mantenha `VISAGIO_DATA_PASSWORD` apenas no ambiente local ou em `.env.local` e execute:

```bash
node scripts/generate_academic_evidence.mjs
node scripts/build_academic_package.mjs
```

Os artefatos são gravados em `entregaveis/`, que é ignorado pelo Git por serem derivados e regeneráveis.

## Antes de criar um commit

1. Execute `npm run quality`.
2. Verifique `git diff --check`.
3. Confirme que somente arquivos relacionados à tarefa estão staged.
4. Faça uma busca por `.env`, senhas, chaves e dados descriptografados.
5. Descreva no commit o comportamento alterado, não apenas o arquivo editado.

## Antes de publicar

```bash
git status --short --branch
git log -1 --oneline
git push origin main
```

Não faça `git add -A` em uma árvore que possa conter exportações locais. Prefira adicionar os caminhos revisados explicitamente.
