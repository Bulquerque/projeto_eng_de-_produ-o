# Troubleshooting — Fase 1

Problemas comuns ao abrir ou testar o pacote.

## A página abre em branco

Possíveis causas:

1. Você abriu o `index.html` direto pelo explorador de arquivos.
2. O navegador bloqueou `fetch` de arquivos locais.
3. O servidor estático não está rodando na pasta raiz correta.

Solução:

```bash
cd pasta_do_pacote
python -m http.server 8000
```

Depois abra:

```text
http://localhost:8000
```

## O CSS não carregou

Confirme que existe:

```text
assets/styles.css
```

E que você está servindo a pasta raiz do pacote, não uma subpasta errada.

## O JS não carregou

Confirme que existe:

```text
assets/app.js
```

Rode:

```bash
node --check assets/app.js
```

Se não tiver Node instalado, rode pelo menos os testes Python do pacote.

## Aparece erro ao carregar `catalog.json`

Confirme que o arquivo existe:

```text
data/catalog.json
```

E rode:

```bash
python tests/test_phase1_static_site.py
```

## `missing_paths` maior que zero

Não avance para Fase 2. Abra:

```text
data/validation/path_resolution_report.json
```

Procure a lista `missing_paths`. O arquivo citado precisa ser recriado ou o catálogo precisa ser corrigido.

## Empresa 1 e Empresa 2 parecem misturadas

Confira:

```text
data/catalog.json
```

A Empresa 1 deve ter `core_files` de demanda, distância e premissas. A Empresa 2 deve ter os datasets do workbook de malha.

## Playwright falhou com erro de navegador

Se aparecer algo como bloqueio de Chromium ou `ERR_BLOCKED_BY_ADMINISTRATOR`, isso pode ser problema do ambiente, não necessariamente da página.

Valide com:

```bash
python tests/test_phase1_http_server.py
```

E abra manualmente no navegador.

## O checklist manual não salva

O checklist usa `localStorage`. Ele pode não salvar se:

```text
você está em modo anônimo com storage bloqueado
o navegador bloqueia armazenamento local
você abriu por file:// em vez de localhost
```

Use `http://localhost:8000`.

## Acentos aparecem estranhos em nomes de arquivos

Isso pode acontecer por diferença de normalização Unicode. Os caminhos usados no catálogo foram validados dentro do pacote. Evite renomear arquivos manualmente.
