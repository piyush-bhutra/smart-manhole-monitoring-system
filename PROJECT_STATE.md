# PROJECT_STATE - Smart Manhole Monitoring System

**Updated:** 2026-10-25 IST.
**Milestone:** 4A–4C implemented and verified; checkpoint publishing authorized.
**Approval:** User explicitly authorized one checkpoint commit on
`codex/smart-manhole-pulse-4a` and a normal push establishing its matching origin
upstream. No main-branch changes, history rewriting or 4D work are authorized.
The M1-M3 checkpoint remains the historical baseline.
**Sources:** PRD.md records approved scope; docs/api-contract.md v1.1 records actual
wire formats; README.md documents startup, configuration and the presentation script.

## Milestone 4C — Complete UI Polish & Interaction Refinement

Preserved the warm Pulse visual language, reactive cutaway, incident tracking and
hazard-aware map. Extended existing components without new dependencies or a
replacement architecture. Operational labels, controls, sensor values, table text
and chart composition are more legible at desktop presentation sizes.

Implemented:
- `ThresholdGauge.tsx` and SensorOverview: comparison bars for calibrated numeric
  observations against Flask demo thresholds, with an explicit threshold marker
  and percentage label. Scale clips visually at 200% while text retains the actual
  ratio. Raw/missing readings show no calibrated fill; stale comparisons are muted
  and last-known. Water comparison is not chamber capacity.
- Simulator: illustrated scenario tiles, a choose/send/observe sequence, explicit
  selection-only intent, clearer send/restoration feedback and the existing live
  ManholeVisualizer alongside controls. The live illustration consumes effective
  Flask observations and does not react optimistically to radio selection. Existing
  persisted-result, node/incident links and baseline controls remain functional.
- NodeDrawer: direct node selector, compact four-channel desktop sensor row,
  measured-hazard emphasis, larger chart, recorded min/max and demo-limit summary.
  Threshold lines extend the chart domain. Historical timestamps, gaps, raw units,
  cover interpolation, modal Escape and reduced-motion behavior are retained.
- Alerts: clearer filter surfaces, reset control, larger metadata, status badges
  and action targets. Existing motion and acknowledgement/resolution rules remain.
- `styles/refinement.css`: focused shared typography, spacing, surfaces, focus/hover
  feedback and loading feedback. New behavior tests live in `tests/polish.spec.ts`.

Accuracy and review:
- Detail errors and API loss suppress current/fresh claims in the drawer. An
  independent read-only review identified cached detail becoming apparently fresh
  when reopened after a detail-only failure. Reproduced with a failing browser test;
  `useMonitor` now retains the detail error until a successful detail response.
  The regression passes. No review findings remain unresolved.
- The first three new behavior tests failed before implementation and then passed.
  A full 33-test intermediate run passed before the additional review regression.
- Screenshot capture initially waited for a visible SVG line; a flat history can
  have zero-height bounds. Switched the capture readiness check to DOM attachment,
  then visually verified the actual line, axis, threshold and history summary.

### 4C verification and artifacts

- `npm.cmd run lint`, `npm.cmd run typecheck` and `npm.cmd run build`: passed.
  Final build: main JS 434.49 kB (133.12 kB gzip), drawer 372.01 kB (109.57 kB gzip),
  CSS 82.11 kB (21.17 kB gzip). Dependency manifests and lockfile unchanged.
- Final complete Playwright suite: **34 passed in 1.6 minutes**. Four new
  browser tests cover unsubmitted selection versus observed state, real scenario
  submission/API outage, raw/stale gauges, node navigation, modal dismissal, and
  cached-detail retry truthfulness. Prior 4A/4B and existing mobile regressions run.
- Dashboard, Alerts and Simulator at 1366 and 1920 pixels: no horizontal overflow.
  Capture session: no page errors. Both drawer sizes and history plots inspected;
  charts now occupy more of the visible drawer through the compact sensor row.
- Screenshots under ignored `frontend/test-results/m4c/`: dashboard, alerts,
  simulator, drawer and history with `-1366.png` / `-1920.png`; focused simulator
  compositions are `scenario-workspace-1366.png` and `scenario-workspace-1920.png`.
- Backend APIs/source, SQLite schema, simulator/worker behavior, launcher and
  telemetry contract unchanged. Integration tests append demo observations and
  workflow transitions without deleting history. Backend pytest was not rerun.
- Live review: http://127.0.0.1:5174. No known blocking issues. Physical hardware,
  calibration and an actual projector remain unverified; browser readability was
  inspected rather than claiming a physical classroom-distance test.

### Current next gate — 4C

4A–4C checkpoint publishing is now explicitly authorized. Await separate approval
before beginning 4D. Sound remains deferred.
The following sections retain the historical 4B, 4A and M3 evidence.

## Milestone 4B — Animated Incidents and Hazard-Aware Map

The 4A foundation and cutaway remain intact. Added a prominent graphite incident
watch ribbon above the selected asset and on Alerts, more legible incident cards,
and a larger campus map with illustrated markers. Shared SVG symbols distinguish
gas plumes, water rise/drop and a lifted cover; current map hazards have a restrained
attention ring. Acknowledgement quiets card motion while retaining hazard identity
and physical-condition text. No audio or new runtime dependencies were introduced.

Implementation:
- `services/incidentEvents.ts`: session-local identity/status tracker invoked by
  the existing `useMonitor` poll owner only on successful complete snapshots.
  Initial history is silent; new active IDs enter once. Updates to observation
  timestamps, repeat hazards, reordering and polling do not create arrivals.
- `IncidentShell.tsx`: 1.1-second entrance and 0.8-second settling animation with
  elapsed-time offsets. Route remounts and API recovery cannot replay a full event.
  Events expire on subsequent successful polls after eight seconds; filtered
  outgoing cards remain briefly to show the confirmed lifecycle transition.
- `HazardSymbol.tsx`, `HazardMarker.tsx`: shared SVG symbols. Leaflet icons retain
  DOM identity through React portals. Fresh effective channels independently drive
  map motion; stale/offline/API-failed states retain muted historical symbols with
  explicit unconfirmed safety. Simultaneous hazards remain visible together.
- `IncidentRibbon.tsx`, `AlertList.tsx`, Dashboard and Alerts: prominent incident
  watch, polite new-arrival announcements, hazard-specific card treatments and
  action-state transitions. Fresh-normal wording is independent of resolution
  eligibility. The live feed prioritizes newly arrived alerts.
- `styles/incidents.css`: motion, symbols, card surfaces and interaction feedback.
  Reduced-motion preferences remove animation while preserving geometry and labels.
  No mobile redesign; intrinsic ribbon wrapping preserves the existing regression.

Review and corrections:
- Independent read-only review found no critical issues. Reproduced and fixed
  recovery replay, misleading resolved-clearance text, and immediate removal in
  active/acknowledged filters. Browser regressions cover each.
- Corrected stale native map titles and accessible labels; they now update with
  current observations. This was treated as a safety-label accuracy issue.
- Rapid resize/navigation exposed Leaflet's delayed zoom-transition callback after
  map teardown (`_leaflet_pos`). Disabled map zoom animation, preserving zoom
  controls, fitting and all hazard motion. Rapid navigation now passes without errors.
- The first full run was 26/27: the new ribbon overflowed the existing mobile test.
  Natural wrapping fixed it without new mobile breakpoints. Initial restricted
  Edge launches failed; verified runs use installed Edge with approved process access.
- A temporary capture helper had an unused global declaration; corrected before
  the final lint run. An overlapping diagnostic test invocation invalidated some
  temporary trace files; subsequent verification runs are sequential.

### 4B verification and review artifacts

Commands from `frontend/`: `npm.cmd run lint`, `npm.cmd run typecheck`,
`npm.cmd run build`, and `E2E_BASE_URL=http://127.0.0.1:5174 npm.cmd run test:e2e`
(environment variable set with PowerShell syntax on Windows).

- Lint, typecheck and production build passed. Main JS 432.40 kB (132.52 kB gzip),
  lazy drawer 370.77 kB, CSS 73.37 kB. No dependency changes.
- Complete browser/condition suite: **30 passed in 1.1 minutes** on final files.
- Seven new tests cover tracker identity/lifecycle and actual Flask creation,
  repeated hazard deduplication, acknowledgement, safe restoration and resolution;
  controlled snapshots cover simultaneous hazards, offline/API failure, reduced
  motion, native accessible labels, filtered transitions and recovery/navigation.
- Real animated plume elapsed time advances; reduced motion disables its animation.
- Dashboard and Alerts checked at 1366 and 1920 pixels: no horizontal overflow.
  Corrected desktop capture session had no page errors. Visual inspection covers
  desktop dashboard, Alerts, map/feed and hazard-filtered cards.
- Screenshots: ignored `frontend/test-results/m4b/` contains `dashboard.png`,
  `desktop-1920.png`, `map-feed.png`, `alerts.png`, `methane.png`, `h2s.png`,
  `overflow.png`, `cover.png`. These show actual live demo records; acknowledged
  incidents remain hazardous wherever current measurements confirm danger.
- Backend source, API contract, SQLite schema, worker, launcher and dependency
  files are unchanged. Browser integration tests append demo readings/lifecycle
  transitions; they do not delete telemetry/history. Backend pytest was not rerun.
- Review remains local at http://127.0.0.1:5174 (Flask 5001). Physical ESP32 hardware,
  calibration and an actual projector remain unverified. No known blocking issues.

### Historical 4B next gate (superseded by 4C authorization)

Await user review of 4B. Do not commit, push or begin the next milestone. Sound is
explicitly deferred to 4D. The following 4A/M3 sections are historical evidence.

## Milestone 4A — Smart Manhole Pulse

Implemented a warm porcelain/graphite visual foundation, serif display typography,
semantic sage/vermilion/ochre/water colors and a prominent selected-asset cutaway.
Shared controls, table, map palette, incident surfaces and drawer/history colors
use the same foundation. Existing navigation and workflows remain in place.

New files:
- `frontend/src/services/conditionView.ts`: pure presentation adapter over effective
  sensor observations, API snapshot validity and backend threshold configuration.
- `frontend/src/components/ManholeVisualizer.tsx`: accessible inline SVG with
  bounded gas particles, rising/waving water, overflow spill and displaced cover.
- `frontend/src/styles/pulse.css`: visual tokens, desktop presentation and motion.
- `frontend/tests/condition-view.spec.ts`, `frontend/tests/visualizer.spec.ts`:
  state correctness and browser regression coverage.

Engineering decisions:
- Illustrations consume `node.sensors`, not the latest partial row, incident status
  or simulator radio selection. No new requests or polling loops were introduced.
- All simultaneous confirmed hazards remain visible. Raw gas never becomes PPM;
  missing water is not drawn as zero, and missing cover is explicitly unknown.
- The water drawing is relative to the configured overflow threshold, not measured
  chamber geometry or percentage capacity. Cover tilt and gas particles are symbolic.
- Per-channel stale observations are dimmed/frozen. Offline/API loss stops motion
  and removes current-safety claims in the selected-asset panel. Last telemetry
  always means `node.last_seen_at`, including during an API outage.
- Sensor cards and SVG elements retain identity across new reading IDs and polls.
  Acknowledgement cannot clear measured danger. Reduced-motion mode retains static
  hazard geometry and labels; no new animation dependency or audio was added.
- Styling is separated from existing layout rules. Existing mobile behavior was
  regression-tested, but no mobile redesign or responsive refinement was undertaken.

### Actual 4A verification — 2026-10-25 IST

| Check | Result |
|---|---|
| Clean baseline lint and typecheck | Passed before implementation |
| Frontend lint | Passed on final files |
| Frontend typecheck | Passed on final files |
| Production build | Passed; main JS 427.17 kB, lazy drawer 370.77 kB, CSS 66.05 kB |
| Complete Playwright suite, installed Edge | **23 passed in 44.2 seconds** |
| Desktop visual capture | 1440×1100 overview and all seven catalogue condition roles captured |
| Desktop/projector bounds | No horizontal overflow at 1366×768 or 1920×1080 |
| Capture-session browser page errors | None |
| Independent read-only code review | No critical findings; two important findings fixed and verified |
| Backend/API/dependency boundary | No changes to backend/**, API contract, integration doc, launcher or dependency files |

The suite includes the eight existing tests plus ten condition-adapter checks and
five visualizer browser checks. Coverage includes inclusive thresholds, combined
hazards, null/zero/raw channels, effective observations, mixed fresh/stale channels,
offline/API failure and recovery, reduced motion, real acknowledgement and repeated
readings without SVG/particle remounting. Existing tests still exercise the real
30-second emitter and the acknowledge/normal/resolve workflow.

Review fixes were reproduced with failing browser assertions before correction:
stale cover geometry needed per-channel historical styling; the telemetry footer
incorrectly used a snapshot label during outage. Both now pass. Operational sensor
captions and receipt text were enlarged after the desktop review.

Initial browser attempts were blocked by the restricted Edge profile environment,
then hit another project's default ports. The verified runs used normal installed
Edge access and `E2E_BASE_URL=http://127.0.0.1:5174`. No other project's services
were stopped or modified. A temporary screenshot helper initially caused lint
global-name errors; its browser globals were declared and the final lint passed.
The Node NO_COLOR/FORCE_COLOR warning is runner environment noise, not an app error.
Backend pytest was not rerun in 4A; M3 backend results below are historical.

### Review environment and artifacts

The existing demo launcher is running on alternate ports because another project
occupies 5000/5173:
- Dashboard: http://127.0.0.1:5174
- Flask: http://127.0.0.1:5001
- Supervisor started for this review: PID 20560. Verify its command line before
  stopping it; process IDs are temporary. It was launched hidden.

Screenshots in ignored `frontend/test-results/m4a/`: `desktop-overview.png`,
`desktop-full.png`, `projector-1920.png`, `normal.png`, `methane.png`, `h2s.png`,
`overflow.png`, `cover.png`, `offline.png`, `partial.png`. Desktop states, simulator,
drawer and chart were visually inspected. Browser integration tests append demo
readings and incident lifecycle transitions to the local database as documented;
no telemetry/history deletion occurred. Physical hardware and an actual projector
remain unverified.

### Historical 4A next gate (superseded by 4B authorization)

User reviews 4A screenshots and behavior. 4B remains unimplemented: incident entrance
tracking, unacknowledged pulses, lifecycle animation and hazard-specific map markers.
Optional browser sound is also deferred. No commit/push or 4B work without approval.

### Repeat animation review — 2026-10-25 IST

User requested a fresh website/animation check for teammate review. No application
source changes were made. Fresh frontend lint and production build passed; the
complete existing Edge Playwright suite passed **23 tests in 1.2 minutes** against
http://127.0.0.1:5174. Direct browser sampling confirmed changing animation times
and transforms for water waves, gas particles and overflow spill; the offline
wave remained paused with unchanged time/transform. The manual browser session
reported no console errors or warnings. Reduced motion, outage/recovery and
acknowledgement behavior passed the existing browser assertions.

Shareable browser-frame GIF, condition comparison and review instructions are in
`docs/reviews/2026-10-25-animations/`. GIF playback timing is approximate; use the
live dashboard to assess actual smoothness. Review captures cover normal,
methane, H2S, overflow, displaced cover, offline and partial/raw states at
1440×1000. No physical projector/hardware, remote hosting, 4B work, commit or push
was included. The documented browser suite appended demo observations and
performed demo incident transitions without deleting history.

The following sections retain the M3 architecture and historical verification ledger.

## Briefing

Educational ESP32 monitoring demonstrator with React/TypeScript/Vite, Flask,
SQLAlchemy and persistent SQLite. Fictional placements now use VIT Vellore.
Synthetic readings and raw gas values are explicitly distinguished from calibrated
hardware measurements. Physical hardware, gas calibration and ESP32 transport
have not been verified.

## Repository Structure

~~~
start-demo.ps1              # supervised local demo launcher
README.md
PRD.md
PROJECT_STATE.md
backend/
  requirements.txt
  pytest.ini
  app/
    __init__.py            # factory, CLI; never starts background emitters
    config.py              # demo flags default false
    models.py              # Node, Reading, Alert, DemoScenario, DemoMetadata
    services.py            # shared ingestion, safety, freshness, serialization
    routes.py              # original API plus confirmed baseline endpoint
    seed.py                # idempotent historical demo seed
    demo_catalogue.py      # authoritative vit-vellore-1 locations/scenarios
    demo.py                # backup, migration, lock, scenarios, ticks, baseline
    demo_worker.py         # standalone locked emitter
  tests/
    conftest.py
    test_backend.py
    test_demo.py
    smoke_http.py
  .venv/                   # existing environment reused; ignored
  instance/                # monitoring.db, backups, OS lock; ignored
  .tmp/                    # local logs and test temp files; ignored
frontend/
  package.json
  package-lock.json
  vite.config.ts
  playwright.config.ts
  src/
    App.tsx                # shared selection, polling, incident navigation
    config.ts              # VIT region fallback
    styles.css
    types/api.ts
    services/api.ts
    services/history.ts    # numeric timestamps and explicit null gap points
    hooks/useMonitor.ts
    components/            # SensorOverview, NodeMap, NodeDrawer, AlertList, badges
    pages/                 # Dashboard, Alerts, Simulator
  tests/
    dashboard.spec.ts
    history.spec.ts
  test-results/            # ignored browser QA artifacts
  .tmp/                    # ignored responsive screenshots
docs/
  api-contract.md
  integration.md
~~~

Python 3.12.14 in backend/.venv; all backend commands use that interpreter.
Node 22.16.0; npm.cmd avoids PowerShell npm.ps1 policy restrictions.
No new runtime dependencies were added in M3. Existing frontend lockfile and
backend requirements.txt remain the dependency authorities.

## Start and Stop

From repository root:

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-demo.ps1
~~~

Frontend: http://127.0.0.1:5173
Backend health: http://127.0.0.1:5000/api/health

The M3 demo was previously left running at its review checkpoint; that old process
record is historical. Use the 4A alternate-port review environment above for the
current session. Do not start a second launcher on occupied ports.
Normal interactive launcher sessions stop their children with Ctrl+C.
README documents alternate ports, separate terminals, venv creation/activation,
installation and hardware-only startup. No OS startup service or deployment exists.

## Implemented M3 Behavior

- Explicit demo mode prepares eight fictional nodes and emits seven observations
  immediately, then approximately every 30 seconds through the existing service.
- MH-007 remains reserved offline. MH-008 demonstrates partial/raw gas telemetry.
- Per-node scenarios persist in SQLite; ticks and Flask restarts retain choices.
- A per-database OS file lock prevents duplicate workers. Flask's app factory and
  development reloader never spawn workers. Worker exit/crash releases the lock.
- Both DEMO_ENABLED and DEMO_EMITTER_ENABLED default false. Start-demo enables them
  only in its process environment. No simulated hardware-node writes are permitted.
- Restore baseline is one confirmed transaction; it restores measurements/scenarios,
  appends seven readings, and preserves all incident lifecycle/history.
- Legacy computed_status remains. Additive connectivity, safety_status,
  last_measured_safety, reading_freshness and demo_scenario separate stale facts
  from current conditions. Offline current safety is always unknown.
- Summary adds demo_session, latest_telemetry_at and sensor_stale_seconds.
  POST /api/demo/baseline is documented; POST /api/reading remains compatible.
- Dashboard exposes selected-node sensors, a readable VIT map, explicit API-check
  versus emission timestamps, connectivity/freshness, and prioritized incidents.
- Simulator preserves node/scenario selection and provides node/incident links.
  Restore normal updates the selected radio and retains the corresponding incident.
- Alerts default to unresolved; historical incidents remain available. Disabled
  resolution explains hazardous, stale or incomplete measurements.
- Charts use numeric epoch milliseconds and explicit null gaps beyond the configured
  freshness interval. Null channels and raw/PPM distinction remain intact.
- Lightweight transitions honor reduced motion. Desktop/mobile layouts were inspected.

## Migration and Data Preservation

Catalogue version: vit-vellore-1. Coordinates are approximate fictional placements,
not surveyed manholes. Only allowlisted demo rows migrate, preserving primary keys.
Hardware rows are excluded even when an ID collides with the catalogue.

Actual pre-migration backup:
backend/instance/backups/monitoring-pre-vit-vellore-1-20261013-180909-017768.db

First preparation migrated eight existing nodes and seeded zero. Second preparation
migrated zero and created no redundant backup. Isolated tests also verify rollback,
foreign keys, hardware preservation and idempotence.

Direct comparison after browser tests confirmed all 270 original reading rows
remain byte-for-value identical, all 15 original incident IDs remain present,
and all eight node IDs remain. There were 713 readings and 22 incidents at that
inspection; these are not fixed fixture counts because the worker/tests append data.
SQLite integrity_check returned ok; foreign_key_check returned no violations.
Existing incidents may legitimately have changed lifecycle during operator tests.

## Milestone 3 Verification Ledger (Historical)

| Check | Result |
|---|---|
| Backend venv pytest, isolated SQLite | 46 passed in 11.25 seconds |
| Backend pip check | No broken requirements |
| Backend compileall app/tests | Passed |
| Frontend npm.cmd run lint | Passed |
| Frontend npm.cmd run typecheck | Passed |
| Frontend npm.cmd run build | Passed; main 418.18 kB, lazy drawer 370.72 kB |
| Frontend npm.cmd run test:e2e | 8 passed in 43.6 seconds, installed Edge |
| Dashboard/Alerts/Simulator widths | No page overflow at 320, 768, 1920 pixels |
| Desktop/mobile visual QA | Map, dashboard, simulator, incidents and drawer inspected |
| Actual DB backup comparison and integrity | Passed, original readings and record IDs preserved |
| Live duplicate worker attempt | Rejected as expected while active worker owned database |
| Git diff/status and exclusions | Reviewed; no commit or push |

Pre-checkpoint verification on 2026-10-14 IST: backend venv pytest passed all
46 tests in 11.09 seconds; frontend lint and typecheck passed. The production
build was also rerun for the checkpoint. Browser results above are from M3
verification, not a new checkpoint browser run.

Backend coverage includes original validation/hardware compatibility, scenario
persistence across app recreation, real worker emission beyond shortened offline
timeouts, OS lock exclusion/release, reloader-safe disabled defaults, duplicate
incident prevention, acknowledgement and resolution, reserved offline behavior,
migration rollback/idempotence/hardware preservation, and safe baseline restoration.

Browser coverage includes API-derived metrics and map coordinates, raw charts,
API outage/recovery, tile failure, mobile navigation, filters, node drawer,
acknowledge/normal/resolve lifecycle, a real 30-second tick retaining the selected
hazard, direct incident navigation, and numeric time/gap/null chart transforms.
Browser tests mutate only the development demo namespace and preserve history.
Expected network failures are deliberately induced by error-state tests.

Backend test command from backend/:

~~~powershell
$env:TEMP = (Resolve-Path .tmp).Path
$env:TMP = $env:TEMP
.\.venv\Scripts\python.exe -m pytest -q --basetemp=.tmp/pytest
~~~

Frontend checks run from frontend/. Browser tests require the active launcher;
they do not start services. The M1 isolated HTTP smoke passed previously; M3
verification uses the complete regression suite and live browser API workflows.
Do not describe historical checks as fresh executions.

## Important Decisions and Limitations

Normal readings never auto-resolve incidents. Acknowledgement does not clear a
hazard. Resolution requires online, fresh normal observations for the relevant
channel. Raw ADC never establishes PPM safety; missing values never become zero.
The worker serializes ticks/scenario writes with SQLite transactions.

No known failing checks remain. Hardware transport, calibration, physical
actuators and remote networking remain untested. Map tiles require internet;
failure stays visible and coordinate markers/table remain usable.
There is no authentication, public hosting, pagination, automatic retention,
or general schema-migration framework. Continuous demo operation grows SQLite;
stop the worker when not needed. The additive demo tables use create_all without
rewriting original telemetry tables. No remote actuator control is implemented.

Windows sandbox occasionally blocks system temp, Vite realpath or child browser
processes. Tests used ignored local temp paths and permitted elevated execution;
no global Git, Python or execution-policy configuration was changed.

## Git and Approval

Current work branch: codex/smart-manhole-pulse-4a. The baseline main tracks origin/main.
Remote: https://github.com/piyush-bhutra/smart-manhole-monitoring-system.git
Previous baseline: 6ff2dd16081725b4e54bb6e3300b6e97c9d8906f
Previous message: chore: initialize project repository

This checkpoint includes M1/M2/M3 source, documentation and configuration.
Use git log -1 for its resulting hash; a commit cannot embed its own hash.
Live remote check on 2026-10-25 confirmed origin/main and local baseline both at
dd41d8a3fb21fd13faac4282867d6e78ca54513c. No remote changes were made in 4A.
Runtime dependencies, DBs/backups/locks, environment secrets and QA outputs are ignored.
Use only the configured owner's author/committer identity, without overrides,
co-author trailers, AI attribution or global Git identity changes.

The user subsequently authorized publishing completed 4A–4C on
`codex/smart-manhole-pulse-4a`, establishing `origin/codex/smart-manhole-pulse-4a`
as upstream, with message `feat: redesign smart manhole monitoring interface`.
Fresh pre-commit verification on 2026-10-25 passed lint, TypeScript checking,
production build, and all 34 Playwright tests (1.5 minutes). The full frontend
suite includes real Flask incident creation, polling, acknowledgement and resolution.
Backend code and contracts are unchanged; backend pytest was not rerun for this
frontend checkpoint. Fetch succeeded; HEAD and origin/main matched the baseline
above, and the new work branch did not yet exist on origin.
Only approved frontend source, tests and project documentation enter this checkpoint.
The two review images and their companion note remain local and untracked;
dependencies, database files and generated test/build outputs remain excluded.
Use Git history and branch tracking to confirm the resulting commit and push state.
Separate explicit approval is required for Milestone 4D.
