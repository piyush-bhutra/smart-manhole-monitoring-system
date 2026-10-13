import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from flask import current_app
from werkzeug.exceptions import Conflict, Forbidden

from .demo_catalogue import CATALOGUE, REGION, VERSION, location_description
from .models import DemoMetadata, DemoScenario, Node, db, iso, utcnow
from .services import HAZARD_FIELDS, THRESHOLD_KEYS, ingest


def metadata(key, default=None):
    value = db.session.get(DemoMetadata, key)
    return value.value if value else default


def set_metadata(key, value):
    row = db.session.get(DemoMetadata, key)
    if row is None:
        db.session.add(DemoMetadata(key=key, value=str(value)))
    else:
        row.value = str(value)


@contextmanager
def emitter_lock(database_path):
    """The OS releases this exclusive lock even after a worker crash."""
    path = Path(str(database_path) + ".demo.lock")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+b") as handle:
        if path.stat().st_size == 0:
            handle.write(b"0")
            handle.flush()
        handle.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as error:
            raise RuntimeError("A demo worker already owns this database.") from error
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def backup_before_migration():
    path = Path(db.engine.url.database)
    if not path.is_file():
        return None
    with sqlite3.connect(path) as source:
        tables = {row[0] for row in source.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "nodes" not in tables:
            return None
        expected = {entry["id"]: entry for entry in CATALOGUE}
        changed = False
        for node_id, name, description, lat, lon in source.execute("SELECT id,name,location_description,latitude,longitude FROM nodes WHERE is_demo=1"):
            entry = expected.get(node_id)
            if entry and (name, description, lat, lon) != (entry["name"], location_description(entry), entry["latitude"], entry["longitude"]):
                changed = True
        if not changed:
            return None
        folder = path.parent / "backups"
        folder.mkdir(exist_ok=True)
        target = folder / f"{path.stem}-pre-{VERSION}-{utcnow().strftime('%Y%m%d-%H%M%S-%f')}.db"
        with sqlite3.connect(target) as destination:
            source.backup(destination)
    return str(target)


def prepare_demo():
    if not current_app.config["DEMO_ENABLED"]:
        raise Forbidden("Demo mode is disabled.")
    backup = backup_before_migration()
    db.create_all()
    from .seed import seed_demo
    seeded = seed_demo()
    changed = 0
    # All existing-node catalogue changes and scenario initialization commit together.
    for entry in CATALOGUE:
        node = db.session.get(Node, entry["id"])
        if not node or not node.is_demo:
            continue
        values = {"name": entry["name"], "location_description": location_description(entry),
                  "latitude": entry["latitude"], "longitude": entry["longitude"]}
        if any(getattr(node, key) != value for key, value in values.items()):
            for key, value in values.items():
                setattr(node, key, value)
            changed += 1
        if db.session.get(DemoScenario, node.id) is None:
            db.session.add(DemoScenario(node_id=node.id, scenario=entry["scenario"]))
    set_metadata("catalogue_version", VERSION)
    db.session.commit()
    return {"seeded_nodes": seeded, "migrated_nodes": changed, "backup": backup, "catalogue_version": VERSION}


def scenario_payload(node_id, scenario):
    values = {"node_id": node_id, "source": "simulator", "cover_displaced": False}
    for kind, key in THRESHOLD_KEYS.items():
        values[HAZARD_FIELDS[kind]] = current_app.config[key] * 0.2
    if scenario == "partial":
        values.pop("methane_ppm")
        values.pop("h2s_ppm")
        values.update(methane_raw=1420, h2s_raw=350)
    elif scenario in HAZARD_FIELDS:
        values[HAZARD_FIELDS[scenario]] = True if scenario == "cover" else current_app.config[THRESHOLD_KEYS[scenario]] * 1.5
    return values


def select_scenario(node_id, scenario):
    from .services import node_or_404
    node = node_or_404(node_id)
    if not current_app.config["DEMO_ENABLED"]:
        raise Forbidden("Demo mode is disabled.")
    if not node.is_demo:
        raise Conflict("Simulator can only write to registered demo nodes.")
    state = db.session.get(DemoScenario, node_id)
    if any(entry["id"] == node_id and entry["scenario"] == "offline" for entry in CATALOGUE) or (state and state.scenario == "offline"):
        raise Conflict("This node is reserved as the offline example and cannot emit telemetry.")
    if not state:
        state = DemoScenario(node_id=node_id, scenario=scenario)
        db.session.add(state)
    state.scenario = scenario
    state.updated_at = utcnow()
    return ingest(scenario_payload(node_id, scenario))


def emit_tick():
    if not current_app.config["DEMO_ENABLED"] or not current_app.config["DEMO_EMITTER_ENABLED"]:
        raise Forbidden("Explicit demo and emitter configuration are required.")
    emitted = 0
    # Serialize scenario selection with emission: an older tick cannot overwrite a new action.
    db.session.execute(db.text("BEGIN IMMEDIATE"))
    for state in db.session.scalars(db.select(DemoScenario).order_by(DemoScenario.node_id)):
        node = db.session.get(Node, state.node_id)
        if node and node.is_demo and state.scenario != "offline":
            ingest(scenario_payload(node.id, state.scenario))
            emitted += 1
    set_metadata("last_tick_at", iso(utcnow()))
    set_metadata("interval_seconds", current_app.config["DEMO_INTERVAL_SECONDS"])
    db.session.commit()
    return emitted


def session_json():
    last_tick = metadata("last_tick_at")
    interval = float(metadata("interval_seconds", current_app.config["DEMO_INTERVAL_SECONDS"]))
    from datetime import datetime
    alive = last_tick is not None and (utcnow() - datetime.fromisoformat(last_tick.rstrip("Z"))).total_seconds() < max(interval * 2.5, 10)
    enabled = current_app.config["DEMO_ENABLED"]
    return {"enabled": enabled, "emitter_status": "running" if alive and enabled else "stopped" if enabled else "disabled",
            "last_tick_at": last_tick, "interval_seconds": interval, "catalogue_version": metadata("catalogue_version"),
            "region": REGION, "scenarios": {row.node_id: row.scenario for row in db.session.scalars(db.select(DemoScenario))}}


def restore_baseline():
    if not current_app.config["DEMO_ENABLED"]:
        raise Forbidden("Demo mode is disabled.")
    db.session.execute(db.text("BEGIN IMMEDIATE"))
    count = 0
    for entry in CATALOGUE:
        node = db.session.get(Node, entry["id"])
        if not node or not node.is_demo:
            continue
        if entry["scenario"] == "offline":
            continue
        select_scenario(node.id, entry["scenario"])
        count += 1
    db.session.commit()
    return {"refreshed_nodes": count, "history_preserved": True, "incidents_preserved": True}
