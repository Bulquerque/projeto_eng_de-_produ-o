# Design QA — Network Intelligence integration

final result: passed

> Registro histórico de comparação local em 13–15/09/2026, usando o checkout `b66a889`. Não descreve o Site publicado nem o HEAD atual. Para o estado público mais recente, consulte o [relatório de 25/09/2026](../../31_RELATORIO_QA_SITE_PUBLICADO_2026-09-25.md).

## Reference and implementation

- Reference: `/home/bulquerque/Downloads/visagio_network_intelligence_agent_ready_v6_2.html`, served at `http://127.0.0.1:8120/visagio_network_intelligence_agent_ready_v6_2.html#/overview/summary`.
- Implementation: `/home/bulquerque/Downloads/visagio`, served at `http://127.0.0.1:8121/?ui=network-intelligence&company=empresa_mock#/network/overview/summary`.
- Viewport: 1440 × 1000 CSS px, deviceScaleFactor 1.
- Source capture: 1440 × 1016 px; implementation overview capture: 1440 × 1495 px; map capture: 1440 × 1193 px. The captures are full-page screenshots, so their heights differ because the implementation exposes the complete functional content below the fold.
- Screenshots: [reference](design-qa-reference.png) and [implementation](design-qa-current.png).
- Focused map capture: [Brazil map](design-qa-map.png).

## Comparison state and method

- Full-view comparison used the reference's executive decision state and the implementation's `empresa_mock` executive state at the same desktop viewport. The implementation intentionally uses the project's demonstrative fixture values and visible `MOCK`/`demo_only` labels.
- Focused comparison checked the topbar, recommendation hero, KPI row, sidebar, scenario preview, and the new Brazil map at `/network/overview/network`.
- No image assets were required from the reference; the dashboard is data-heavy. The Brazil state geometry is bundled locally as a simplified GeoJSON-derived module so the map does not depend on a CDN, shapefile runtime, or backend service.

## Checked

- The new shell owns the Network Intelligence visual language: dark teal navigation, numbered sections, compact decision-workspace top bar, section tabs, cards, KPI surfaces, hero recommendation area, help/settings drawer actions, runtime/company badges, and responsive card grids.
- Legacy Network Intelligence presentation was not reintroduced into the new routes. Existing business modules remain behind the new shell.
- The overview uses real state values and explicit unknowns. For `empresa_mock`, the provider now initializes the same recommended demonstrative scenario exposed by its objective fixture, while keeping the `MOCK`/`demo_only` boundary visible.
- Scenario build includes a live preview tied to the loaded baseline or calculated scenario, with current total, saving, active-CD count, and calculation state.
- Scenario result, comparison, risk, optimizer, and trust pages share the new section navigation and visual surfaces.
- Overview network now includes a local, interactive 27-state Brazil map with hover/focus labels, flow intensity, and an explicit demonstrative-data state when UF is unavailable.
- Overview network preserves the `main` flow analytics with volume-by-CD and distance-profile charts when those metrics are present; the fiscal overview exposes selected/reference periods without exposing protected source paths.
- Scenario risk has a complete interaction path: after a scenario run, `Calcular risco` calls the active provider's `runRiskSuite` and opens the risk page after Monte Carlo/stress/sensitivity data is stored.
- Scenario risk exposes the legacy uncertainty controls and seven chart surfaces: percentile range, probability, histogram, CDF, total curve, driver importance, and driver × saving scatter. Comparison rows can re-run and select an optimizer scenario, with an explicit return from advanced risk.
- Optimizer configuration exposes all five objective profiles plus candidate/seed/CD/risk constraints and the stress, sensitivity, matrix, and Monte Carlo controls used by the existing engines.
- Mock data remains explicitly labelled `MOCK`/`demo_only`; protected company selection remains separate and encrypted.
- Protected exports are projected before JSON, HTML, and CSV generation. Raw flows, baseline/core payloads, tenant paths, secrets, and arbitrary CSV row fields are excluded; CSVs use fixed allowlisted columns and warning/error counts.

## Functional evidence

- `python tests/12_network_intelligence/test_network_ui_playwright.py` — passed.
- Browser map contract — passed: 27 state paths rendered, no bootstrap error, and demonstrative coverage label visible.
- `python tests/12_network_intelligence/test_app_contracts.py` — passed.
- Dedicated Playwright risk flow — passed (`NETWORK_INTELLIGENCE_RISK_FLOW_OK`).
- `python tests/run_all_tests.py` — passed (`ALL_PHASE5_PACKAGE_TESTS_OK`).
- `npm run lint` — passed.
- `npm run format:check` — passed.
- `git diff --check` — passed.
- Chrome real final protected matrix — passed for `empresa1` and `empresa2`: 27 map states, risk controls, four exports reopened per tenant, protected export policy, zero console errors, zero page errors, and zero failed requests.
- Chrome real profile/form matrix — passed: five optimizer profiles, CD selection, blocked tax-disabled mode, and scenario-state reset/isolation.

## Comparison history

- Earlier P1: the mock opened on baseline with empty recommendation KPIs. Fix: initialize `empresa_mock` from the objective fixture's recommended scenario. Post-fix evidence: [updated executive capture](design-qa-current.png), Evidence 100/100 and “Recomendado com ressalvas” visible.
- Earlier P1: the reference had no equivalent product-level geographic view in the integration. Fix: add the locally bundled Brazil map and connect it to provider flow metrics. Post-fix evidence: [map capture](design-qa-map.png), all 27 state paths rendered.
- Earlier P2: topbar wrapped poorly at intermediate widths and the Style guide action was missing. Fix: responsive topbar rules and Style guide drawer. Post-fix evidence: browser E2E covers the drawer; regression suite covers responsive layout.
- Earlier P1: protected export artifacts could carry raw flow/path fields. Fix: allowlisted protected projection in `assets/js/phase5/export-center.js`, fixed CSV columns, and four-artifact sentinel/Chrome re-open checks. Post-fix evidence: `PHASE5_AUDIT_EXPORT_OK` and `CHROME_FINAL_PROTECTED_MATRIX_OK`.

## Remaining P3 polish

The reference HTML still has bespoke iconography and a mobile drawer interaction that are not copied pixel-for-pixel. The integrated UI keeps the project's real provider/fixture boundary, routes all calculations through the existing engines/providers, and labels mock outputs as demonstrative instead of presenting reference-only numbers as observed business data.
