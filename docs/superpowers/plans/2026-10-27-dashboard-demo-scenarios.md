# Dashboard Sample Scenarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Present three automatic, restartable sample scenarios inside the existing dashboard, even with every API request unavailable.

**Architecture:** Keep the existing live workspace as its own mounted component and switch to an isolated sample workspace. Both reuse Dashboard, Alerts, NodeDrawer, condition/map/incident rendering and opt-in sound. A pure timeline supplies sample snapshots and history; a hook owns one bounded playback clock.

**Tech Stack:** Existing React/TypeScript/CSS, Leaflet, Recharts and Playwright. No new dependencies/backend changes.

**Spec:** `docs/superpowers/specs/2026-10-27-dashboard-demo-scenarios-design.md`

**Execution status:** Completed on 2026-10-27. Final frontend lint/typecheck/build passed; full Edge suite 56/56 (1.8 minutes). Read-only review findings reproduced and fixed. Details and limitations are recorded in PROJECT_STATE.md. User subsequently authorized commit/push to the development branch; this supersedes the original no-commit/no-push constraint below, without authorizing main merge or deployment.

## Global Constraints

- Automatic playback and Restart only; no additional playback controls or automatic loops.
- Same website, clearly marked Simulated demonstration, no API reads/writes from the sample workspace.
- Three 48-second scenarios: gas, campus incidents, combined hazards. Normal baseline followed by staged events and final-state hold.
- Preserve hardware data, real history, reduced motion, sound opt-in and real incident semantics.
- No commit, push or merge. Execute inline in the current checkout on `codex/dashboard-demo-scenarios`; preserve unrelated untracked artifacts.

## Review Focus

- Initial API failure must not prevent entry into samples (Task 2 browser test).
- Restart/switch/unmount must cancel old clocks and sound, including late live responses (Task 2 browser tests).
- Partial recovery must not hide the remaining simultaneous hazard or resolve incidents (Task 1 timeline tests).
- Detail/history and navigation in samples must never fetch real data or enable mutations (Task 2 browser test).
- Completion, repeated switches, reduced motion and projector/mobile layout must remain usable (Task 3 verification).

### Task 1: Deterministic sample timeline

**Files:** Create `frontend/src/services/sampleScenarios.ts`, `frontend/tests/sample-scenarios.spec.ts`.

**Interfaces:** `SampleScenarioId`, `sampleScenarios`, `buildSampleFrame(id, elapsedSeconds, startedAt): SampleFrame` where SampleFrame includes snapshot, history by node, stage, focusId, elapsed/duration/completed. Data uses existing API presentation types, with a frontend-only `sample` indicator in Snapshot.

- [x] Write tests with hand-derived assertions for normal baseline, staged hazards, independent overlapping hazards, recorded crossing timestamps/history and final open incidents.
- [x] Run the focused test, confirm missing timeline export fails before implementation.
- [x] Implement pure timeline generation with eight local fictional campus nodes, fixed educational thresholds 1000/10/80, bounded time, derived counts and per-run timestamps. Generate sample event changes every 8 seconds and observation history at deterministic intervals. Persist incidents within the run after measurements normalize.
- [x] Run focused tests; expect all pass.

### Task 2: Mode isolation and existing dashboard presentation

**Files:** Create `frontend/src/hooks/useSamplePlayback.ts`, `frontend/src/components/WorkspaceMode.tsx`, `frontend/src/pages/SampleWorkspace.tsx`, `frontend/src/styles/samples.css`, `frontend/tests/sample-playback.spec.ts`. Modify `App.tsx`, `main.tsx`, `types/api.ts`, `Dashboard.tsx`, `SensorOverview.tsx`, `NodeDrawer.tsx`, `AlertList.tsx` only where needed for mode switch/read-only labels.

**Interfaces:** App mounts either LiveWorkspace or SampleWorkspace. WorkspaceMode accepts `sample: boolean`, `onChange: () => void`, optional disabled. SampleWorkspace receives `onLive: () => void`; useSamplePlayback supplies frame, selected scenario and restart/select callbacks with a new run identity.

- [x] Write browser tests blocking all API traffic: entry on initial failure, automatic progression/restart/final hold, switching scenarios, local details/history, disabled incident controls, no reads/writes after entry, Live return and reduced-motion/audio isolation.
- [x] Run one entry test; expect missing Demo scenarios tab failure before implementation.
- [x] Add mode switch outside live-data gating. Unmount LiveWorkspace to cancel polling/tracker/audio; disable entry while a live mutation is in flight.
- [x] Implement sample hook with one elapsed clock per mounted run, clean cleanup, clock clamp at 48 seconds and independent tracker per run. Restart/scenario change remount run audio/clock state.
- [x] Reuse actual Dashboard, Alerts and NodeDrawer, with sample-specific receipt captions and read-only action guards. Keep all details/history local. Show persistent scenario/stage/progress, selector and Restart; no API warning in samples.
- [x] Style within existing Pulse tokens, with keyboard focus and responsive wrapping. Use locally available assets; external tile failure must leave location/marker information usable.
- [x] Run focused sample tests; expect all pass.

### Task 3: Verification, review and documentation

**Files:** Modify README.md, PROJECT_STATE.md, PRD.md; add ignored visual captures/logs only.

- [x] Run frontend lint, typecheck and build; complete Edge suite against an isolated temporary demo database. Report any failures honestly.
- [x] Inspect samples with API blocked at 1366x768/1920x1080 and existing mobile bounds. Capture gas/multinode/combined/recovery/completed screens and check browser errors.
- [x] Have a fresh reviewer inspect code, design and tests. Reproduce important findings with failing tests, fix and rerun appropriate checks.
- [x] Update project documentation with verified results and startup instructions for samples with frontend only. Keep separate-site/offline-install/firmware/public-hosting claims out.
- [x] Record completion in this plan's progress ledger. Leave work uncommitted for user review.
