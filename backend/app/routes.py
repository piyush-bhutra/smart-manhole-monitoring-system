from datetime import timedelta

from flask import Blueprint, current_app, jsonify, request
from werkzeug.exceptions import BadRequest, Conflict, Forbidden, NotFound

from .models import Alert, Node, Reading, db, iso, utcnow
from .services import (HAZARD_FIELDS, THRESHOLD_KEYS, alert_json, computed_status,
                       effective_sensors, hazard_state, ingest, node_json, node_or_404, reading_json)

api = Blueprint("api", __name__, url_prefix="/api")


@api.get("/health")
def health():
    db.session.execute(db.text("SELECT 1"))
    return jsonify(status="ok")


@api.get("/summary")
def summary():
    from .demo import session_json
    now = utcnow()
    counts = dict.fromkeys(("safe", "hazard", "offline", "unknown"), 0)
    nodes = db.session.scalars(db.select(Node)).all()
    for node in nodes:
        counts[computed_status(node, now=now)] += 1
    active = db.session.scalar(db.select(db.func.count(Alert.id)).where(Alert.status == "active"))
    acknowledged = db.session.scalar(db.select(db.func.count(Alert.id)).where(Alert.status == "acknowledged"))
    return jsonify(total_nodes=len(nodes), **counts, active_incidents=active,
                   acknowledged_incidents=acknowledged, unresolved_incidents=active + acknowledged,
                   demo_nodes=sum(node.is_demo for node in nodes), generated_at=iso(now),
                   demo_enabled=current_app.config["DEMO_ENABLED"],
                   demo_session=session_json(),
                   latest_telemetry_at=iso(max((node.last_seen_at for node in nodes if node.last_seen_at), default=None)),
                   sensor_stale_seconds=current_app.config["SENSOR_STALE_SECONDS"],
                   demo_thresholds={kind: current_app.config[key] for kind, key in THRESHOLD_KEYS.items()})


@api.get("/nodes")
def nodes():
    now = utcnow()
    return jsonify([node_json(node, now) for node in db.session.scalars(db.select(Node).order_by(Node.id))])


@api.get("/nodes/<node_id>")
def node_detail(node_id):
    return jsonify(node_json(node_or_404(node_id)))


@api.get("/nodes/<node_id>/readings")
def history(node_id):
    node_or_404(node_id)
    ranges = {"1h": timedelta(hours=1), "24h": timedelta(hours=24), "7d": timedelta(days=7)}
    range_name = request.args.get("range", "24h")
    if range_name not in ranges:
        raise BadRequest("range must be 1h, 24h or 7d.")
    query = db.select(Reading).where(Reading.node_id == node_id, Reading.received_at >= utcnow() - ranges[range_name])
    return jsonify([reading_json(row) for row in db.session.scalars(query.order_by(Reading.received_at, Reading.id))])


@api.get("/alerts")
def alerts():
    status = request.args.get("status", "all")
    if status not in ("all", "active", "acknowledged", "resolved"):
        raise BadRequest("Invalid alert status filter.")
    query = db.select(Alert)
    if status != "all":
        query = query.where(Alert.status == status)
    return jsonify([alert_json(alert) for alert in db.session.scalars(query.order_by(Alert.triggered_at.desc(), Alert.id.desc()))])


def ingestion_response(reading, created):
    node = db.session.get(Node, reading.node_id)
    result = {"reading_id": reading.id, "node_id": node.id, "computed_status": computed_status(node),
              "created_alert_ids": created, "received_at": iso(reading.received_at)}
    db.session.commit()
    return jsonify(result), 201


@api.post("/reading")
def reading():
    row, created = ingest(request.get_json())
    return ingestion_response(row, created)


@api.patch("/alerts/<int:alert_id>")
def update_alert(alert_id):
    alert = db.session.get(Alert, alert_id)
    if alert is None:
        raise NotFound("Alert does not exist.")
    payload = request.get_json()
    if not isinstance(payload, dict) or set(payload) - {"status", "notes"}:
        raise BadRequest("Expected status and optional notes.")
    target = payload.get("status")
    if target not in ("acknowledged", "resolved"):
        raise BadRequest("status must be acknowledged or resolved.")
    notes = payload.get("notes")
    if notes is not None and (not isinstance(notes, str) or len(notes) > 1000):
        raise BadRequest("notes must be a string of at most 1000 characters or null.")
    if alert.status == "resolved" or (target == "acknowledged" and alert.status != "active"):
        raise Conflict("Unsupported incident transition.")
    now = utcnow()
    if target == "resolved":
        node = alert.node
        if computed_status(node, now=now) == "offline" or hazard_state(alert.alert_type, effective_sensors(node, now)) is not False:
            raise Conflict("Resolution requires a fresh normal measurement for this hazard and an online node.")
        alert.resolved_at = now
    else:
        alert.acknowledged_at = now
    alert.status = target
    if "notes" in payload:
        alert.notes = notes
    db.session.commit()
    return jsonify(alert_json(alert))


@api.post("/simulator/scenario")
def simulator():
    if not current_app.config["DEMO_ENABLED"]:
        raise Forbidden("Demo mode is disabled.")
    payload = request.get_json()
    if not isinstance(payload, dict) or set(payload) != {"node_id", "scenario"}:
        raise BadRequest("Expected node_id and scenario.")
    scenario = payload["scenario"]
    if not isinstance(scenario, str) or scenario not in ("normal", *HAZARD_FIELDS):
        raise BadRequest("scenario must be normal, methane, h2s, overflow or cover.")
    from .demo import select_scenario
    # validate_reading retains the public node-ID validation before ORM lookup.
    from .services import validate_reading
    validate_reading({"node_id": payload["node_id"], "source": "simulator", "cover_displaced": False})
    row, created = select_scenario(payload["node_id"], scenario)
    return ingestion_response(row, created)


@api.post("/demo/baseline")
def baseline():
    from .demo import restore_baseline
    payload = request.get_json()
    if payload != {"confirm": "restore_demo_measurements"}:
        raise BadRequest("Explicit confirmation is required: confirm=restore_demo_measurements.")
    return jsonify(restore_baseline())
