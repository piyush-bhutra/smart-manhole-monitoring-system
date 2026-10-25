# Smart Manhole Pulse 4A Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. No commits or pushes are authorized.

**Goal:** Deliver a distinctive desktop monitoring foundation and a truthful animated selected-manhole visualization.

**Architecture:** Preserve the single Flask polling flow. A pure presentation adapter consumes effective sensor observations, backend thresholds, connectivity and API snapshot validity. An inline SVG renders independent gas, water and cover layers; CSS owns motion and reduced-motion treatment.

**Tech Stack:** Existing React/TypeScript, CSS, Lucide, Leaflet, Recharts and Playwright; no new dependencies.

**Spec:** User-approved Milestone 4A scope in the conversation and PRD section 17. Desktop/projector focus; no new mobile or responsive work.

## Global Constraints
- Preserve backend/**, API contracts, schema, ingestion units, thresholds, simulator and incident semantics.
- Missing values never mean zero; raw gas never means calibrated ppm.
- Acknowledgement cannot change the measured illustration.
- Offline/API-stale values are historical, never current-safe evidence.
- Keep component identity stable across polling. Respect reduced motion.
- Defer incident entrance tracking, enhanced map markers and sound to 4B/later.
- Work in the existing dependency-equipped checkout on codex/smart-manhole-pulse-4a. User authorized implementation; no extra approval gate or worktree setup is needed. Preserve reviewable uncommitted changes.

## Review Focus
- A fresh hazard with another missing or stale channel remains visible.
- A newer raw-only observation cannot resurrect an old ppm visualization.
- API failure freezes the last image without implying current safety or recovery.
- Equal-to-threshold observations are hazardous; water geometry is explicitly schematic.
- Polls and acknowledgements preserve SVG identity and cannot replay state entrances.

## Task 1: Condition presentation
Files: create frontend/src/services/conditionView.ts and frontend/tests/condition-view.spec.ts.
Interface: conditionView(node: MonitorNode, thresholds: Summary['demo_thresholds'], snapshotCurrent: boolean) returns mode, per-channel conditions, current and last-known hazards, water ratio and cover state.
- [x] Write independent cases for all review-focus inputs, safe/offline/unknown states, zero and simultaneous hazards; run Playwright on the file and observe missing implementation failure.
- [x] Implement the pure adapter using existing effective sensors and configured inclusive thresholds; run focused tests to green.

## Task 2: Desktop visual foundation and SVG
Files: create components/ManholeVisualizer.tsx, styles/pulse.css and tests/visualizer.spec.ts; modify SensorOverview.tsx, Dashboard.tsx, App.tsx, utils.ts, NodeDrawer.tsx and index.html as needed for palette consistency.
- [x] Add browser assertions for backend-derived conditions, mixed hazards via controlled API responses, API outage, acknowledgement, stable SVG identity and reduced motion. Initial browser attempts encountered Edge restrictions and another project on default ports; final runs use 5174. Review regressions were observed failing before their corrections.
- [x] Build the technical cutaway and warm editorial dashboard. Use semantic palette tokens, preserve existing controls and all testable workflows. Keep existing responsive rules without expanding mobile scope.
- [x] Run lint, typecheck, production build and complete browser suite. Inspect desktop and projector screenshots; resolve observed defects.

## Task 3: Review and handoff
Files: PRD.md, PROJECT_STATE.md; review artifacts in ignored frontend/test-results.
- [x] Review changes independently for measurement correctness and regressions.
- [x] Confirm no backend/API/dependency modifications; record actual checks and limitations.
- [x] Prepare desktop screenshots for user review before 4B. No commit or push.

## Execution ledger
- Initial checkout clean; live remote main equals dd41d8a3fb21fd13faac4282867d6e78ca54513c.
- Ruling: retain the existing local environment on a feature branch rather than duplicate its SQLite/dependencies; no commit, merge or publication occurs.
- Task 1 complete: 10 condition tests passed after missing-module failure.
- Task 2 complete: full suite 23/23 passed in 44.2s; final lint, typecheck and production build passed.
- Final review: fresh read-only reviewer found no critical findings and two important findings. Fixed stale cover styling and telemetry timestamp labeling; both regression cases failed before correction and passed in the full suite.
- Review suggestions also addressed: SVG and gas-particle identity checks; larger operational captions/receipt type.
- Ruling: no physical projector/hardware validation was possible; browser inspection at 1920x1080 is explicitly a layout check, not hardware validation. Existing mobile regression passed, without new mobile design work.
- Visual QA: inspected desktop overview, gas, overflow, cover, partial, offline, simulator and raw-history drawer. 1366/1920 widths have no horizontal overflow; capture session had no page errors. Screenshots live under ignored frontend/test-results/m4a/.
- Task 3 complete: PRD and PROJECT_STATE updated; implementation stays uncommitted on codex/smart-manhole-pulse-4a for approval.
