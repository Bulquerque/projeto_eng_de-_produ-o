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

Instale as dependências JavaScript e as ferramentas Python do gate (versões fixadas em
`requirements-quality.txt`). Para os testes E2E, instale também o Chromium do Playwright:

```bash
npm ci
python -m pip install -r requirements-quality.txt
python -m playwright install chromium
```

Para a cobertura pública, sem credencial:

```bash
npm run quality:public
```

Para executar a suíte completa, incluindo os testes E2E que leem os dados protegidos,
configure `VISAGIO_DATA_PASSWORD` no ambiente local e rode:

```bash
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

1. Execute `npm run quality:public`; execute também `npm run quality` quando tiver a
   credencial protegida e o Chromium do Playwright configurados.
2. Verifique `git diff --check`.
3. Confirme que somente arquivos relacionados à tarefa estão staged.
4. Faça uma busca por `.env`, senhas, chaves e dados descriptografados.
5. Descreva no commit o comportamento alterado, não apenas o arquivo editado.

### Manter inventários e evidências

Ao adicionar, mover ou remover documentação/testes, regenere e confira o manifesto:

```bash
python scripts/manage_documentation_inventory.py --write
python scripts/manage_documentation_inventory.py --check
```

Quando `data/validation/` mudar, atualize e confira o inventário de hashes:

```bash
python scripts/manage_validation_evidence_manifest.py --write
python scripts/manage_validation_evidence_manifest.py --check
```

O manifesto de evidências registra caminho, tamanho, SHA-256 e o commit de geração.
Isso identifica os bytes preservados; não prova que os arquivos foram produzidos nesse
commit, nem que os resultados continuam válidos. Cada relatório novo deve registrar,
quando aplicável, data/hora com fuso, commit do código testado, comando e versão das
ferramentas, escopo, resultado e limitações. Se esses dados não estiverem incorporados,
classifique a evidência como histórica ou não verificada e repita a validação necessária.

## Política para histórico e capturas

- Mantenha em `docs/05_testes_aceite/` apenas os critérios de aceite e o estado atual.
- Mova relatórios e capturas substituídos para `docs/05_testes_aceite/historico/<data>-<tema>/`;
  inclua um README com data, commit testado, ambiente, escopo, resultado e motivo da retenção.
- Preserve capturas que sustentem uma comparação ou conclusão histórica. Não as apresente
  como estado atual; ligue cada imagem a um relatório e evite duplicar o mesmo arquivo.
- Remova evidências somente quando forem redundantes ou sem valor de auditoria, e confirme
  que nenhum relatório depende delas. Nunca inclua credenciais, dados descriptografados ou
  conteúdo protegido em capturas ou metadados.
- Evidência de execução atual deve ser regenerável por comando documentado. Use nomes que
  indiquem fluxo e data; o relatório deve apontar para os arquivos e seus SHA-256 quando
  compartilhar uma captura entre casos.

## Antes de publicar

```bash
git status --short --branch
git log -1 --oneline
```

Publique pela branch de release definida para o repositório: abra ou atualize o pull
request a partir da branch de trabalho, aguarde os checks exigidos e integre pelo processo
de revisão configurado. Só faça push direto se a política do repositório permitir; nesse
caso, confirme a branch de destino com a configuração/revisão vigente e use o nome
explícito, nunca presuma que ela se chama `main`. Este guia não escolhe nem altera a
branch de publicação.

Não faça `git add -A` em uma árvore que possa conter exportações locais. Prefira adicionar
os caminhos revisados explicitamente.
