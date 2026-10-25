# Product Requirements Document — Smart Manhole Monitoring System

**Version:** 1.4 (Milestone 4C, complete UI polish and interaction refinement; 2026-10-25 IST)
**Status:** Approved baseline for initial implementation (subject to user review)  
**Project:** Smart-Manhole Gas, Overflow & Tamper Monitor  
**Type:** Embedded Systems & IoT college project / municipal monitoring demonstrator  
**Primary target:** A polished, reliable, locally runnable full-stack website, built in one evening, compatible with future ESP32 integration.

## 1. Basis and scope

The team's Project Review-I document specifies an ESP32-based node measuring methane (MQ-4), hydrogen sulfide (MQ-136), water level (HC-SR04), and cover displacement (ADXL345); GPS and cellular modules are intended for location-tagged uplink. It explicitly calls for a **Flask REST server, SQLite database, live dashboard, geographic map, trend graphs and alert log**, with incoming HTTP POST telemetry. This PRD translates those commitments into a practical, software-first MVP. Hardware connectivity and gas calibration are not assumed to be operational yet.

**Core philosophy:** Build the real frontend, real backend, real database, and realistic demo pathways now. Replace simulated telemetry with hardware telemetry later without rewriting UI components.

## 2. Goals and non-goals

### Goals
1. Demonstrate monitoring of 8–10 clearly simulated manhole nodes near VIT Vellore on a responsive, visually polished municipal operations dashboard.
2. Store and retrieve readings and incidents in a real SQLite database through Flask.
3. Display node location/status on an interactive map, sensor history in charts, and incident history in an alerts table.
4. Trigger scenarios via an isolated demo simulator that uses the same core ingestion and hazard detection pipeline as telemetry.
5. Define and document a stable ingestion contract for a later ESP32 sender, including partial readings and raw/un-calibrated sensor output.
6. Support an understandable integration workflow for a hardware teammate using a sample cURL/PowerShell request.
7. Maintain precise development documentation and require user approval before commits or pushes.

### Non-goals (this build)
Authentication, multi-tenant support, SMS, mobile app, predictive ML, field-certified safety logic, automated physical fan control from the web UI, cloud deployment, device OTA updates, sophisticated reporting, and expensive third-party map services. Do not add these opportunistically.

## 3. Primary users and demonstrations

**Operator:** Sees high-level status, filters for affected nodes, inspects a manhole, examines trends, and acknowledges an incident.

**Student demonstrator:** Opens the app with preloaded realistic sample data, selects a manhole in the simulator, triggers methane/H2S/overflow/cover displacement, observes map/status/alert/chart changes, then restores normal readings.

**Hardware teammate:** Sends HTTP POST JSON to a documented ingest API from an ESP32 or test client. No frontend code changes should be needed for supported fields.

## 4. UX and visual specification

- Smart Manhole Pulse: warm porcelain/ivory surfaces, graphite navigation and typography, vermilion hazards, ochre uncertainty, sage normal conditions and muted industrial blue for water. Milestone 4A targets desktop/projector use; the user excluded new mobile layout and responsive refinement work. Preserve existing navigation and layout functionality.
- Modern typography, accessible contrast, subtle hover/focus feedback, smooth 150–250ms transitions; animate chart updates and alert arrivals lightly, avoiding heavy 3D/particle effects and excessive libraries.
- Professional—not futuristic clutter, fake numerical precision, or an incoherent collection of charts.
- Navigation: **Dashboard**, **Alerts**, **Simulator**. Node detail as modal/drawer/panel on dashboard, not an extra mandatory page.
- Explicit **Demo Data** / **Simulated** labeling when applicable; no live-hardware claims unless actual hardware telemetry is present.
- Accessible empty, loading, error, last-updated, and offline states. No success notifications for failing API calls.

### Dashboard content
- Header: app name, mode/source indicator, freshness timestamp.
- KPI cards: total nodes, safe, hazard, offline, active incidents.
- Interactive Leaflet/OpenStreetMap map with pins for seeded nodes. Markers link to the same node details used in node list. Keep sample coordinates in a coherent demonstrative location and label them fictional/demonstration placements.
- A node table/list with node ID, location, computed status, latest update, sensor readings.
- Recent alerts feed.
- Node detail panel: latest readings and correct units, clear unknown/raw indicator, cover flag, and time-series charts for available readings.

### Alerts content
- Incident list/table: ID, node, type, severity, first triggered, latest observed, status, source.
- Status workflow: active → acknowledged → resolved (resolution allowed only under an explicit rule and not represented as resetting physical actuators).
- Make acknowledgement distinct from physical hazard clearance. If underlying hazard is still present, the node stays hazardous, even if acknowledged.
- No repeated new incident on every abnormal reading for the same unresolved node/hazard pair.

### Simulator content
- Select node and scenario: Normal, Methane elevated, H2S elevated, Water overflow, Cover displaced.
- Trigger action sends data through real Flask logic and writes to SQLite; UI updates on next poll/refetch.
- Restore safe values, optionally send several periodic sample points, and show a prominent simulator label.
- Simulator must not silently override physical-node telemetry. Restrict simulator to demo nodes/explicit demo namespace or a configured development mode.

## 5. Technology and repository layout

**Frontend:** React, TypeScript, Vite, Tailwind CSS, Lucide React icons, React Leaflet / Leaflet, Recharts. Avoid heavyweight UI and animation packages unless demonstrably necessary.

**Backend:** Python 3.x, Flask, Flask-CORS if needed for local split ports, SQLAlchemy (Flask-SQLAlchemy optional), SQLite, pytest.

**Python environment:** `backend/.venv` only; no global pip installs; `backend/requirements.txt`; `.venv` excluded by `.gitignore`.

**Repo structure:**

```
/
  README.md
  PRD.md
  PROJECT_STATE.md
  .gitignore
  backend/
    .venv/                 # ignored
    requirements.txt
    app/                   # routes, models, services, config
    tests/
    instance/              # optional ignored DB files
  frontend/
    package.json
    src/
      components/
      pages/
      services/
      types/
  docs/
    api-contract.md
    integration.md
```

Frontend is a client of Flask JSON endpoints; components must not embed assumptions about UART/COM ports, ESP32 GPIO numbers, SIM module, networking method, or sensor conversion circuitry. Such values live in ESP32 firmware / adapter/config.

## 6. Data model

**nodes**: `id` (text PK, e.g. `MH-001`), `name`, `location_description`, `latitude` (nullable), `longitude` (nullable), `is_demo`, `created_at`, `last_seen_at` (nullable). Optionally `installation_notes`.

**readings**: `id` (integer PK), `node_id` (FK), `received_at` (UTC ISO8601), `device_timestamp` (nullable), `methane_raw` (nullable numeric), `methane_ppm` (nullable numeric), `h2s_raw` (nullable numeric), `h2s_ppm` (nullable numeric), `water_level_cm` (nullable numeric), `cover_displaced` (nullable bool), `source` (`simulator`/`hardware`), optionally raw JSON for debug. A null field is *unknown*, not 0.

**alerts**: `id`, `node_id` FK, `alert_type` (`methane`/`h2s`/`overflow`/`cover`), `severity`, `status` (`active`/`acknowledged`/`resolved`), `triggered_at`, `last_observed_at`, `acknowledged_at` nullable, `resolved_at` nullable, `notes` nullable, `source`.

Configuration: separate backend-configurable `METHANE_PPM_DEMO_THRESHOLD`, `H2S_PPM_DEMO_THRESHOLD`, `WATER_LEVEL_CM_DEMO_THRESHOLD`, `OFFLINE_TIMEOUT_SECONDS`, polling rate, API URL, demo settings. Numeric defaults chosen for visual demonstration are **not certified safety values**; label as demo-only.

## 7. Status and alert logic

- Node **offline** if never received data or last reading older than configured timeout; **hazard** when a currently known unsafe condition is present; **safe** only when available valid measurements are within demo thresholds and no displaced cover is reported; **unknown/partial** when data is insufficient. Specify precedence explicitly in implementation and tests.
- Readings may omit sensors. Preserve last known values as historical facts, but clearly show per-sensor freshness; never interpret null/missing as safe or zero.
- PPM thresholds apply only to `*_ppm`, *never* blindly to raw ADC values. Raw data should display labeled `raw / uncalibrated` and not trigger PPM threshold alerts until properly mapped/calibrated.
- Cover displacement `true` triggers a cover event; water-level interpretation depends on the measured physical quantity. For this MVP `water_level_cm` explicitly means **water height**, not ultrasonic *distance to surface*. Firmware or ingestion adapter must convert distance to height using physical installation geometry.
- On a transition to hazard, create a new incident unless there is already an unresolved incident of that type for that node; update observation time on continued hazard. On return to normal, the physical status clears; an existing incident remains in history, with resolution behavior documented. Acknowledgement is only an operator workflow, not a physical reset.
- Offline is separate from a measured safety conclusion. A node with stale readings cannot be called currently safe.

## 8. API contract (freeze before parallel work)

Base: `/api`; JSON requests/responses, consistent JSON errors; timestamps UTC ISO8601 with timezone suffix.

### Ingest
`POST /api/reading`:

```json
{
  "node_id": "MH-001",
  "source": "simulator",
  "methane_raw": null,
  "methane_ppm": 120.0,
  "h2s_raw": null,
  "h2s_ppm": 4.2,
  "water_level_cm": 32.0,
  "cover_displaced": false,
  "latitude": 12.9716,
  "longitude": 77.5946
}
```

Required: `node_id`, `source`, at least one actual sensor/cover field. All other values optional/nullable. Strict validation: reject nonnumeric strings for numeric fields, impossible latitude/longitude, negative ppm/height, invalid source, empty node IDs. Require API-key/token protection for real remote ingestion before exposure to the public internet; **local-only development does not imply a production security posture**. Simulator endpoint gated by an explicit demo/dev setting. Server controls `received_at`; don't trust client-supplied status. Do not claim cryptographic device security is already implemented.

Successful response: `201` with `reading_id`, `node_id`, `computed_status`, `created_alert_ids`, `received_at`.

### Read/query
- `GET /api/health` → `{ "status": "ok" }`
- `GET /api/summary` → totals and counts, `generated_at`.
- `GET /api/nodes` → array of nodes with latest reading and computed status.
- `GET /api/nodes/<node_id>` → details with latest reading and computed status.
- `GET /api/nodes/<node_id>/readings?range=1h|24h|7d` → ordered readings.
- `GET /api/alerts?status=active|acknowledged|resolved|all` → incidents.
- `PATCH /api/alerts/<alert_id>` → supported status transition and optional notes; validations and sensible errors.
- `POST /api/simulator/scenario` → `{ "node_id": "MH-001", "scenario": "methane" }` (demo-only); produces a reading using the same service function as `/api/reading`.

**Integration note:** The paths and field names above are the shared interface. Update `docs/api-contract.md` and this PRD through an explicit review if changing these after backend/frontend development starts.

## 9. Demo dataset

- On explicit demo preparation, seed 8 fictional/demo nodes with coherent VIT Vellore example locations from a central versioned catalogue, distinct IDs, and synthetic historical trends. Existing nodes/history are not replaced.
- Include at least one safe node, elevated gas node, high-water node, cover-displaced node, and offline node.
- Label all seeded records simulated; seeded demo history is illustrative, not scientifically validated sensor output.
- Seeding must be idempotent and must not overwrite genuine hardware readings or wipe an existing database on restart.
- Should the backend be unavailable, the frontend displays an explicit connection-error state, **not silently revert to fake readings**. Once seeded, data lives in SQLite, not as hidden frontend truth.

## 10. Hardware integration plan

- ESP32 code generates the documented field names; the dashboard knows nothing about GPIO pin assignments or COM ports.
- Node ID is stable and agreed with hardware teammate; hardware can initially POST to a local Flask host via appropriate network access. USB serial testing needs a separate bridge or script, not a browser feature.
- Cellular deployment requires a network-reachable, appropriately secured endpoint; localhost on a laptop is not reachable from a remote cellular modem.
- GPS coordinates may be seeded at installation and remain optional in telemetry (GPS coverage underground may be unreliable).
- For raw MQ outputs, display `raw` and document calibration rather than mislabel ADC values as ppm.
- Keep original sensing and on-device buzzer/LED/relay safety behavior isolated from website and cloud availability. The MVP dashboard has no remote actuator control.
- Include minimal examples for Windows PowerShell and curl, a sample ESP32 JSON body, and where to update server URL and node IDs.

## 11. Performance and reliability

- Aim for responsive use with 10–20 demo nodes and hundreds of readings per node.
- Frontend polling default around 5 seconds; do not start several duplicate polling loops; cleanup on unmount.
- Handle empty DB, stale data, unexpected API errors, network failures, and chart gaps gracefully.
- Use SQLite transactions, parameterized ORM queries, and input validation.
- Separate repeatable tests from mutable demo data; tests must not run against the real development database.

## 12. Acceptance tests (must be actually executed)

1. Frontend dependencies install and production build succeeds; lint/type-check where configured.
2. Backend dependencies install in `backend/.venv` and pytest passes.
3. Flask health, summary, nodes, history, alerts, and ingest endpoints return contract-consistent JSON.
4. Seeding creates 8–10 nodes once; rerun does not duplicate them.
5. Normal reading persists in DB and updates latest value; survives restart.
6. Simulated methane reading changes node status, creates alert, and updates map/table/chart when frontend refreshes.
7. Repeating the same hazardous reading does **not** generate repeated active incidents.
8. Acknowledging alerts does not change node's measured hazard state.
9. Missing sensor fields do not become zero or produce false-safe readings; raw values are not presented as ppm.
10. Offline status is demonstrated with a stale timestamp.
11. Partial hardware-sourced JSON payload works without changes to React.
12. Simulator is explicitly labeled and does not override hardware records accidentally.
13. No secrets, `.venv`, or SQLite DB binary files are staged for Git.
14. End-to-end manual smoke test performed where environment permits; list any unverified items honestly.

## 13. Work plan and ownership

**Gate 0 (single Codex chat, sequential):** Put `PRD.md`, `PROJECT_STATE.md`, README pointer, and `docs/api-contract.md` in repo. Freeze interface and directories; have Codex report and wait for approval. No commit/push until requested.

**Parallel A — backend only:** Own `backend/**`. Implement Flask app, schema, seeding, ingestion, tests. Read root docs; *do not edit* frontend or root docs.

**Parallel B — frontend only:** Own `frontend/**`. Implement responsive UI and typed client of `docs/api-contract.md`; **do not edit** backend or root docs. Can use typed temporary mock fixtures during initial UI construction, but real integration must use Flask and show errors transparently.

**Gate 1 (single chat):** Stop parallel edits, reconcile, run both servers, verify real API-driven UI, fill remaining gaps, update root docs and `PROJECT_STATE.md` with actual tested outcomes. Seek user approval before each commit/push.

No concurrent edits to root configuration, `README.md`, `PRD.md`, `PROJECT_STATE.md`, `docs/**`, or `.gitignore`. If changes are needed, report proposed changes for reconciliation gate.

## 14. Documentation and governance

- `PRD.md` is the maintained product contract; changes must state rationale, scope impact, and version/date.
- `PROJECT_STATE.md` is the developer handoff ledger; update after each completed *approved* milestone with build status, tech decisions, commands, tests, blockers, and next actions. It is not a replacement for test execution.
- `README.md` must link to both documents and contain quick-start commands.
- Codex must never commit or push without user's explicit permission. Before requesting commit approval: summarize changed files, git diff/status, commands run and pass/fail, remaining limitations. Commits use configured Git identity without assistant co-author trailers.

## 15. Definition of done

The local app starts via documented commands, serves database-backed seeded examples immediately, allows an operator to inspect status and location, shows meaningful history, generates and manages real stored alerts through the simulator, can accept partial hardware ingestion, and passes its documented checks. Everything else is optional until these fundamentals are sound.

## 16. Approved Milestone 3 Presentation Requirements

This revision records the user's approved audit improvements. Actual completion and
verification remain the responsibility of PROJECT_STATE.md, not this requirement list.
These sequential single-chat instructions supersede the earlier proposed parallel
work plan in section 13.

- Explicit local demo configuration initializes/resumes persistent scenarios and
  runs one standalone backend-owned emitter about every 30 seconds. Both demo and
  emitter flags default off; neither Flask's reloader nor browser tabs start workers.
  An OS lock per SQLite DB prevents duplicate workers and releases on process exit.
- Persist per-node scenario state; simulator actions immediately ingest and persist
  it, subsequent ticks continue it, and restarts retain it. MH-007 remains a reserved
  offline example; MH-008 initially demonstrates partial/raw measurements.
- Preserve existing telemetry/incident history and hardware data. An optional
  explicitly confirmed baseline action restores demo measurements/scenarios only;
  it does not delete history, auto-resolve incidents, or reset acknowledgement counts.
- Add connectivity, current safety, last measured safety, freshness and scenario
  fields while retaining computed_status and all original telemetry fields.
  Offline current safety is unknown; confirmed safe requires all four fresh normal
  safety channels. API-query, emission and sensor receipt timestamps are distinct.
- Use a versioned VIT Vellore fictional-location catalogue. Back up existing SQLite
  via its backup API before changing demo locations, migrate allowed demo IDs in
  place transactionally/idempotently, preserve FKs, and exclude hardware rows.
- Improve projector readability, selected-node sensor prominence, campus-map
  readability, purposeful lightweight motion and responsive layout. Current values
  remain database-backed; synthetic data is explicit and raw is never calibrated PPM.
- Charts use numeric time axes and explicit telemetry gaps. Open incidents are easy
  to find, history remains accessible, and disabled resolution gives a visible reason.
- Preserve simulator node selection through navigation, synchronize restored-normal
  selection, and link successful actions directly to the node and relevant incident.
- Verify migration backup/idempotence/rollback, hardware preservation, duplicate
  workers, restart/scenario persistence, real emission beyond freshness timeout,
  alert deduplication/lifecycle, frontend checks and actual desktop/mobile workflows.

API v1.1 adds node/status/session metadata and POST /api/demo/baseline; original
request fields and telemetry 201 response remain compatible. See the maintained
API contract for exact shapes. Deferred scope remains unchanged: no cloud services,
authentication rollout, ML, remote actuators or field-certified safety claims.

## 17. Approved Milestone 4A — Visual Foundation and Reactive Manhole Visualizer

Approved on 2026-10-25 IST following the read-only engineering audit. The user
authorized implementation, frontend checks, browser verification, visual inspection
and documentation. No commit or push is authorized. Stop for review before 4B.

### Scope and visual direction
- Establish a distinctive warm editorial-industrial design with semantic color
  tokens, clear typography and a prominent selected-asset panel. Restyle shared
  surfaces, controls, maps and charts consistently using the existing dependencies.
- Add a reusable inline SVG manhole cutaway with independently reactive gas,
  water and cover layers. CSS supplies bounded motion and state transitions.
- Show normal, methane, H2S, overflow, displaced cover, combined hazards, missing
  channels, raw-only gas, stale observations, offline and API-unavailable states.
- Desktop/projector experience only for new design work. Existing mobile tests
  remain regression checks, not a new mobile design deliverable.

### Engineering and truthfulness requirements
- Consume the backend's effective `node.sensors` observations, connectivity,
  safety and freshness plus `summary.demo_thresholds`. Do not derive physical
  conditions from incident acknowledgement or the simulator's selected radio.
- Preserve all backend routes, SQLite schema/persistence, sensor units, source
  identification, inclusive thresholds and simulator/worker behavior.
- Never convert missing values to zero or raw gas to PPM. Unknown cover position
  must not look like a confirmed seated cover. Water height is a schematic ratio
  to the configured overflow threshold, not chamber capacity or percentage full.
- Preserve all simultaneous hazards. A missing/stale secondary channel must not
  hide a fresh hazard. Apply historical styling per channel, including the cover.
- Offline or failed API snapshots cannot establish current safety. Freeze motion,
  retain last-known measurements explicitly, and keep telemetry receipt time
  distinct from API-query time. Acknowledgement does not animate physical recovery.
- Keep visualizer identity stable across repeated readings and polls; use the
  existing polling owner and no new polling loops. Honor reduced-motion preferences
  with static hazard geometry, icons and labels. No essential information relies
  solely on color or animation.

### Acceptance criteria
1. Fresh normal and each hazard type produce distinct, understandable visuals.
2. Combined hazards, inclusive thresholds, raw/partial/stale/offline data and API
   outage/recovery are tested without modifying backend contracts.
3. New readings and acknowledgement preserve illustration identity and hazards;
   only fresh normal observations can visually clear a measured hazard.
4. Frontend lint, typecheck, production build and complete browser suite pass.
5. Desktop screenshots and visual inspection cover normal, hazard, partial and
   offline states; actual test outcomes are recorded in PROJECT_STATE.md.

### Deferred stages
4B was subsequently authorized and is specified in section 18. Later polish may refine
detail/chart/simulator layouts further. Opt-in browser sounds remain optional and
are not part of 4A. No firmware, calibration, wiring or actuator changes are included.

## 18. Approved Milestone 4B — Animated Incident System & Hazard-Aware Map

User authorized implementation on 2026-10-25 IST, preserving the 4A visual identity
and reactive cutaway. Desktop scope remains; no mobile redesign, dependencies,
backend contracts, schema, simulator/worker or hardware changes. No commits,
pushes or next milestone without approval. Sound belongs to 4D, not this milestone.

### Presentation and engineering requirements
- A prominent live incident watch introduces new emergencies and links to the
  incident desk. Hazard cards and map markers share recognizable SVG gas plumes,
  water rise/drop and lifted-cover symbols, with text labels and meaningful static
  geometry. Motion complements the porcelain, graphite and muted hazard palette.
- Track incident IDs and status changes in the existing polling owner, across
  successful complete Flask snapshots. Treat initial history as a silent baseline.
  New active identities receive a bounded entrance; observation timestamps,
  reading IDs, ordinary polls and list order changes cannot manufacture arrivals.
- Retain seen identities during API failures. Navigation and recovery may resume
  only the remaining animation interval, never a full new entrance. A full page
  reload starts a new silent baseline. There is no additional polling loop.
- Acknowledgement quiets card attention while preserving measured hazard symbols
  and explicit physical-condition text. Resolution requires the existing backend
  workflow; confirmed lifecycle changes settle visually. Keep outgoing records
  briefly in applicable status filters rather than removing them instantaneously.
- Map markers derive physical conditions from the 4A effective-sensor adapter and
  server thresholds, independently of incident workflow. Show simultaneous hazards,
  unknown/raw conditions, offline/historical data and failed API snapshots truthfully.
  Stale observations do not animate as current hazards; accessible labels update.
- Use bounded entrance/settling motion and restrained ongoing physical-hazard
  pulses. Honor reduced motion with static symbols and retain keyboard interaction,
  readable labels and a polite announcement of genuinely new incidents.

### Acceptance
Run lint, typecheck, production build and browser regression checks. Verify genuine
Flask incident creation, repeated hazardous readings, acknowledgement, normal
restoration and resolution. Test polling/navigation/recovery identity, filtered
lifecycle changes, multi-hazard/offline/API failure, reduced motion and map cleanup.
Visually inspect dashboard and Alerts at desktop sizes and capture each hazard.
Record actual results and limits in PROJECT_STATE.md; stop for user review.

## 19. Approved Milestone 4C — Complete UI Polish & Interaction Refinement

User authorized 4C following 4A and 4B on 2026-10-25 IST. Preserve those designs,
the reactive illustration and incident/map semantics. Improve desktop presentation
at 1366px and 1920px through meaningful hierarchy, spacing, typography and workflow
feedback. No commits, pushes or 4D work without approval; sound remains deferred.

- Dashboard: improve operational type sizes, sensor composition and table clarity.
  Add gauges comparing actual calibrated observations with server-provided demo
  thresholds. Explicit percentages mean percentage of a threshold, not percentage
  of physical capacity. Raw/missing values cannot receive calibrated fill; historical
  comparisons remain muted and explicitly last-known.
- Alerts: retain the existing arrival/lifecycle tracking, refine readable card
  metadata, status/action targets and filter surfaces, and provide a clear reset.
  No change to acknowledgement, resolution eligibility or hazard detection.
- Simulator: present a choose/send/observe workspace with recognizable static
  scenario tiles and an adjacent live cutaway. Selection must never alter observed
  telemetry. Only actual Flask snapshots update the illustration; unavailable or
  stale snapshots must not look currently safe. Preserve persisted-result links,
  normal restoration, baseline behavior and hardware exclusions.
- Node details: direct node selection, clearer identity/source/freshness, compact
  readable sensor cards, larger history chart and observed min/max summary with
  units. Render configured demo threshold even outside the data range. Preserve
  actual timestamps, missing-data gaps, raw labels and cover step interpolation.
  Failed detail data remains unconfirmed through retry/reopen until successfully
  fetched; changing node/range cannot show another node's history.
- Microinteractions: restrained hover/focus/pressed/loading feedback, accessible
  native controls, keyboard modal behavior and reduced-motion support. Avoid
  decorative repeated motion or unnecessary dependencies.

Acceptance: lint, typecheck, production build and complete browser regression
suite; test selection versus observed state, raw/stale gauges, drawer navigation,
failure/recovery and retained 4A/4B behaviors. Visually inspect Dashboard, Alerts,
Simulator and node details at both desktop widths. Maintain backend APIs, database
schema, simulator/worker logic, telemetry contracts and future ESP32 compatibility.
Record actual outcomes in PROJECT_STATE.md; physical hardware/projector validation
is not implied by desktop browser tests.

## 20. Approved Milestone 4D — Intelligent Alert Sounds & Presentation Readiness

User authorized implementation after the committed 4A–4C checkpoint, then approved
final audit and checkpoint publishing subject to passing checks. Preserve Flask APIs, SQLite, simulator,
firmware and telemetry contracts; introduce no dependencies or extra polling.

- Header offers a keyboard-accessible, explicitly opt-in sound toggle. Start muted
  on every full page load; route navigation retains the operator's session choice.
- Use native Web Audio, created/resumed only by an operator click. Handle absent,
  rejected, suspended or interrupted audio without impairing monitoring. Allow
  cancelling a pending enable. Muting disconnects scheduled and active voices.
- A newly observed active incident with Flask severity `critical` receives one
  softly ramped, approximately 0.43-second two-note cue. Consume the existing shared
  arrival events; do not infer incidents from sensor values or workflow counts.
  Warning-severity incidents and acknowledgement/resolution remain visually
  represented but silent. Acknowledgement still does not imply physical safety.
- Baseline history, repeated polls/readings, navigation and muted arrivals are
  silent. Group arrivals in a snapshot; apply a three-second non-queued cooldown.
  Silently rebaseline after API failure or a snapshot gap exceeding 20 seconds,
  preventing recovery/background-tab notification cascades.
- Preserve 4A–4C illustration, map, stale/offline/partial-channel and simultaneous
  hazard behavior. Reduced-motion settings continue to govern visuals; sound
  remains independently opt-in.

Acceptance: run lint, typecheck, build and the complete relevant browser suite;
verify actual Flask hazard lifecycle with enabled audio, silent polling/navigation,
muting, grouped arrivals, recovery and unavailable/blocked audio. Inspect Dashboard,
Alerts, Simulator and node details at 1366px and 1920px. Browser scheduling checks
do not establish loudness on the professor's presentation speakers.
