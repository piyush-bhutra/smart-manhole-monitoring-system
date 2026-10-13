import math
import re
from datetime import datetime, timezone

from flask import current_app
from werkzeug.exceptions import BadRequest, Conflict, Forbidden, NotFound

from .models import Alert, DemoScenario, Node, Reading, db, iso, utcnow
from .demo_catalogue import CATALOGUE

NUMERIC_FIELDS = ("methane_raw", "methane_ppm", "h2s_raw", "h2s_ppm", "water_level_cm")
SENSOR_FIELDS = (*NUMERIC_FIELDS, "cover_displaced")
HAZARD_FIELDS = {"methane": "methane_ppm", "h2s": "h2s_ppm",
                 "overflow": "water_level_cm", "cover": "cover_displaced"}
THRESHOLD_KEYS = {"methane": "METHANE_PPM_DEMO_THRESHOLD",
                  "h2s": "H2S_PPM_DEMO_THRESHOLD", "overflow": "WATER_LEVEL_CM_DEMO_THRESHOLD"}


def node_or_404(node_id):
    node = db.session.get(Node, node_id)
    if node is None:
        raise NotFound("Node is not registered.")
    return node


def validate_reading(payload):
    if not isinstance(payload, dict):
        raise BadRequest("Expected a JSON object.")
    allowed = {"node_id", "source", "latitude", "longitude", "device_timestamp", *SENSOR_FIELDS}
    if set(payload) - allowed:
        raise BadRequest("Unknown fields: " + ", ".join(sorted(set(payload) - allowed)))
    node_id = payload.get("node_id")
    if not isinstance(node_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", node_id):
        raise BadRequest("node_id must contain 1-64 letters, digits, underscores or hyphens.")
    if payload.get("source") not in ("simulator", "hardware"):
        raise BadRequest("source must be simulator or hardware.")
    for field in (*NUMERIC_FIELDS, "latitude", "longitude"):
        value = payload.get(field)
        if value is None:
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise BadRequest(f"{field} must be a finite JSON number or null.")
        try:
            finite = math.isfinite(value)
        except OverflowError:
            finite = False
        if not finite:
            raise BadRequest(f"{field} must be finite.")
        if field in NUMERIC_FIELDS and value < 0:
            raise BadRequest(f"{field} cannot be negative.")
    for field, limit in (("latitude", 90), ("longitude", 180)):
        if payload.get(field) is not None and not -limit <= payload[field] <= limit:
            raise BadRequest(f"{field} is out of range.")
    if payload.get("cover_displaced") is not None and type(payload["cover_displaced"]) is not bool:
        raise BadRequest("cover_displaced must be a boolean or null.")
    if not any(payload.get(field) is not None for field in SENSOR_FIELDS):
        raise BadRequest("At least one non-null sensor field is required.")
    values = {field: payload.get(field) for field in SENSOR_FIELDS}
    timestamp = payload.get("device_timestamp")
    if timestamp is not None:
        try:
            parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                raise ValueError
            values["device_timestamp"] = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        except (ValueError, TypeError, AttributeError, OverflowError):
            raise BadRequest("device_timestamp must be ISO8601 with a timezone.") from None
    return values


def effective_sensors(node, now=None):
    now = now or utcnow()
    result = {field: {"value": None, "received_at": None, "source": None, "fresh": False}
              for field in SENSOR_FIELDS}
    pending = {"methane", "h2s", "water", "cover"}
    groups = {"methane": ("methane_raw", "methane_ppm"), "h2s": ("h2s_raw", "h2s_ppm"),
              "water": ("water_level_cm",), "cover": ("cover_displaced",)}
    # Gas pairs come from one observation, so newer raw data cannot reuse older ppm.
    rows = db.session.scalars(db.select(Reading).where(Reading.node_id == node.id)
                              .order_by(Reading.received_at.desc(), Reading.id.desc()))
    for row in rows:
        for group in tuple(pending):
            fields = groups[group]
            if any(getattr(row, field) is not None for field in fields):
                for field in fields:
                    value = getattr(row, field)
                    result[field] = {"value": value, "received_at": iso(row.received_at),
                                     "source": row.source,
                                     "fresh": value is not None and (now - row.received_at).total_seconds()
                                     <= current_app.config["SENSOR_STALE_SECONDS"]}
                pending.remove(group)
        if not pending:
            break
    return result


def hazard_state(kind, sensors):
    observation = sensors[HAZARD_FIELDS[kind]]
    if not observation["fresh"]:
        return None
    if kind == "cover":
        return observation["value"]
    return observation["value"] >= current_app.config[THRESHOLD_KEYS[kind]]


def computed_status(node, sensors=None, now=None):
    now = now or utcnow()
    if node.last_seen_at is None or (now - node.last_seen_at).total_seconds() > current_app.config["OFFLINE_TIMEOUT_SECONDS"]:
        return "offline"
    sensors = sensors if sensors is not None else effective_sensors(node, now)
    states = [hazard_state(kind, sensors) for kind in HAZARD_FIELDS]
    if any(state is True for state in states):
        return "hazard"
    return "safe" if all(state is False for state in states) else "unknown"


def ingest(payload, received_at=None):
    values = validate_reading(payload)
    node = node_or_404(payload["node_id"])
    source = payload["source"]
    if source == "simulator":
        if not current_app.config["DEMO_ENABLED"]:
            raise Forbidden("Demo mode is disabled.")
        if not node.is_demo:
            raise Conflict("Simulator can only write to registered demo nodes.")
        state = db.session.get(DemoScenario, node.id)
        reserved = any(entry["id"] == node.id and entry["scenario"] == "offline" for entry in CATALOGUE)
        if received_at is None and (reserved or (state and state.scenario == "offline")):
            raise Conflict("This demo node is reserved as the offline example.")
    elif node.is_demo:
        raise Conflict("Hardware must use a separately registered non-demo node.")
    now = received_at or utcnow()
    reading = Reading(node_id=node.id, received_at=now, source=source, **values)
    db.session.add(reading)
    node.last_seen_at = now
    for field in ("latitude", "longitude"):
        if payload.get(field) is not None:
            setattr(node, field, payload[field])
    db.session.flush()
    created = []
    # Only an explicitly measured hazard can create or refresh its incident.
    for kind, field in HAZARD_FIELDS.items():
        value = values[field]
        unsafe = value is not None and (value is True if kind == "cover"
                 else value >= current_app.config[THRESHOLD_KEYS[kind]])
        if not unsafe:
            continue
        alert = db.session.scalar(db.select(Alert).where(
            Alert.node_id == node.id, Alert.alert_type == kind, Alert.status != "resolved"))
        if alert:
            alert.last_observed_at = now
        else:
            alert = Alert(node_id=node.id, alert_type=kind, severity="critical", status="active",
                          triggered_at=now, last_observed_at=now, source=source)
            db.session.add(alert)
            db.session.flush()
            created.append(alert.id)
    return reading, created


def reading_json(row):
    return {"id": row.id, "node_id": row.node_id, "received_at": iso(row.received_at),
            "device_timestamp": iso(row.device_timestamp), "source": row.source,
            **{field: getattr(row, field) for field in SENSOR_FIELDS}}


def alert_json(alert):
    return {field: getattr(alert, field) for field in
            ("id", "node_id", "alert_type", "severity", "status", "notes", "source")} | {
        field: iso(getattr(alert, field)) for field in
        ("triggered_at", "last_observed_at", "acknowledged_at", "resolved_at")}


def node_json(node, now=None):
    now = now or utcnow()
    latest = db.session.scalar(db.select(Reading).where(Reading.node_id == node.id)
                               .order_by(Reading.received_at.desc(), Reading.id.desc()).limit(1))
    sensors = effective_sensors(node, now)
    legacy = computed_status(node, sensors, now)
    online = node.last_seen_at is not None and (now - node.last_seen_at).total_seconds() <= current_app.config["OFFLINE_TIMEOUT_SECONDS"]
    historical = {key: value | {"fresh": value["value"] is not None} for key, value in sensors.items()}
    historical_states = [hazard_state(kind, historical) for kind in HAZARD_FIELDS]
    last_measured = "hazard" if any(state is True for state in historical_states) else "safe" if all(state is False for state in historical_states) else "unknown"
    known = [sensor for sensor in sensors.values() if sensor["value"] is not None]
    state = db.session.get(DemoScenario, node.id) if node.is_demo else None
    return {"id": node.id, "name": node.name, "location_description": node.location_description,
            "latitude": node.latitude, "longitude": node.longitude, "is_demo": node.is_demo,
            "created_at": iso(node.created_at), "last_seen_at": iso(node.last_seen_at),
            "computed_status": legacy, "connectivity": "online" if online else "offline",
            "safety_status": "unknown" if not online else legacy,
            "last_measured_safety": last_measured,
            "reading_freshness": "current" if online and known and all(sensor["fresh"] for sensor in known) else "stale",
            "demo_scenario": state.scenario if state else None,
            "latest_reading": reading_json(latest) if latest else None, "sensors": sensors}
