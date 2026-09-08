
# Visagio Static Simulator

Simulador estático de malha logística com diagnóstico de dados, baseline, cenários, otimização e decisão final. O runtime usa JavaScript modular no navegador e dados protegidos carregados sob demanda.

## Executar

```bash
python -m http.server 8000
```

Abra [http://localhost:8000](http://localhost:8000). Os dados criptografados são desbloqueados pela frase configurada em `VISAGIO_DATA_PASSWORD` no ambiente local.

## Validar

```bash
npm run lint:js
npm run format:js:check
ruff check .
ruff format --check .
python tests/run_all_tests.py
```

O código executável fica em `assets/js/phase1/`, `assets/js/core/` e nos diretórios `assets/js/phase2` a `assets/js/phase5`. A documentação de contratos e os testes ficam separados em `phases/` e `tests/`.
