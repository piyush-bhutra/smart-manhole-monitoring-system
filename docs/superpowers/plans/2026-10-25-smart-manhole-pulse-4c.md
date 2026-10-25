# Milestone 4C — Complete UI Polish Implementation Plan

> Execute inline with superpowers:executing-plans. Preserve uncommitted 4A/4B work. No commits/pushes.

**Goal:** Cohesive, readable desktop presentation across dashboard, Alerts, Simulator and node details.
**Architecture:** Extend existing components and CSS. Reuse conditionView and ManholeVisualizer in the simulator; introduce a small threshold-relative gauge. Keep all backend and polling interfaces unchanged.
**Spec:** User's approved 4C request and PRD section 19.

## Design and constraints
Use a two-column scenario control/observed-state composition; static selection is explicitly not measured telemetry. Reuse the live cutaway instead of inventing a scenario preview or new renderer. Gauges are relative to backend demo thresholds, never chamber capacity or calibrated raw values. Enlarge sensor values, chart axes, operational text and action targets. Give the drawer a node selector, chart summary, threshold key and persistent header. Refine filters and interaction feedback without replacing the incident system. Desktop 1366/1920 only; retain existing regression behavior. No audio, dependencies, backend/schema/telemetry/worker changes.

## Tasks
- [x] Add failing browser checks for unsubmitted scenario selection, observed-state outage behavior, gauge accuracy/raw/stale handling, drawer navigation and history presentation.
- [x] Implement threshold gauges and simulator observed-state composition.
- [x] Refine drawer history/freshness/navigation, Alerts controls and shared typography/interaction styles.
- [x] Run lint/typecheck/build and complete browser suite; independent review and fixes.
- [x] Inspect/capture four views at desktop sizes; update PRD and PROJECT_STATE with verified results.

## Review focus
No optimistic hazard changes on radio selection or failed submit. Raw/missing readings cannot produce a calibrated gauge. API/detail error must invalidate current freshness claims. Drawer switching must not retain the previous node's history. Reduced motion preserves all information. New operational typography must not overflow desktop layouts.

## Execution ledger
Three new tests failed before implementation and passed afterward. Independent
read-only review found one important issue: reopening a detail-only failed snapshot
could clear its error before fetching successfully. Added a failing regression,
retained detail error until successful fetch, and verified it passes. No unresolved
review findings. Initial full suite passed33 tests; final suite **34 passed in1.6m**.
Final lint/typecheck/build passed. Captured/inspected dashboard, Alerts, Simulator,
drawer and chart at1366/1920; no horizontal overflow or capture page errors.
No backend/dependency changes, commits or pushes. No4D work. Detailed evidence and
remaining physical hardware/projector limitations are in PROJECT_STATE.md.
