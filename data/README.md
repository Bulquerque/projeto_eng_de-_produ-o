# Dados do simulador

Esta pasta guarda os dados tratados que o site estático lê diretamente.

```text
data/
├── catalog.json                 # catálogo principal usado pelo front-end
├── data_quality_summary.json    # resumo de qualidade de dados
├── empresa1/                    # Empresa 1: demanda, distância e premissas
├── empresa2/                    # Empresa 2: workbook de malha tratado
├── contracts/                   # contratos dos módulos por fase
├── references/                  # referências derivadas dos dados
└── validation/                  # auditorias, provas e relatórios
```

Os caminhos permanecem relativos para funcionar com `python -m http.server`.
