# Como usar agora

## 1. Abrir o site

Na pasta extraída, rode:

```bash
npm ci
npm run serve
```

Abra:

```text
http://localhost:8000
```

ou direto:

```text
http://localhost:8000/fase-1-validacao/
```

## 2. Testar o pacote

Rode:

Sem a senha dos dados, rode somente a suíte pública:

```bash
npm run test:public
```

Para a validação integral, configure `VISAGIO_DATA_PASSWORD` conforme `.env.example` e rode:

```bash
npm test
```

Resultados esperados, respectivamente:

```text
PUBLIC_TEST_SUITE_OK
FULL_TEST_SUITE_OK
```

Se a credencial estiver ausente, `npm test` termina com `FULL_SUITE_BLOCKED`; isso é um bloqueio deliberado, não uma aprovação parcial.

## 3. Preparar para banca

Leia antes de apresentar:

```text
docs/00_inicio/32_ALERTA_FINAL_BANCA.md
```

Esse arquivo contém o roteiro de demonstração, os alertas defensáveis e as evidências Playwright geradas em:

```text
data/validation/presentation_e2e/
```

## 4. Onde olhar cada coisa

```text
PROJECT_STRUCTURE.md                         visão da organização das pastas
docs/README.md                               índice por tema
docs/00_inicio/32_ALERTA_FINAL_BANCA.md      roteiro final para banca
docs/03_modulos_contratos_funcoes/           contratos dos módulos
data/empresa1/                               dados da Empresa 1
data/empresa2/                               dados da Empresa 2
data/validation/                             auditorias e provas
references/raw_sources/                      arquivos brutos originais
tests/README.md                              mapa dos testes
```

## Abrir a Fase 2

Depois de iniciar o servidor local, abra:

```text
http://localhost:8000/fase-2-baseline/
```

Use a página para conferir o baseline da Empresa 1 e da Empresa 2. As empresas aparecem separadas. Na ausência de benchmark independente consolidado, a página informa `benchmark pendente` e não produz score fictício.


## Fase 3 implementada

Acesse `http://localhost:8000/fase-3-cenarios/` para criar, validar, simular, comparar, salvar, exportar e importar cenários manuais. Rode `python tests/run_all_tests.py` para validar o pacote completo.

# Como usar a Fase 4

1. Rode o servidor local:

```bash
python -m http.server 8000
```

2. Abra:

```text
http://localhost:8000/fase-4-score-otimizador/
```

3. Escolha Empresa 1 ou Empresa 2.
4. Escolha um perfil pronto, como CFO ou Supply.
5. Ajuste os pesos se quiser.
6. Defina restrições.
7. Clique em **Rodar otimizador leve**.
8. Confira search log, ranking, explicação do melhor cenário e fronteira de trade-off.

A Fase 4 continua 100% estática. Ela roda no navegador e usa os dados da Fase 2 e os motores da Fase 3.


## Fase 5 — Entrega Final

A Fase 5 foi implementada em `/fase-5-entrega-final/` com stress test, índice de robustez, recomendação, audit trail, relatório executivo, exportação e QA final. Risco e robustez são proxies multicritério, não probabilidades empíricas.

Para abrir:

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000/fase-5-entrega-final/`.
