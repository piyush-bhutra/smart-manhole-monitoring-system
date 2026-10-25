# Milestone 4B Implementation Plan

> Execute inline using superpowers:executing-plans. No commits or pushes.

**Goal:** Make incidents and map hazards recognizable through truthful motion and symbols.
**Architecture:** Extend the existing polling owner with incident identity tracking. Share lightweight SVG hazard symbols between cards and Leaflet markers. Reuse the 4A condition adapter for current physical safety.
**Tech Stack:** Existing React, TypeScript, CSS, Leaflet and Playwright only.
**Spec:** User-approved 4B request; PRD section 18.

## Design decisions
Use CSS/SVG rather than an animation dependency or canvas overlay: four hazard types and eight demo nodes do not require another rendering system. Keep the 4A identity and visualizer intact. A prominent incident ribbon sits above the selected asset; the detailed feed remains alongside the map. Symbols remain understandable without motion or color. Initial history is a baseline, never a new emergency. New IDs and actual lifecycle transitions receive bounded entrances/settling motion; repeated observations do not. Navigation can only resume an event's remaining time, never restart its full duration.

## Constraints and review focus
Desktop only; no audio; no API/database/worker/hardware changes. Offline, failed snapshots and stale channels suspend current hazard motion. All simultaneous hazards remain visible. Acknowledgement changes workflow only. Resolution is shown only after confirmed API state. Filtering/reordering/polling must not create arrivals. Recovery must preserve already-seen IDs. Reduced motion removes animation, not information.

## Tasks
- [x] Test incident baseline, new identity, repeated polls, acknowledgement, resolution and recovery.
- [x] Implement shared incident tracker in polling owner and bounded lifecycle presentation.
- [x] Implement hazard SVG symbols, prominent feed ribbon and physical-state map markers.
- [x] Browser-test arrival identity, lifecycle, multi-hazard/offline/outage and reduced motion.
- [x] Run lint, typecheck, build and complete browser suite; inspect desktop screenshots.
- [x] Update PRD and PROJECT_STATE with actual evidence and remaining limitations.

## Execution ledger
Implemented inline on the existing uncommitted 4A branch, preserving user edits.
No commits/pushes. Tracker tests initially failed because the module was absent,
then passed. Browser launch initially failed under restricted Edge process access;
normal approved Edge runs succeeded. Independent review reproduced recovery replay,
resolved physical-clear wording, and filtered transition disappearance. Regression
tests failed before corrections and passed afterward. The map native-title finding
was elevated to an accuracy issue and fixed with an accessible-label regression.
No review findings remain deferred. Natural ribbon wrapping fixed the existing
narrow-screen regression. Map zoom animation was disabled to remove a reproducible
Leaflet teardown callback error; hazard motion and map zoom controls remain.
Final lint/typecheck/build passed; complete suite **30 passed in 1.1 minutes**.
Desktop checks at 1366 and 1920 pixels passed with no overflow or page errors.
See PROJECT_STATE.md for files, screenshots and remaining hardware limitations.
