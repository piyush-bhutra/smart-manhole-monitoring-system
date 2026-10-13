import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import time
from datetime import timedelta

from app import create_app
from app.demo import emit_tick, emitter_lock, prepare_demo
from app.models import Alert, DemoScenario, Node, Reading, db, utcnow
from sqlalchemy.exc import IntegrityError
import pytest


def test_prepare_migration_backup_idempotence_and_hardware(client):
    from app.seed import seed_demo
    seed_demo()
    old_node = db.session.get(Node, "MH-001")
    old_node.name, old_node.longitude = "Old Bengaluru", 77.5
    hardware = db.session.get(Node, "HW-001")
    hardware.latitude, hardware.longitude = 10, 20
    db.session.commit()
    count = db.session.scalar(db.select(db.func.count(Reading.id)))
    result = prepare_demo()
    assert result["migrated_nodes"] == 1
    assert Path(result["backup"]).is_file()
    with sqlite3.connect(result["backup"]) as backup:
        assert backup.execute("SELECT name FROM nodes WHERE id='MH-001'").fetchone()[0] == "Old Bengaluru"
    assert db.session.get(Node, "MH-001").longitude > 79
    assert db.session.get(Node, "HW-001").longitude == 20
    again = prepare_demo()
    assert again["migrated_nodes"] == 0 and again["backup"] is None
    assert db.session.scalar(db.select(db.func.count(Reading.id))) == count
    assert db.session.execute(db.text("PRAGMA foreign_key_check")).all() == []


def test_persistent_scenarios_ticks_and_incidents(client, app):
    prepare_demo()
    app.config["DEMO_EMITTER_ENABLED"] = True
    response = client.post("/api/simulator/scenario", json={"node_id": "MH-001", "scenario": "methane"})
    alert_id = response.json["created_alert_ids"][0]
    assert client.patch(f"/api/alerts/{alert_id}", json={"status": "acknowledged"}).status_code == 200
    hardware_seen = db.session.get(Node, "HW-001").last_seen_at
    db.session.get(Node, "MH-001").last_seen_at = utcnow() - timedelta(minutes=10)
    db.session.commit()
    assert emit_tick() == 7
    assert emit_tick() == 7
    node = client.get("/api/nodes/MH-001").json
    assert node["computed_status"] == node["safety_status"] == "hazard"
    assert node["demo_scenario"] == "methane" and node["connectivity"] == "online"
    assert client.get("/api/nodes/MH-007").json["connectivity"] == "offline"
    assert db.session.get(Node, "HW-001").last_seen_at == hardware_seen
    assert len(client.get("/api/alerts?status=acknowledged").json) == 2
    assert db.session.scalar(db.select(db.func.count(Alert.id)).where(Alert.node_id == "MH-001")) == 1
    assert client.post("/api/simulator/scenario", json={"node_id": "MH-001", "scenario": "normal"}).status_code == 201
    emit_tick()
    assert client.patch(f"/api/alerts/{alert_id}", json={"status": "resolved"}).status_code == 200
    assert client.get("/api/nodes/MH-001").json["safety_status"] == "safe"


def test_restart_scenario_state(app, client):
    prepare_demo()
    client.post("/api/simulator/scenario", json={"node_id": "MH-002", "scenario": "cover"})
    config = {"TESTING": True, "DEMO_ENABLED": True, "DEMO_EMITTER_ENABLED": True,
              "SQLALCHEMY_DATABASE_URI": app.config["SQLALCHEMY_DATABASE_URI"]}
    restarted = create_app(config)
    with restarted.app_context():
        assert prepare_demo()["migrated_nodes"] == 0
        emit_tick()
        assert restarted.test_client().get("/api/nodes/MH-002").json["demo_scenario"] == "cover"
        assert restarted.test_client().get("/api/nodes/MH-002").json["safety_status"] == "hazard"
        db.session.remove()
        db.engine.dispose()


def test_worker_lock_across_processes_and_release(tmp_path):
    path = tmp_path / "lock.db"
    code = "from app.demo import emitter_lock; import sys;\nwith emitter_lock(sys.argv[1]): print('acquired')"
    with emitter_lock(path):
        result = subprocess.run([sys.executable, "-c", code, str(path)], capture_output=True, text=True)
        assert result.returncode != 0 and "already owns" in result.stderr
    result = subprocess.run([sys.executable, "-c", code, str(path)], capture_output=True, text=True)
    assert result.returncode == 0


def test_worker_disabled_by_default_and_reloader_safe(tmp_path):
    env = os.environ.copy()
    env.update(DEMO_ENABLED="false", DEMO_EMITTER_ENABLED="false", WERKZEUG_RUN_MAIN="true",
               DATABASE_URL="sqlite:///" + str(tmp_path / "disabled.db"))
    result = subprocess.run([sys.executable, "-m", "app.demo_worker", "--once"], env=env, capture_output=True, text=True)
    assert result.returncode != 0
    assert not (tmp_path / "disabled.db").exists()


def test_offline_safety_and_reserved_node(client):
    prepare_demo()
    client.post("/api/simulator/scenario", json={"node_id": "MH-001", "scenario": "methane"})
    db.session.get(Node, "MH-001").last_seen_at = utcnow() - timedelta(minutes=10)
    db.session.commit()
    result = client.get("/api/nodes/MH-001").json
    assert result["connectivity"] == result["computed_status"] == "offline"
    assert result["safety_status"] == "unknown" and result["last_measured_safety"] == "hazard"
    assert result["reading_freshness"] == "stale"
    assert client.post("/api/simulator/scenario", json={"node_id": "MH-007", "scenario": "normal"}).status_code == 409
    assert client.post("/api/reading", json={"node_id": "MH-007", "source": "simulator", "methane_raw": 1}).status_code == 409


def test_baseline_preserves_history_and_alert_lifecycle(client):
    prepare_demo()
    response = client.post("/api/simulator/scenario", json={"node_id": "MH-001", "scenario": "methane"})
    alert_id = response.json["created_alert_ids"][0]
    client.patch(f"/api/alerts/{alert_id}", json={"status": "acknowledged"})
    before = db.session.scalar(db.select(db.func.count(Reading.id)))
    assert client.post("/api/demo/baseline", json={}).status_code == 400
    result = client.post("/api/demo/baseline", json={"confirm": "restore_demo_measurements"})
    assert result.status_code == 200 and result.json["refreshed_nodes"] == 7
    assert db.session.get(Alert, alert_id).status == "acknowledged"
    assert db.session.scalar(db.select(db.func.count(Reading.id))) == before + 7
    assert db.session.get(DemoScenario, "MH-001").scenario == "normal"


def test_migration_rollback_and_catalogue_hardware_collision(client, monkeypatch):
    from app.seed import seed_demo
    from app import demo
    seed_demo()
    db.session.get(Node, "MH-003").is_demo = False
    db.session.commit()
    assert prepare_demo()["migrated_nodes"] == 0
    assert db.session.get(DemoScenario, "MH-003") is None
    old_name = db.session.get(Node, "MH-001").name
    db.session.commit()
    entries = list(demo.CATALOGUE)
    entries[0] = entries[0] | {"name": "Should roll back"}
    entries[1] = entries[1] | {"latitude": 999}
    monkeypatch.setattr(demo, "CATALOGUE", tuple(entries))
    with pytest.raises(IntegrityError):
        prepare_demo()
    db.session.rollback()
    assert db.session.get(Node, "MH-001").name == old_name
    assert db.session.get(Node, "MH-003").is_demo is False


def test_real_worker_keeps_nodes_current_beyond_timeout(tmp_path):
    path = tmp_path / "worker.db"
    env = os.environ | {"DEMO_ENABLED": "true", "DEMO_EMITTER_ENABLED": "true", "DEMO_INTERVAL_SECONDS": "0.1",
                       "OFFLINE_TIMEOUT_SECONDS": "1", "SENSOR_STALE_SECONDS": "1", "DATABASE_URL": "sqlite:///" + str(path)}
    worker = subprocess.Popen([sys.executable, "-m", "app.demo_worker", "--ticks", "35"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if worker.poll() is not None:
                raise AssertionError(worker.stderr.read().decode())
            if path.exists():
                with sqlite3.connect(path) as connection:
                    if connection.execute("SELECT count(*) FROM sqlite_master WHERE name='demo_metadata'").fetchone()[0]:
                        if connection.execute("SELECT count(*) FROM demo_metadata WHERE key='last_tick_at'").fetchone()[0]:
                            break
            time.sleep(.1)
        else:
            raise AssertionError("Worker did not start")
        time.sleep(2.2)
        config = {"TESTING": True, "DEMO_ENABLED": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///" + str(path),
                  "OFFLINE_TIMEOUT_SECONDS": 1, "SENSOR_STALE_SECONDS": 1}
        application = create_app(config)
        with application.app_context():
            nodes = application.test_client().get('/api/nodes').json
            assert sum(node['connectivity'] == 'online' for node in nodes) == 7
            assert next(node for node in nodes if node['id'] == 'MH-007')['connectivity'] == 'offline'
            assert db.session.scalar(db.select(db.func.count(Alert.id))) == 4
            db.session.remove()
            db.engine.dispose()
    finally:
        worker.wait(timeout=10)
        worker.stderr.close()
