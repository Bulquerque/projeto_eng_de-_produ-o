# Módulos, inputs, outputs, funções e testes

Este arquivo agora é apenas a porta de entrada. A especificação completa foi reorganizada em arquivos mais fortes e fáceis de auditar.

Leia nesta ordem:

1. `docs/26_MAPA_FASES_MODULOS.md` — visão por fase.
2. `docs/23_MODULOS_TODAS_FASES_CONTRATOS.md` — contrato completo de cada módulo.
3. `docs/24_FUNCOES_E_DEPENDENCIAS_MODULOS.md` — funções internas e chamadas para outros módulos.
4. `docs/25_TESTES_POR_MODULO_TODAS_FASES.md` — testes unitários, integração, manuais e aceite por módulo.
5. `data/contracts/module_contracts_all_phases.json` — versão estruturada dos contratos em JSON.
6. `data/contracts/module_dependency_matrix.csv` — matriz de dependências entre módulos.
7. `data/contracts/module_tests_matrix.csv` — matriz de testes por módulo.

Regra principal: todo módulo precisa declarar fase, descrição, input JSON, output JSON, funções internas, chamadas externas e testes. Se um módulo novo for criado sem isso, ele está incompleto.
