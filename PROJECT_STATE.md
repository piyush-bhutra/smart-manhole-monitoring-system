# PROJECT_STATE - Smart Manhole Monitoring System

**Updated:** 2026-10-14 IST.
**Milestone:** 3 implemented and verified; checkpoint approved by the user.
**Approval:** User authorized the M1-M3 checkpoint commit on 2026-10-14 IST with
message feat: build smart manhole monitoring platform. Push is NOT authorized.
Do not deploy or begin another major phase without explicit user approval.
**Sources:** PRD.md records approved scope; docs/api-contract.md v1.1 records actual
wire formats; README.md documents startup, configuration and the presentation script.

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

The full demo was started and left running for review. Do not start a second
launcher on occupied ports. The current supervisor was launched hidden, PID 60876;
verify its command line before stopping that exact process tree if needed.
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

## Verification Ledger

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

Branch main tracks origin/main.
Remote: https://github.com/piyush-bhutra/smart-manhole-monitoring-system.git
Previous baseline: 6ff2dd16081725b4e54bb6e3300b6e97c9d8906f
Previous message: chore: initialize project repository

This checkpoint includes M1/M2/M3 source, documentation and configuration.
Use git log -1 for its resulting hash; a commit cannot embed its own hash.
The initial setup remains the remote baseline until a separately authorized push.
Runtime dependencies, DBs/backups/locks, environment secrets and QA outputs are ignored.
Use only the configured owner's author/committer identity, without overrides,
co-author trailers, AI attribution or global Git identity changes.

The current checkpoint commit is explicitly approved. STOP after committing and
reporting the hash/status. Push needs separate explicit authorization. Future
commits still require approval; do not infer it from tests or milestone completion.
