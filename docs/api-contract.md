# API Contract

Version 1.1 - Milestone 3 additive changes. Base path: `/api`. JSON requests/responses.
This file defines the implemented wire format. The PRD defines product scope.
The frontend types in `frontend/src/types/api.ts` match this contract.

## Common Rules

- Server timestamps are UTC ISO8601 strings ending in `Z`. All database times are UTC.
- IDs: node IDs are strings; reading and alert IDs are integers.
- Errors: `{"error":{"code":"bad_request","message":"Explanation"}}`.
- Errors use 400 for invalid input, 404 for missing resources, 405 for wrong method,
  409 for source/transition/database conflicts, 413 for bodies over 16 KiB,
  415 for non-JSON requests, and 403 for disabled demo ingestion.
- GET collections are bare arrays, not an envelope. Missing values are JSON null.
- Unknown ingestion fields are rejected. Client-supplied `received_at` or status is not accepted.
- No authentication is implemented. The server defaults to localhost. Public remote
  ingestion needs token protection before deployment; cloud deployment is outside this milestone.
- Nodes are registered administratively with the Flask CLI. Unknown IDs never auto-create nodes.
- Simulator writes require `DEMO_ENABLED=true` and `is_demo=true`. Hardware writes require
  `is_demo=false`. A node never mixes simulated and hardware telemetry.

## Health

`GET /api/health` -> 200 `{"status":"ok"}`. Executes a database connectivity query.
Initialize tables with `flask --app app init-db` before querying other endpoints.

## Summary

`GET /api/summary` -> 200:

```json
{
  "total_nodes": 8,
  "safe": 2,
  "hazard": 4,
  "offline": 1,
  "unknown": 1,
  "active_incidents": 3,
  "acknowledged_incidents": 1,
  "unresolved_incidents": 4,
  "demo_nodes": 8,
  "generated_at": "2026-10-13T16:30:00.000Z",
  "demo_enabled": true,
  "latest_telemetry_at": "2026-10-13T16:30:00.000Z",
  "sensor_stale_seconds": 300,
  "demo_session": {
    "enabled": true,
    "emitter_status": "running",
    "last_tick_at": "2026-10-13T16:30:00.000Z",
    "interval_seconds": 30.0,
    "catalogue_version": "vit-vellore-1",
    "region": {"name":"VIT Vellore, Tamil Nadu","center":[12.971,79.159],"fictional":true},
    "scenarios": {"MH-001":"normal","MH-002":"normal","MH-003":"methane","MH-004":"h2s","MH-005":"overflow","MH-006":"cover","MH-007":"offline","MH-008":"partial"}
  },
  "demo_thresholds": {"methane": 1000.0, "h2s": 10.0, "overflow": 80.0}
}
```

Counts reflect query time; nodes go offline after five minutes without new telemetry.
`generated_at` is API-query time, not device communication time. `latest_telemetry_at`
is the newest server receipt among nodes. `demo_session` is always present; enabled
defaults false unless configured. Emitter status is running/stopped/disabled, based
on its last heartbeat (recent within max(2.5 * interval, 10) seconds). It is not an
OS-process probe. A stopped worker never generates fake receipt timestamps.
The catalogue version and heartbeat are nullable before demo preparation/emission.
Unresolved means active plus acknowledged. Thresholds are educational configuration, not safety certification.

## Reading Shape

Reading objects always have all of these keys, including nulls:

```json
{
  "id": 201,
  "node_id": "HW-001",
  "received_at": "2026-10-13T16:30:00.000Z",
  "device_timestamp": null,
  "methane_raw": 1420.0,
  "methane_ppm": null,
  "h2s_raw": null,
  "h2s_ppm": null,
  "water_level_cm": 22.0,
  "cover_displaced": false,
  "source": "hardware"
}
```

Raw units are device-specific, uncalibrated output; they are never treated as PPM.
`water_level_cm` is water height, not distance from an ultrasonic transducer.
Firmware or a backend adapter must perform geometry/calibration conversions.

## Nodes

`GET /api/nodes` -> 200 array of node objects, sorted by ID.
`GET /api/nodes/<node_id>` -> 200 node object or 404:

```json
{
  "id": "HW-001",
  "name": "Hardware bench",
  "location_description": "Laboratory",
  "latitude": null,
  "longitude": null,
  "is_demo": false,
  "created_at": "2026-10-13T16:00:00.000Z",
  "last_seen_at": "2026-10-13T16:30:00.000Z",
  "computed_status": "unknown",
  "connectivity": "online",
  "safety_status": "unknown",
  "last_measured_safety": "unknown",
  "reading_freshness": "current",
  "demo_scenario": null,
  "latest_reading": {
    "id": 201,
    "node_id": "HW-001",
    "received_at": "2026-10-13T16:30:00.000Z",
    "device_timestamp": null,
    "methane_raw": 1420.0,
    "methane_ppm": null,
    "h2s_raw": null,
    "h2s_ppm": null,
    "water_level_cm": 22.0,
    "cover_displaced": false,
    "source": "hardware"
  },
  "sensors": {
    "methane_raw": {"value": 1420.0, "received_at": "2026-10-13T16:30:00.000Z", "source": "hardware", "fresh": true},
    "methane_ppm": {"value": null, "received_at": "2026-10-13T16:30:00.000Z", "source": "hardware", "fresh": false},
    "h2s_raw": {"value": null, "received_at": null, "source": null, "fresh": false},
    "h2s_ppm": {"value": null, "received_at": null, "source": null, "fresh": false},
    "water_level_cm": {"value": 22.0, "received_at": "2026-10-13T16:30:00.000Z", "source": "hardware", "fresh": true},
    "cover_displaced": {"value": false, "received_at": "2026-10-13T16:30:00.000Z", "source": "hardware", "fresh": true}
  }
}
```

In a node with readings, `latest_reading` is a full Reading object (shape above);
it is null only for a node that has never received telemetry.
`sensors` is an effective per-sensor snapshot and may contain observations from older rows.
Do not use the latest partial row alone to render current sensor values.

Status precedence:

1. `offline`: no readings or last receipt older than `OFFLINE_TIMEOUT_SECONDS`.
2. `hazard`: at least one fresh calibrated gas/water/cover observation is unsafe.
3. `unknown`: no fresh hazard, but any of the four safety channels is missing,
   stale, or gas raw-only. This also represents partial data.
4. `safe`: all four safety channels are fresh and below thresholds, cover false.

Threshold comparison is inclusive (`>=`). Stale values remain visible historical facts,
but cannot establish safety or a current hazard. Freshness is based on server receipt,
not a device clock. A gas pair is taken from its latest non-null observation as a unit;
new raw-only methane/H2S invalidates older PPM for that channel.

Additive node fields preserve the legacy `computed_status`:

- `connectivity`: online/offline from the receipt timeout.
- `safety_status`: safe/hazard/unknown from fresh measurements; offline always unknown.
- `last_measured_safety`: safe/hazard/unknown using last available channel values
  without claiming freshness. Pair with observation times; it is not current safety.
- `reading_freshness`: current only when online and every available non-null
  channel observation is fresh; missing channels still make safety unknown.
- `demo_scenario`: normal/methane/h2s/overflow/cover/partial/offline or null.
  Hardware nodes return null. Partial/offline are catalogue roles, not new public
  simulator scenario names. MH-007 is reserved offline and rejects simulator writes.

## History

`GET /api/nodes/<node_id>/readings?range=1h|24h|7d` -> 200 array of Reading objects,
oldest first (ID breaks timestamp ties). Default range is 24h, based on receipt time.
Unknown node -> 404; unsupported range -> 400; no history -> `[]`.
Rows preserve missing/null fields, so future charts must display gaps rather than zero.

## Telemetry

`POST /api/reading`, `Content-Type: application/json`:

```json
{
  "node_id": "HW-001",
  "source": "hardware",
  "methane_raw": 1420,
  "water_level_cm": 22,
  "cover_displaced": false
}
```

Required: `node_id`, `source`, and at least one non-null sensor field.
Optional: all Reading sensor fields, latitude [-90,90], longitude [-180,180], and
`device_timestamp` (ISO8601 string with timezone). Timestamps are normalized to UTC.
Node IDs use 1-64 ASCII letters, digits, underscores or hyphens.
Numeric values must be finite JSON numbers (not strings/booleans); sensor numbers
must be nonnegative. Cover must be boolean/null. Raw ADC upper bounds depend on hardware.
Null and omitted fields store null in that reading and do not erase prior observations.
Null never means zero, clear, or safe. A fresh supplied value is needed to update a channel.
Non-null coordinates update the registered node; null coordinates preserve installation location.

201 response (also returned by simulator scenarios):

```json
{
  "reading_id": 201,
  "node_id": "HW-001",
  "computed_status": "unknown",
  "created_alert_ids": [],
  "received_at": "2026-10-13T16:30:00.000Z"
}
```

Reading, location, last-seen, and incident updates commit in one transaction.
Repeated abnormal measurements update `last_observed_at` of an unresolved incident;
they do not create another. A database partial unique index enforces this rule.

## Alerts

`GET /api/alerts?status=active|acknowledged|resolved|all` -> 200 array, newest first.
Default is `all`. Invalid filter -> 400. Alert shape:

```json
{
  "id": 1,
  "node_id": "MH-003",
  "alert_type": "methane",
  "severity": "critical",
  "status": "active",
  "triggered_at": "2026-10-13T16:00:00.000Z",
  "last_observed_at": "2026-10-13T16:30:00.000Z",
  "acknowledged_at": null,
  "resolved_at": null,
  "notes": null,
  "source": "simulator"
}
```

Types: methane, h2s, overflow, cover. Current evaluation assigns critical severity.
`PATCH /api/alerts/<alert_id>` accepts:

```json
{"status":"acknowledged","notes":"Operator reviewing incident"}
```

Allowed: active -> acknowledged, active -> resolved, acknowledged -> resolved.
Resolution requires an online node and a fresh normal observation for that incident's
channel. Unknown/raw/stale values cannot justify resolution. Acknowledgement does not
clear hazards. Normal telemetry changes physical status but does not auto-resolve an incident.
Resolved incidents are immutable; another unsafe reading can create a new incident.
Notes are optional/null or strings of at most 1000 characters. A notes-only PATCH is unsupported.
200 returns the updated Alert; invalid body -> 400; invalid transition/unsafe resolution -> 409.

## Simulator

`POST /api/simulator/scenario`:

```json
{"node_id":"MH-001","scenario":"methane"}
```

Scenarios: `normal`, `methane`, `h2s`, `overflow`, `cover`.
Each persists the selected scenario and generates a complete synthetic observation through the same ingestion service:
normal values at 20% of configured thresholds, selected hazard at 150%, cover true for
cover scenario. Thus a scenario replaces all four current demo channels; `normal` restores them.
201 uses the telemetry response. Non-demo node -> 409; demo disabled -> 403.
Scenario state, reading, and incident changes commit together. The standalone,
explicitly enabled demo worker reads persisted scenarios on every tick and appends
new readings around every 30 seconds. It does not reset a chosen hazard to normal.
Flask/reloader and browser tabs never start emitters. Direct simulator-sourced
POST /reading remains a one-off observation, not a persistent scenario change.
The existing telemetry request and 201 response shapes are unchanged.

## Restore Demo Baseline (New)

`POST /api/demo/baseline`, JSON body:

```json
{"confirm":"restore_demo_measurements"}
```

200 response for the standard dataset:

```json
{"refreshed_nodes":7,"history_preserved":true,"incidents_preserved":true}
```

Requires explicit DEMO_ENABLED=true; otherwise 403. Invalid confirmation -> 400.
The transaction restores only catalogued demo-node scenarios and appends their
readings. MH-007 is skipped; hardware and non-catalogued nodes are untouched.
MH-003 methane, MH-004 H2S, MH-005 overflow, MH-006 cover, MH-001/002 normal;
MH-008 receives raw gases with normal water/cover to preserve partial safety.
History, acknowledgements and unresolved incidents are retained, not reset to
fixture counts. No DELETE/reset endpoint exists. Repeated hazard ticks use the
existing unresolved-incident uniqueness rule.

## Configuration and Compatibility

See README for environment settings and PowerShell examples. The frontend polls
about 5000 ms after each completed cycle, with cancellation and request timeouts.
Vite proxies `/api` to `API_PROXY_TARGET` (default `http://127.0.0.1:5000`).
`VITE_API_BASE` defaults to `/api`; unrestricted Flask CORS is not enabled.
Keep firmware pins, serial ports, and calibration outside React. Changes to these
paths or shapes require PRD/contract review before frontend integration.
