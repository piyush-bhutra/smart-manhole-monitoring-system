# Architecture and Hardware Integration

## Implemented Backend

`app.create_app` loads configuration, initializes Flask-SQLAlchemy, registers the
JSON API and CLI commands, and formats errors. Models enforce foreign keys,
nonnegative sensor values, enumerations, and one unresolved incident per node/type.
Routes handle HTTP; services own validation, ingestion, status, and serialization.
Seed generation uses that same ingestion service with synthetic historical timestamps.
Only this internal seed function can supply server receipt times; public ingestion cannot.

Data flows from simulator scenario or hardware JSON to validation, registered-node
source checks, a new reading, last-seen/location updates, hazard evaluation, and
incident creation/update. All changes commit together. Query endpoints compute
freshness and current status at request time. A React dashboard now consumes this
API. A standalone local demo worker emits synthetic readings only when both demo
flags are explicitly enabled. No serial bridge, firmware, or cloud service is implemented.

## Registering a Hardware Node

From `backend/`, in a separate terminal from the running server:

```powershell
.\.venv\Scripts\python.exe -m flask --app app register-node --node-id HW-001 --name 'Hardware bench' --location 'Laboratory'
```

IDs must be stable and agreed with the hardware team. Registration creates a
non-demo node; reusing any existing ID fails without modifying it. Demo IDs
`MH-001` through `MH-008` cannot receive hardware telemetry. Do not use simulator
IDs for physical devices. Coordinates can be supplied in subsequent readings.

## Partial Telemetry Example

After registration, while the local server is running:

```powershell
$reading = @{
    node_id = 'HW-001'
    source = 'hardware'
    methane_raw = 1420
    water_level_cm = 22
    cover_displaced = $false
} | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:5000/api/reading -Method Post -ContentType 'application/json' -Body $reading
```

Equivalent curl request (POSIX shell quoting):

```sh
curl -X POST http://127.0.0.1:5000/api/reading \
  -H 'Content-Type: application/json' \
  -d '{"node_id":"HW-001","source":"hardware","methane_raw":1420,"water_level_cm":22,"cover_displaced":false}'
```

Expected: HTTP 201, a persisted reading ID, `computed_status: "unknown"` because
calibrated gas channels are incomplete, and no PPM incident from raw ADC values.
These examples document the hardware contract; no physical ESP32 has been tested.

## Hardware Boundaries

- The firmware/adapter owns GPIO pins, sensor wiring, serial settings, calibration,
  and ultrasonic distance-to-height conversion. Send water height in centimeters.
- Raw MQ values remain raw; only calibrated `methane_ppm` / `h2s_ppm` are compared
  with PPM thresholds. Demonstration PPM is clearly simulated, not calibrated evidence.
- The source field identifies the pipeline but does not authenticate a device.
- `127.0.0.1` is local to the sender. A future LAN test needs the laptop's reachable
  LAN IP, explicit server binding/firewall setup, and an agreed node ID. None of that
  network exposure is enabled by this milestone.
- Cellular access requires a reachable secured server; remote ingestion must add
  token validation before public exposure. Cloud hosting remains out of MVP scope.
- Physical buzzer/LED/relay safety logic must operate independently of the website.
  The API offers no remote actuator control.

## Frontend Integration (Implemented)

React consumes only the documented JSON API through a typed client and a Vite
`/api` proxy. One completion-based polling flow refreshes summary, nodes and alerts
about every five seconds; an open drawer adds detail/history to that same cycle.
Changing node/range, manual refresh, or successful mutations cancel the previous
cycle and refetch. Request deadlines and effect cleanup prevent orphaned requests.
SQLite remains the source of demo state; failed API calls never switch to fixtures.

Dashboard includes a Leaflet/OSM map, searchable/filterable node table, metrics,
recent incidents, and a native-dialog detail drawer. Recharts history includes
six channel choices, raw/PPM separation, null gaps, range controls and demo thresholds.
Alerts and simulator actions persist through Flask; normal readings do not auto-resolve
incidents. Action feedback is also displayed inside the modal's top layer.

Restore baseline uses one confirmed POST /api/demo/baseline transaction. It restores
seven demo scenarios and measurements without deleting history, changing incident
lifecycle, or touching hardware. MH-007 remains the reserved offline example.

The root start-demo.ps1 launcher explicitly enables demo mode, prepares the versioned
VIT catalogue, and supervises a worker, Flask (without reloader), and Vite. The worker
holds an OS file lock for the database, emits approximately every 30 seconds through
the existing ingestion service, and reads scenarios persisted in SQLite on each tick.
Flask startup alone never starts an emitter. Both demo flags default to false.

Catalogue migration backs up SQLite before changing existing fictional nodes, preserves
IDs and foreign keys, and is transactional and idempotent. Hardware rows are excluded.
Connectivity, current safety, last measured safety, and freshness are additive fields;
legacy computed_status remains supported. See api-contract.md for exact shapes.
Stop the demo launcher before hardware-only testing and use the default-disabled flags.

## Persistence Limitations

`init-db` creates tables; it is not a schema migration system. Future schema changes
need an explicit migration strategy preserving existing data. SQLite suits this
local 8-20 node demonstrator; pagination, retention, and high-volume ingestion are
not implemented. There is no automatic reset, deletion, or reseeding on server start.
