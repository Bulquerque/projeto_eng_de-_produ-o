# Core JS

Este diretório é a camada preferencial para utilitários compartilhados do runtime.

A migração para `assets/js/core/` é feita de forma compatível:

- `assets/js/shared/` continua disponível como alias legada enquanto o código é reorganizado.
- Os entrypoints novos ficam em `assets/js/features/phase-*/`.

Use este diretório como referência para novas funções compartilhadas e para reduzir acoplamento entre fases.
