# Smart Manhole Monitoring System

An educational ESP32 gas, overflow and cover-integrity monitoring demonstrator:
React/TypeScript/Vite, Tailwind, Leaflet, Recharts, Flask, SQLAlchemy and SQLite.
All included VIT Vellore placements and synthetic gas values are clearly fictional.
Physical ESP32 transport/calibration is not yet verified.

## Documentation

- [Product requirements](PRD.md)
- [Actual implementation, tests and developer handoff](PROJECT_STATE.md)
- [API contract](docs/api-contract.md)
- [Architecture and hardware integration](docs/integration.md)

## Start the Presentation

Dependencies are already installed on this machine. From the repository root:

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-demo.ps1
~~~

Open http://127.0.0.1:5173 after the launcher prints Ready. It prepares the database,
backs up/migrates older demo locations when needed, and starts Flask, Vite and
one standalone simulator worker. Keep this terminal open; Ctrl+C stops its children.
ExecutionPolicy applies only to this process, not global settings.
If ports are occupied, stop the existing project launcher or use:

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-demo.ps1 -BackendPort 5001 -FrontendPort 5174
~~~

The worker immediately emits seven fresh simulated observations, then repeats
approximately every 30 seconds. MH-007 is reserved offline. Scenario choices
persist across Flask and worker restarts; methane stays elevated until changed.
No browser-open or refresh preparation is needed once the launcher is running.
Laptop restart still requires starting the launcher again; no OS startup service
was installed. Plain Flask never starts background threads or emitters.

An OS lock per SQLite database prevents concurrent workers. The lock file is
ignored beside the database; never delete it to bypass a running worker.
The OS releases ownership after process exit/crash. Worker heartbeat is reported
in the API/UI; after emission stops, observations naturally age stale/offline.

## One-Time Installation

Use the existing backend/.venv on later sessions. Python dependencies must never
be installed globally. On a machine with a registered Python installation:

~~~powershell
if (-not (Test-Path backend/.venv/Scripts/python.exe)) {
    py -3 -m venv backend/.venv
}
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
Set-Location frontend
npm.cmd install
~~~

This machine's python alias/py registration did not work during initial setup.
Its environment was created using the available bundled Python 3.12.14:

~~~powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m venv backend/.venv
~~~

Do not rerun creation while the environment already exists. On another machine,
use its installed Python 3.12+; virtual environments are not portable.
Node.js 22.12+ is supported (22.16.0 used here). npm.cmd avoids PowerShell's
npm.ps1 execution-policy restriction. package-lock.json records resolved versions.

Optional activation, from backend/:

~~~powershell
.\.venv\Scripts\Activate.ps1
~~~

Activation is not required: all documented Python commands use the venv interpreter.
If activation is blocked by policy, continue with explicit interpreter paths.

## Demo Scenarios and Safe Baseline Restore

Simulator actions persist the chosen scenario and immediately write a reading
through the common ingestion service. Subsequent worker ticks use that scenario.
Supported interactive scenarios: Normal, Methane, H2S, Overflow and Cover.
MH-008 starts as partial/raw; MH-007 cannot be revived by simulator requests.

**Restore baseline** restores the intentional seven emitting-node scenarios in
one transaction and appends observations. It does not delete history, clear
incidents, reset acknowledgements or touch hardware nodes. Thus active incident
counts need not return to the original fixture's counts.

~~~powershell
$baseline = @{ confirm = 'restore_demo_measurements' } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:5000/api/demo/baseline -Method Post -ContentType 'application/json' -Body $baseline
~~~

Baseline: MH-001/002 normal, MH-003 methane, MH-004 H2S, MH-005 overflow,
MH-006 cover, MH-007 offline, MH-008 partial/raw. If MH-007 had fresh telemetry
before this upgrade, it ages offline normally; timestamps are never backdated.
Repeated hazards reuse unresolved incidents. Acknowledgement does not clear a
measurement. Restore normal, then resolve once fresh normal data confirms clearance.

## Database and Location Migration

SQLite lives at backend/instance/monitoring.db (ignored). Seeding creates eight
nodes, 200 illustrative historical readings and four incidents on an empty DB;
it skips existing node IDs and never wipes telemetry.

backend/app/demo_catalogue.py is authoritative (version vit-vellore-1).
Names refer to recognizable VIT campus zones; coordinates are approximate fictional
placements, not surveyed manholes. Before changing existing demo metadata,
SQLite's backup API creates a consistent copy under backend/instance/backups/.
Only catalogued IDs with is_demo=true migrate in place; PKs and reading/alert
foreign keys remain unchanged. Historical demo records now use those updated labels.

Preparation is idempotent: matching nodes cause no location update or redundant
backup. New demo_scenarios and demo_metadata tables are additive; no existing
telemetry tables are dropped or renamed. With the worker stopped, from backend/:

~~~powershell
$env:DEMO_ENABLED = 'true'
.\.venv\Scripts\python.exe -m flask --app app prepare-demo
~~~

The launcher does this automatically. Continuous operation appends readings;
stop the worker when not needed. No automatic deletion/retention is implemented.

## Manual Services and Configuration

For separate terminals, from backend/, first prepare as above. Start Flask:

~~~powershell
$env:DEMO_ENABLED = 'true'
.\.venv\Scripts\python.exe -m flask --app app run --host 127.0.0.1 --port 5000
~~~

Start the worker in another backend/ terminal:

~~~powershell
$env:DEMO_ENABLED = 'true'
$env:DEMO_EMITTER_ENABLED = 'true'
.\.venv\Scripts\python.exe -m app.demo_worker
~~~

--once or --ticks N gives a bounded worker run for verification.
From frontend/, npm.cmd run dev starts Vite; npm.cmd run build builds production
assets and npm.cmd run preview serves a local preview (not deployment).
Both Vite modes proxy /api to API_PROXY_TARGET (default http://127.0.0.1:5000).
Set that environment variable before Vite if Flask uses another port.
frontend/.env.example documents optional VITE_API_BASE (default /api).
Vite loads frontend .env files; backend .env files are not automatically loaded.

| Backend environment variable | Default | Purpose |
|---|---|---|
| DATABASE_URL | sqlite:///monitoring.db | Relative file lives in Flask instance directory |
| DEMO_ENABLED | false | Explicitly enables preparation, simulator and baseline restore |
| DEMO_EMITTER_ENABLED | false | Required in standalone worker; Flask never starts one |
| DEMO_INTERVAL_SECONDS | 30 | Emission period |
| METHANE_PPM_DEMO_THRESHOLD | 1000 | Educational inclusive methane threshold |
| H2S_PPM_DEMO_THRESHOLD | 10 | Educational inclusive H2S threshold |
| WATER_LEVEL_CM_DEMO_THRESHOLD | 80 | Educational water-height threshold |
| OFFLINE_TIMEOUT_SECONDS | 300 | Node communication timeout |
| SENSOR_STALE_SECONDS | 300 | Per-channel freshness / chart gap threshold |

Use finite positive settings and an emission interval shorter than freshness
timeouts. These thresholds are demonstration values, not certified safety limits.
Connectivity, current safety, last measured safety and freshness are separate.
An offline node's current safety is unknown, even if its last measurement was normal.
API-query time is not sensor receipt time. History uses numeric timestamps and
breaks gaps beyond freshness timeout; sparse seeded observations appear as points.

## Hardware-Only Testing

Stop the demo launcher/worker first. From backend/:

~~~powershell
$env:DEMO_ENABLED = 'false'
$env:DEMO_EMITTER_ENABLED = 'false'
.\.venv\Scripts\python.exe -m flask --app app init-db
.\.venv\Scripts\python.exe -m flask --app app register-node --node-id HW-001 --name 'ESP32 bench'
.\.venv\Scripts\python.exe -m flask --app app run --host 127.0.0.1 --port 5000
~~~

Do not recreate an existing registration. POST /api/reading accepts registered
hardware IDs, source=hardware and partial sensor fields. Simulator cannot write
hardware nodes; hardware cannot write demo nodes. Raw MQ values are uncalibrated,
never PPM; water_level_cm means height, not distance to the transducer.
GPIO, serial ports, calibration and geometry belong in firmware/an adapter.
See docs/integration.md for PowerShell/curl JSON examples.
No authentication, public hosting or remote actuator control is implemented.

## Verification

From backend/:

~~~powershell
New-Item -ItemType Directory -Force .tmp | Out-Null
$env:TEMP = (Resolve-Path .tmp).Path
$env:TMP = $env:TEMP
.\.venv\Scripts\python.exe -m pytest -q --basetemp=.tmp/pytest
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m compileall -q app tests
.\.venv\Scripts\python.exe tests/smoke_http.py
~~~

Backend tests and standalone HTTP smoke use isolated temporary SQLite files.
TEMP/TMP above avoids sandbox system-temp permission failures seen on this machine.

From frontend/:

~~~powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e
~~~

Browser tests require the active 30-second demo worker and both servers, normally
started by the launcher. They use installed Microsoft Edge and write only demo
readings/incident transitions to the local development DB; history is retained.
Set E2E_BASE_URL for another Vite port and E2E_BROWSER_CHANNEL for another installed,
supported browser. Tests do not install browsers or start servers.
Ignored frontend/test-results contains screenshots and traces.

OpenStreetMap tiles need internet. Tile failure is explicit; coordinates and the
node table remain available. API failures show an error/stale snapshot, never fixtures.

## 3-5 Minute Professor Demonstration

1. Show VIT Vellore's fictional map, live simulation, seven reporting nodes and MH-007 offline.
2. Select MH-001; point out its four current synthetic sensor values and receipt timestamp.
3. In Simulator trigger Methane hazard, then Inspect affected node to show values/history.
4. Use View corresponding incident and acknowledge: the measured hazard remains.
5. Return to Simulator; the node selection persists. Restore normal and show Normal selected.
6. Open the incident again and resolve after fresh normal telemetry. Explain restart
   persistence and that a physical ESP32 uses the same documented ingestion API.

## Development Approval

Every milestone requires verification, updated handoff docs and review.
Commit only with explicit approval; push only with separate explicit authorization.
Use the configured owner identity without identity overrides or co-author attribution.
