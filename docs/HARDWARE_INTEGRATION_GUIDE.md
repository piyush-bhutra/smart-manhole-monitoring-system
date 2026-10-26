# Smart Manhole Pulse — ESP32 integration handoff

Reviewed 2026-10-26. This guide describes the implemented application, not a completed physical installation. The teammate must review the actual sketch, board and wiring before connecting hardware.

Repository: https://github.com/piyush-bhutra/smart-manhole-monitoring-system
Development branch: `codex/smart-manhole-pulse-4a`. Clone this branch for the complete software; `main` has not been merged with the redesign.

```powershell
git clone --branch codex/smart-manhole-pulse-4a https://github.com/piyush-bhutra/smart-manhole-monitoring-system.git
cd smart-manhole-monitoring-system
```

## A. Architecture and current readiness

```text
Sensors → ESP32 measurement, calibration and local buzzer/LED/relay logic
        → Wi-Fi HTTP (cellular transport still to integrate)
        → Flask POST /api/reading → validation + SQLite transaction
        → stored readings + incidents → React polling → dashboard/map/history/audio
```

Flask owns ingestion, freshness, configured hazard thresholds and incident lifecycle. SQLite persists nodes, readings and incidents; demo scenario/metadata tables support a separate simulator worker. React polls the shared API about every five seconds. It neither generates hardware readings nor controls actuators. Browser sounds are optional and distinct from the physical buzzer.

Source of truth: [API contract](api-contract.md), [architecture](integration.md), `backend/app/services.py` (`validate_reading`, `ingest`, `effective_sensors`), `routes.py`, `config.py`, `models.py`, and `tests/test_backend.py` / `test_demo.py`. Those paths are relative to the repository root. No firmware `.ino`, C/C++ source, or PlatformIO project was found in the working repository. Software tests validate HTTP compatibility; no physical ESP32, sensor calibration, RFID behavior, GPS reception or cellular connection is claimed as tested.

## B. Hardware inventory — reported, not physically verified

| Reported component | Intended responsibility | Backend representation |
|---|---|---|
| ESP32 DevKit V1 | Read sensors, local decisions, transmit JSON | Stable registered `node_id` |
| MQ-4 methane | Raw observation; calibrated PPM only when justified | `methane_raw`, `methane_ppm` |
| HC-SR04 | Distance measurement converted to water height | `water_level_cm` |
| ADXL345 | Determine cover displacement from installation-specific orientation/motion | `cover_displaced` |
| RC522 RFID | Local authorization/interaction, to be defined by teammate | No RFID endpoint or payload field |
| NEO-6M GPS | Valid geographic fix | `latitude`, `longitude` on node |
| LED indicators and buzzer | Local indication independent of network | No actuator commands/status fields |
| MQ-136 H₂S — additional | Raw observation/calibrated concentration | `h2s_raw`, `h2s_ppm` |
| SIM800L — additional | GSM/GPRS transport | Same JSON contract if HTTP path is reachable |
| Relay-controlled exhaust fan — additional | Local hardware control and power isolation | No remote relay/fan control |

Confirm component variants, breakout schematics, power sources and actual population. A missing H₂S sensor is a missing channel, not a zero-PPM reading. Do not carry historical Review-I GPIO assignments into the build as verified wiring.

## C. Firmware compatibility checklist

The physical sketch must be supplied and reviewed separately. There are no verified GPIO assignments to copy from this repository.

- [ ] Agree a stable non-demo ID such as `HW-001`, then register it in the same database the server uses.
- [ ] Record actual board variant, pin table, firmware revision, sensor libraries and UART/I²C/SPI assignments.
- [ ] Send flat JSON with exactly the supported keys, numeric JSON values and true booleans.
- [ ] Set `source` to `hardware`; do not derive it from UI demo mode.
- [ ] Keep ADC values raw until a documented sensor calibration produces PPM. Record ADC range, attenuation, voltage scaling and calibration conditions outside the telemetry payload.
- [ ] Convert valid ultrasonic distance to water height using the measured mounting geometry. For a vertical sensor above a reference floor, height is mounting height minus measured distance; validate geometry and sensor range before using this relationship. Never turn a timeout into zero height.
- [ ] Debounce cover state and establish a seated reference using the actual ADXL345 mounting. Do not send acceleration axes or tilt angles: they are unsupported fields.
- [ ] Send only newly measured valid values; omit/null unavailable channels. Do not repeatedly retransmit cached values as if newly sampled.
- [ ] Parse HTTP status and JSON errors; implement bounded network timeouts/backoff without blocking the local alarms.
- [ ] Use GPS coordinates only after a valid fix, and send latitude/longitude together as a firmware convention.
- [ ] Keep local safety behavior independent of internet, server availability, browser audio and incident acknowledgement.

## D. Exact HTTP contract

`POST http://<reachable-server>:<backend-port>/api/reading`

Header: `Content-Type: application/json`. Body must be a JSON object, at most 16 KiB. There is no authentication or API-key requirement in the implemented server. `source` is a label validated against registration, not proof of device identity. Do not expose the current unauthenticated development server directly to the public internet.

| Key | Required? | Accepted value and meaning |
|---|---|---|
| `node_id` | Yes | String matching `[A-Za-z0-9_-]{1,64}`; must already exist |
| `source` | Yes | `hardware` for ESP32; hardware requires node `is_demo=false` |
| `methane_raw` | Optional | Finite nonnegative JSON number, device-specific raw output; no backend ADC upper bound or conversion |
| `methane_ppm` | Optional | Finite nonnegative calibrated methane concentration in ppm |
| `h2s_raw` | Optional | Finite nonnegative raw H₂S sensor output |
| `h2s_ppm` | Optional | Finite nonnegative calibrated H₂S concentration in ppm |
| `water_level_cm` | Optional | Finite nonnegative water **height** in centimetres, not transducer distance or percentage |
| `cover_displaced` | Optional | JSON `true` or `false`; not `0`, `1`, or strings |
| `latitude` | Optional | Finite number from −90 to 90, decimal degrees |
| `longitude` | Optional | Finite number from −180 to 180, decimal degrees |
| `device_timestamp` | Optional | ISO8601 string with timezone, e.g. `2026-10-26T08:00:00Z`; normalized to UTC |

At least one of the six sensor fields must be non-null. GPS and timestamp alone are not sufficient. Optional fields may be omitted or null. Numbers cannot be strings, booleans, negative sensor values, NaN or Infinity. Unknown keys are rejected: no `temperature`, `rfid_uid`, `fan`, `distance`, nested `gps`, `status`, `received_at` or battery fields.

### Illustrative requests — not measured telemetry

Minimal uncalibrated example (do not report these numbers as a genuine sensor result):

```json
{"node_id":"HW-001","source":"hardware","methane_raw":1420}
```

Complete shape showing all fields; these values are illustrative only, not a calibration recipe:

```json
{
  "node_id": "HW-001",
  "source": "hardware",
  "methane_raw": 1420,
  "methane_ppm": 200,
  "h2s_raw": 350,
  "h2s_ppm": 2,
  "water_level_cm": 16,
  "cover_displaced": false,
  "latitude": 12.971,
  "longitude": 79.159,
  "device_timestamp": "2026-10-26T08:00:00Z"
}
```

Only include the PPM fields when actual calibration supports them. If the clock is unsynchronized, omit `device_timestamp`; do not fabricate a time. An invalid present timestamp rejects the entire request.

### Success and failures

Success is **201 Created** after the transaction commits. Example for a newly registered node receiving only raw methane:

```json
{"reading_id":201,"node_id":"HW-001","computed_status":"unknown","created_alert_ids":[],"received_at":"2026-10-26T08:00:01.000Z"}
```

IDs/times are illustrative. Status depends on the node's other effective observations, not just this request. `created_alert_ids` lists only newly created incidents; an empty list does not prove the node is safe. Responses do not echo the complete reading; retrieve node detail/history to verify storage.

| HTTP status | Typical cause / action |
|---|---|
| 400 | Malformed JSON, unknown keys, missing required fields, all-null sensors, bad number/bool/timestamp/coordinate; correct payload |
| 404 | Valid-looking but unregistered node ID; register the agreed ID in the correct DB |
| 409 | Hardware sent to a demo node, simulator sent to hardware, database constraint conflict, or invalid incident transition |
| 403 | Simulator request while demo mode is disabled; hardware ingestion itself remains enabled |
| 405 | Wrong HTTP method |
| 413 | Body exceeds 16 KiB |
| 415 | Missing/wrong JSON content type |
| 500 | Server-side failure; inspect server logs; do not assume receipt succeeded |

Error shape: `{"error":{"code":"bad_request","message":"At least one non-null sensor field is required."}}`. Other statuses use corresponding codes such as `not_found` or `conflict`. Preserve the server message in firmware diagnostics.

There is no request-id/idempotency key: retrying a request may append another reading if the original committed but its response was lost. Repeated hazardous readings reuse an unresolved incident of the same node/type, updating its last-observed time. Do not blindly retry validation failures.

### Freshness, missing data and location semantics

Server `received_at` is authoritative for history ordering, online status and freshness; `device_timestamp` is stored metadata, not used for freshness. Old buffered measurements uploaded now would appear newly received: avoid replaying stale samples into this live endpoint without an agreed ingestion design.

Each row stores omitted sensor fields as null. Effective sensors retrieve the most recent non-null observation per channel group. Null/omission does **not** immediately erase a previous value; it ages stale. Methane raw+PPM are one group, as are H₂S raw+PPM: a newer raw-only observation makes the older PPM unavailable rather than reusing it. An unavailable sensor should be omitted/null; never fake `0` or `false`. If all sensors are unavailable, there is no heartbeat-only request supported; do not manufacture a reading to keep the node online.

Defaults: `OFFLINE_TIMEOUT_SECONDS=300`, `SENSOR_STALE_SECONDS=300`. Online/fresh includes the exact timeout boundary; values become overdue after it. A suggested initial firmware upload interval is 30 seconds (not an API requirement), with local sampling/alarm handling faster as needed. Keep uploads comfortably below configured timeouts. One fresh channel keeps node connectivity alive but does not refresh other channels. Missing/raw-only gas prevents an all-channels-safe claim.

Non-null coordinates update the node's current location independently; null/omission leaves the last location unchanged. They are not stored on each Reading and do not form a GPS track. There is no GPS-fix-age field. Send both coordinates only with a valid fix; absent coordinates do not block ingestion, but a node lacking either coordinate cannot appear as a map marker. It remains in the table and detail view. `0,0` is accepted numerically, so do not use it as a no-fix placeholder.

### Hazard propagation and workflow

The current configured demonstration thresholds apply to hardware and simulator alike: methane ≥1000 ppm, H₂S ≥10 ppm, water ≥80 cm, or cover `true`. Configuration keys are `METHANE_PPM_DEMO_THRESHOLD`, `H2S_PPM_DEMO_THRESHOLD`, `WATER_LEVEL_CM_DEMO_THRESHOLD`; the summary exposes current values. These are educational settings, not approved occupational safety limits.

An explicitly hazardous incoming channel creates a critical active incident or refreshes its existing unresolved incident in the same database transaction. Multiple hazardous channels can create multiple IDs. Raw ADC alone never creates a gas incident. Fresh hazards take precedence over incomplete other channels; all four hazard channels must be fresh normal for overall safety. An offline node is currently unconfirmed even when its last measured state was normal.

Within the next successful frontend poll, the measured condition drives the cutaway/map and the incident drives the feed. Initial/history loading is silent. With sound explicitly enabled, genuinely new critical IDs produce one grouped cue; polling, acknowledgement, resolution and reconnect baselines do not replay it. A three-second cooldown drops bursts without queuing.

`PATCH /api/alerts/<id>` with `{"status":"acknowledged"}` records operator review. **Acknowledgement is not physical clearance and must not disable a hardware alarm.** Fresh normal telemetry does not automatically close an incident. Resolution uses `{"status":"resolved"}` and requires an online node plus a fresh normal measurement for that incident's channel; other channels may still be hazardous. Raw or missing gas is not proof of clearance. Repeated acknowledgement and updates to a resolved incident return 409.

## E. Local Wi-Fi connection procedure

### Install and demonstrate software first

Follow [README setup](../README.md#one-time-installation): Python 3.12+, Node 22.12+, a new `backend/.venv` and backend requirements, then `npm.cmd install` in `frontend/`. Dependencies, local databases and virtual environments are not cloned.

From repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-demo.ps1
```

Default dashboard: `http://127.0.0.1:5173`; API: `http://127.0.0.1:5000`. Alternate documented ports: `-BackendPort 5001 -FrontendPort 5174`. Wait for `Ready`. This demo launcher binds to loopback and cannot itself serve an ESP32 on the LAN. Stop it with Ctrl+C before the hardware-only procedure; do not run a second worker against its database.

### Hardware-only Flask (terminal 1)

From repository root, then backend:

```powershell
cd backend
$env:DEMO_ENABLED = 'false'
$env:DEMO_EMITTER_ENABLED = 'false'
# Optional: dedicated hardware DB, consistently used by CLI and server.
$env:DATABASE_URL = 'sqlite:///hardware-monitoring.db'
.\.venv\Scripts\python.exe -m flask --app app init-db
.\.venv\Scripts\python.exe -m flask --app app register-node --node-id HW-001 --name 'ESP32 bench' --location 'Laboratory'
.\.venv\Scripts\python.exe -m flask --app app run --no-reload --no-debugger --host 0.0.0.0 --port 5000
```

Register once; an existing ID causes a deliberate error without changes. Identify an existing hardware node with `GET /api/nodes` and check `is_demo:false`. Do not use seeded `MH-001`–`MH-008`. No HTTP registration endpoint exists. All commands and the running server must use the same `DATABASE_URL`. Relative SQLite URLs resolve under `backend/instance/`; the above database is `backend/instance/hardware-monitoring.db`. Omitting the override uses `backend/instance/monitoring.db` and retains any demo history already there. Backend `.env` files are not automatically loaded; set variables explicitly.

### Frontend (terminal 2)

From repository root:

```powershell
cd frontend
$env:API_PROXY_TARGET = 'http://127.0.0.1:5000'
npm.cmd run dev -- --port 5173 --strictPort
```

Open `http://127.0.0.1:5173` on the laptop. Stop conflicting project services or choose matching alternate ports. The ESP32 posts directly to Flask, not Vite. The dashboard proxy keeps browser requests same-origin; the ESP32 HTTP client does not need browser CORS support.

### Network and first genuine reading

1. Connect laptop and ESP32 to the same reachable network; classic ESP32 Wi-Fi uses 2.4 GHz. Campus guest networks may isolate clients or require a captive login. Use an approved shared router/hotspot with peer access if necessary.
2. Run `ipconfig` on the laptop. Use the IPv4 address of the active Wi-Fi/Ethernet adapter, not a VPN, virtual adapter, loopback or disconnected interface. DHCP can change it.
3. Confirm `http://127.0.0.1:5000/api/health` locally. From another LAN device, confirm `http://<laptop-LAN-IP>:5000/api/health` returns `{"status":"ok"}`. If needed, allow inbound TCP for this backend port on the trusted/private network only; do not disable the firewall wholesale.
4. Set firmware destination to `http://<laptop-LAN-IP>:5000/api/reading`. `127.0.0.1` on the ESP32 refers to the ESP32 itself. `0.0.0.0` is a server bind address, not a destination. Example `192.168.1.42` is illustrative, not this laptop's verified address.
5. Read the real sensors and build the JSON described above. Start with one valid raw channel if calibration is pending. Log the request (without Wi-Fi credentials), response status, `reading_id` and error message. Do not use the example numbers as genuine telemetry.
6. Check `GET /api/nodes/HW-001`: `is_demo:false`, `latest_reading.source:"hardware"`, a new receipt time and the exact measured value. Find `HW-001` in Dashboard search and inspect sensor history; use the source label and timestamps to distinguish it from demo nodes.
7. Check `GET /api/nodes/HW-001/readings?range=1h` for the returned ID. For independent SQLite confirmation, in another backend terminal with the **same** database setting run `python -m flask --app app shell` using the venv command below. Perform read-only queries:

```powershell
$env:DATABASE_URL = 'sqlite:///hardware-monitoring.db'
.\.venv\Scripts\python.exe -m flask --app app shell
```

Inside that Python shell:

```python
from app.models import db, Reading
print(db.engine.url.database)  # Verify which file the app uses.
row = db.session.scalar(db.select(Reading).where(Reading.node_id == 'HW-001').order_by(Reading.id.desc()).limit(1))
print(None if row is None else (row.id, row.source, row.received_at, row.methane_raw, row.methane_ppm, row.water_level_cm, row.cover_displaced))
exit()
```

After receipt, restart Flask using the same database and confirm the row remains. No reseeding/reset is needed. Do not delete SQLite or run demo-baseline actions to clear hardware records.

### Cellular is a separate integration path

SIM800L is GSM/GPRS (2G), not LTE. Confirm local operator 2G data service, suitable SIM/data plan, APN, registration, antenna and modem firmware before attempting HTTP. A private laptop LAN address is normally unreachable from cellular internet; NAT/firewalls and carrier NAT require a planned reachable endpoint or managed private route. SMS success is not proof of GPRS HTTP connectivity.

No public hosting, TLS termination, device authentication, rate limiting or cellular firmware is implemented here. Public deployment needs an explicit reviewed security/hosting plan and a production server setup; do not simply forward the Flask development port. Verify the modem's actual TLS/certificate compatibility with the chosen endpoint. Keep the JSON contract unchanged when adding a transport. These deployment decisions and cellular tests remain teammate/project-owner work, not completed integration.

## F. Electrical and interface checks before power-on

The following are component-level constraints, not a verified wiring diagram. Breakout boards can add regulators/level shifting; inspect their schematics instead of assuming a bare-chip rating applies to the board's VCC pin.

| Interface | Required check |
|---|---|
| ESP32 GPIO | Use 3.3 V logic; do not connect 5 V outputs directly. Respect the actual chip/module's GPIO and ADC limits. Avoid boot-strapping/flash pins and input-only pins for outputs. Prefer suitable ADC1 inputs for classic ESP32 analog sensing with Wi-Fi; ADC2 is shared with Wi-Fi. See [Espressif datasheet](https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf) and [ADC documentation](https://docs.espressif.com/projects/esp-idf/en/v4.2/esp32/api-reference/peripherals/adc.html). |
| HC-SR04 | Common 5 V models output a 5 V ECHO signal: use a correctly designed divider/level shifter to the ESP32 input, and common ground. Verify the actual variant and TRIG logic requirements. Do not infer water height from an invalid/no-echo measurement. See [Adafruit ultrasonic guide](https://learn.adafruit.com/ultrasonic-sonar-distance-sensors?view=all). |
| MQ-4 / MQ-136 | Heater/measurement circuits commonly require 5 V; analog output can exceed ESP32 ADC input range. Verify divider/buffer, load resistor and ADC attenuation before connection. Heater warm-up, baseline calibration, humidity and cross-sensitivity matter; raw counts are not PPM. Follow the exact sensor manual: [Winsen MQ-4](https://www.winsen-sensor.com/d/files/MQ-4.pdf), [Winsen MQ-136](https://www.winsen-sensor.com/d/files/manual/mq136.pdf). |
| ADXL345 | Bare sensor supply is 2.0–3.6 V; check breakout logic/pull-ups. Use the selected I²C or SPI interface and validate axis orientation/calibration. No threshold or pin assignment is verified here. See [Analog Devices datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/adxl345.pdf). |
| RC522 | Confirm 3.3 V-compatible power and logic. Match SCK/MOSI/MISO/CS/RST to the sketch's actual SPI mapping; on common RC522 SPI boards the pin labelled SDA is CS/SS, not an I²C data connection. Confirm board documentation. See [NXP MFRC522 datasheet](https://www.nxp.com/docs/en/data-sheet/MFRC522.pdf). |
| NEO-6M | Bare module supply is 2.7–3.6 V; breakout input ratings may differ. GPS TX connects to the assigned ESP32 UART RX, with common ground and compatible logic. Check configured baud rate; do not assume a historical UART pin map. GPS needs a valid fix and antenna/sky view; indoor/underground reception is not assured. See [u-blox NEO-6 datasheet](https://content.u-blox.com/sites/default/files/products/documents/NEO-6_DataSheet_%28GPS.G6-HW-09005%29.pdf). |
| SIM800L | Bare module VBAT range is 3.4–4.4 V and transmit bursts can demand 2 A. Use an appropriate dedicated supply, local decoupling and short adequate conductors; do not feed it from an ESP32 GPIO or assume the board's 3.3 V regulator can supply it. Verify the breakout input and UART level translation. See SIMCom's [SIM800H/SIM800L Hardware Design V2.02](https://www.electrokit.com/upload/product/41018/41018214/SIM800L-SIMCom.pdf), manufacturer document mirrored by a distributor, especially power/serial sections. |
| LEDs, buzzer, relay/fan | Use LED current limiting and drivers appropriate to load current. Do not drive a relay coil or fan directly from GPIO. Check inductive suppression, supply isolation, active-high/low behavior and reset-safe state. Use qualified supervision for mains loads; this repository provides no mains wiring design. |

Record a signed-off pin/power table with actual GPIO, signal direction, logic voltage, supply voltage, bus/address and module variant. Confirm no conflicts between GPS/modem UARTs, RFID SPI and gas ADC pins. Do not deliberately release methane/H₂S for a software demonstration; use controlled simulated inputs, and supervised sensor calibration procedures where appropriate.

## G. Practical acceptance checklist

| Check | Evidence to retain |
|---|---|
| Board and power | Actual schematic/pin map; measured rails; no brownouts during Wi-Fi/modem bursts |
| MQ-4 and optional MQ-136 | Valid raw ranges after warm-up, disconnected-sensor behavior, calibration method before PPM claims |
| HC-SR04 | Known-distance bench comparison, measured mounting reference, correct rising-water direction, timeout produces missing data |
| ADXL345 / cover | Seated reference, controlled displacement, debounce, recovery; repeated noise does not spuriously toggle |
| Buzzer / LED | Correct local response and reset behavior with Wi-Fi/server/browser disabled |
| RFID | Known/unknown card behavior defined and verified locally; no claim that a scan clears a dashboard hazard |
| GPS | Valid outdoors fix, correct lat/lon order, no-fix omission, no fictitious `0,0`; confirm map marker |
| HTTP / SQLite | 201, returned reading ID, source hardware, node detail/history and independent database read agree; survives restart |
| Hazard lifecycle | New measured hazard → animated critical incident → acknowledge (hazard persists) → actual fresh normal measurement → resolve; review each hazard type |
| Partial / raw / offline | Unavailable channel is not zero; raw gas is uncalibrated; stale per-channel state and >300-second default offline state are unconfirmed; resolution blocked without clearance |
| Simultaneous hazards | Each measured hazard remains visible; independent incident lifecycle; clearing one does not imply all are safe |
| Browser sound | Starts muted; enable explicitly; one cue for genuinely new critical arrivals; no repeated cue for polling or reconnect; mute works independently of physical buzzer |
| Cellular, if fitted | Registration + GPRS/APN + reachable endpoint + successful HTTP response under transmit load; local alarms still work on outage |

Software regression tests already exercise these API/display semantics using synthetic data, including isolated hardware-source HTTP ingestion. They do not replace the physical acceptance evidence above. For deliberate synthetic hardware-source bench requests, use a separate test database/registration and label the evidence as synthetic, never as measured sensor telemetry.

## H. Troubleshooting

| Symptom | Check |
|---|---|
| ESP32 cannot connect; laptop browser works | Firmware used localhost, Flask still bound to 127.0.0.1, wrong active-adapter IP/port, firewall, guest isolation or incompatible Wi-Fi network |
| 404 / wrong node | Case-sensitive registered ID and same DB configuration for CLI/server; use `/api/reading` singular |
| 400 / 415 | JSON Content-Type, flat keys, unquoted numbers, true boolean, timezone timestamp, at least one non-null sensor; inspect response message |
| 409 on ingest | Hardware must target a non-demo registration; do not reuse seeded demo IDs |
| Raw reading but no gas alarm | Expected: raw ADC is not calibrated PPM; do not relabel it merely to trigger a threshold |
| Unexpected old sensor value | Effective channel retains last non-null observation until stale; newest partial row does not replace all channel values |
| Node online, safety unknown | Missing/uncalibrated/stale channel; online only means a reading was recently received |
| Acknowledged incident still hazardous | Expected: acknowledgement records operator review only; send a fresh genuine normal value before resolution |
| Normal node but incident open | Expected: explicit resolution is required; normal readings do not auto-close history |
| No map marker / wrong location | Missing coordinate or no GPS fix; map uses stored node coordinates; omission retains old location |
| Stale despite valid device time | Server receipt drives freshness; check upload success, cadence and server configuration |
| No sound | Muted by default, blocked/interrupted browser audio, system output volume, existing incident ID, reconnect baseline or burst cooldown |
| SIM800L resets or only answers AT | Verify supply under burst load, antenna, SIM/2G coverage, registration and data/APN; AT response alone proves no HTTP path |
| Unexpected sensor values/reset | Voltage levels, ground reference, wiring conflicts, ADC2+Wi-Fi, sensor warm-up, UART baud and board variant |

## I. Integration boundaries and remaining responsibilities

Keep endpoint paths, payload names/types/units, registration/source separation, stored history, freshness semantics and acknowledgement/resolution rules unchanged. Do not add unsupported payload fields or change schema merely to match an old sketch. Do not replace missing readings with invented values or let an RFID action claim physical safety.

The teammate configures actual pins/buses, Wi-Fi credentials, node ID, server URL, calibration, water geometry, cover reference/debounce, genuine sampling/upload cadence, GPS validity handling and local actuator logic. Credentials stay out of Git. Changes to thresholds require an explicit engineering decision; they apply to hardware as well as the demo. New RFID/actuator fields, public authentication/hosting, offline buffered ingestion and firmware features require a separately reviewed scope.

Handoff acceptance remains conditional on reviewing the actual sketch, confirming the final hardware inventory/wiring, calibrating sensors, and performing end-to-end physical tests. Desktop verification does not establish deployment safety or certified hazardous-environment suitability.
