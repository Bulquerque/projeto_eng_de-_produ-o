# Academic Evidence Closure Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or execute task-by-task. Each task has a focused test gate.

**Goal:** Close every code-addressable issue in the TCC feedback and produce a reproducible, privacy-safe evidence package, while marking unavailable protected-data and external-authorization work as blocked rather than fabricating results.

**Architecture:** Extend the existing academic evidence generator and runtime diagnostics to cover the named scenarios, optimizer profiles, Monte Carlo outputs, fallbacks, and reconciliation checks. Keep tax-transition assumptions explicit and exploratory unless rates are separately supported. Generate only aggregated outputs; do not write decrypted inputs or credentials to the repository or Site.

**Tech Stack:** JavaScript ES modules, existing scenario/Monte Carlo/optimizer engines, Python test runner, GitHub Actions, Sites deployment connector, DOCX revision workflow.

**Spec:** `/home/bulquerque/Downloads/AJUSTES NO CODIGO - ATE 19_11.docx` (H1–H12) and current revised manuscript `/home/bulquerque/Downloads/TCC_GiovannaHugo_v2_MC_revisado_2026-11-04.docx`.

## Global Constraints

- Keep all work on `codex/academic-review-fixes` in the isolated worktree.
- Never commit passwords, decrypted inputs, company-level sensitive rows, or test artifacts containing protected data.
- Do not infer company authorization to use the Visagio brand; use the neutral public product title and identify historic screenshots.
- Do not call a synthetic test a protected-data validation.
- Do not publish, merge, or claim completion until code checks and rendered-document checks pass; PR remains draft pending evidence review.

## Review Focus

- Missing or malformed protected inputs: generator must fail with a clear message and leave no partial report.
- Mixed-company runs: every output row must carry one company id and must not blend company or mock data.
- Missing freight, weight, distance, or storage tariff: report each fallback count and denominator without double-counting flows.
- Unsupported transition years or alpha values: label them exploratory and reject any claim that the aggregate alpha is a legal rate.
- Search truncation and optimization limits: export evaluated-candidate count, bounds, stop reason, and incomplete-search status.

---

### Task 1: Academic scenario evidence generation

**Files:**
- Modify: `scripts/generate_academic_evidence.mjs`
- Modify: `scripts/academic-evidence-config.mjs`
- Test: `tests/12_network_intelligence/` focused generator-contract tests

- [ ] Add explicit retail scenarios for 14 CDs without Ribeirao Preto, 14 CDs without Cajamar, and one CD with freight multiplier `1.0`; export component costs and savings against the same-company baseline.
- [ ] Add explicit six-profile optimization exports per company and named scenario; include constraints, weights, completeness, and stop reason.
- [ ] Add Monte Carlo evidence per reproducible scenario using seed `42` and `300` iterations; keep deterministic results separate.
- [ ] Add a Scenario N guard: do not invent allocations; emit `not_reproducible` and required input fields when a mapping is absent.
- [ ] Add tests with synthetic fixtures that assert exact scenario names, separation, outputs, and the non-reproducible guard.
- [ ] Run the generator against synthetic fixtures; run protected generation only if the configured credential authenticates the encrypted bundle.

### Task 2: Fallback diagnostics and parameter provenance

**Files:**
- Modify: `assets/js/phase3/physical-cost-engine.js`
- Modify: `assets/js/phase5/executive-report-builder.js`
- Modify: `assets/js/core/model-configuration.js`
- Test: `tests/12_network_intelligence/` diagnostics tests

- [ ] Add per-type `fallback_counts` and denominators for the proportional-storage rule, missing CIF, missing transfer distance/rate, missing freight, and revenue proxy.
- [ ] Ensure one flow is not counted twice for the same fallback category; expose counts and rates in exported report.
- [ ] Preserve provenance fields for each engineering hypothesis and mark table 3.1 unused parameters explicitly in the generated methodology report.
- [ ] Add fixture tests for each fallback, no-fallback, and mixed fallback paths.
- [ ] Run focused tests and static checks.

### Task 3: Tax transition and reconciliation status

**Files:**
- Inspect/modify: `assets/js/core/tax-reform-config.js`
- Inspect/modify: `assets/js/core/reconciliation-engine.js`
- Modify: `scripts/generate_academic_evidence.mjs`
- Test: `tests/12_network_intelligence/` tax/reconciliation tests

- [ ] Export the existing alpha schedule with provenance as `engineering_assumption_exploratory`, not a legal rate.
- [ ] Add a machine-readable comparison that reports which tax components and years are represented and which legal components are not modeled separately.
- [ ] Reconcile workbook tax totals to calculated line totals when complete source rows exist; report the residual and unmatched rows, without calling the difference a software defect.
- [ ] Do not derive missing 2033 Scenario N allocation or tax rates from public research; preserve them as missing inputs.
- [ ] Add tests for known totals, residual calculation, missing scenario allocation, and alpha metadata.

### Task 4: Transfer-rate calibration reproducibility

**Files:**
- Inspect/modify: `scripts/calibrate_transfer_rates.mjs`
- Modify: `assets/js/core/model-configuration.js`
- Test: `tests/12_network_intelligence/calibrate_transfer_rates.mjs`

- [ ] Confirm the aggregation formula, units, filters, period, route distance source, and exclusions in the calibration output.
- [ ] Keep current defaults explicitly labeled as unvalidated hypotheses until real source data produces an accepted calibration artifact.
- [ ] Add edge-case tests for zero/missing distance, invalid UF, empty input, and rate units.
- [ ] Run against synthetic data only unless protected company input is available and valid.

### Task 5: Evidence document and publication

**Files:**
- Update: `/home/bulquerque/Downloads/TCC_GiovannaHugo_v2_MC_revisado_2026-11-04.docx`
- Update: `README.md` and academic evidence methodology docs if required

- [ ] Update the TCC only from generated evidence; keep the statement that Table 4.4 risk labels are author judgments and have no simulator score.
- [ ] Remove or clearly mark any stale values that depend on the former reallocation rule.
- [ ] Render the final DOCX and inspect pages with tables, citations, conclusions, and figures.
- [ ] Run `npm run quality:public` and the applicable protected-data suite; record inaccessible credential/input failures without exposing secrets.
- [ ] Commit narrowly, push the PR branch, confirm GitHub checks, save/deploy the exact Site source, then verify the live Site. Do not merge the draft PR.

## Completion Gate

The task is complete only when code-addressable H1–H10 corrections are implemented or explicitly proven data-dependent, protected execution results are exported where credentials permit, H11 findings are reconciled against protected evidence, the TCC render is inspected, GitHub checks are green, and Site deployment succeeds. Any unavailable protected data, missing Scenario N allocation, or unconfirmed brand permission remains explicitly unresolved.
