# Diagnóstico inicial reproduzível

## Identificação

- Repositório: `Bulquerque/projeto_eng_de-_produ-o`
- Commit inicial analisado: `4086f3a7355085c19fb2a34ab318e2c4766443c3`
- Branch de preservação: `archive/pre-correction-2026-09-04`
- Branch de trabalho: `fix/visagio-full-audit`
- Node mínimo: 20
- Python mínimo: 3.10
- Dependências de desenvolvimento: `requirements-dev.txt`

## Estado antes da correção

O código já possuía um motor Monte Carlo ativo, mas o relatório o descrevia como determinístico. Também havia uma proxy de transferência da Empresa 1 baseada em dados da Empresa 2, um cálculo de estoque sem efeito explícito do número de CDs, fallbacks dispersos e divergências de nomenclatura na reconciliação. A Tabela 7 não era matematicamente compatível com os valores arredondados apresentados.

O PDF recebido não continha arquivo-fonte editável no repositório. Por isso, foi produzida uma versão editável equivalente, com formatação acadêmica preservada na medida permitida pelo material disponível.

## Comandos de diagnóstico e validação

```bash
npm ci
npm run lint
npm run format:check
ruff check .
python tests/run_public_tests.py
python tests/run_all_tests.py
```

Os testes protegidos só são válidos quando a variável `VISAGIO_DATA_PASSWORD` está disponível no ambiente legítimo. Sem ela, a execução é bloqueada, não aprovada.

## Critério de evidência

Uma afirmação numérica é considerada reproduzível quando pode ser obtida pela suíte de testes e pelos arquivos criptografados do projeto. Quando não existe base suficiente, o resultado é exposto como proxy, parâmetro ou fallback, com cobertura e warning.
