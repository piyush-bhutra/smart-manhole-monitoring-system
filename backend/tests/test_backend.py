from datetime import timedelta

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from app import create_app
from app.models import Alert, Node, Reading, db, utcnow
from app.seed import seed_demo


def post(client, **fields):
    return client.post("/api/reading", json={"node_id": "HW-001", "source": "hardware", **fields})


def normal(client, **overrides):
    return post(client, **({"methane_ppm": 10, "h2s_ppm": 1, "water_level_cm": 10,
                            "cover_displaced": False} | overrides))


def test_startup_health_schema(client):
    assert client.get("/api/health").json == {"status": "ok"}
    assert set(inspect(db.engine).get_table_names()) == {"nodes", "readings", "alerts", "demo_scenarios", "demo_metadata"}
    assert client.get("/api/summary").json["offline"] == 1


def test_seed_idempotence_and_mixture(client):
    assert seed_demo() == 8
    counts = [db.session.scalar(db.select(db.func.count(model.id))) for model in (Node, Reading, Alert)]
    assert counts == [9, 200, 4]
    assert seed_demo() == 0
    assert counts == [db.session.scalar(db.select(db.func.count(model.id))) for model in (Node, Reading, Alert)]
    nodes = client.get("/api/nodes").json
    assert {node["computed_status"] for node in nodes} == {"safe", "hazard", "offline", "unknown"}
    assert all(node["is_demo"] for node in nodes if node["id"].startswith("MH-"))
    assert all(12 <= node["latitude"] <= 13 for node in nodes if node["is_demo"])
    assert {row["source"] for row in client.get("/api/nodes/MH-001/readings?range=24h").json} == {"simulator"}
    assert client.get("/api/summary").json["total_nodes"] == 9


def test_ingestion_persists_and_history(client):
    response = normal(client)
    assert response.status_code == 201
    assert response.json["computed_status"] == "safe"
    row = db.session.get(Reading, response.json["reading_id"])
    assert row.methane_ppm == 10
    detail = client.get("/api/nodes/HW-001").json
    assert detail["latest_reading"]["id"] == row.id
    assert detail["sensors"]["cover_displaced"]["value"] is False
    assert detail["last_seen_at"].endswith("Z")
    assert len(client.get("/api/nodes/HW-001/readings?range=1h").json) == 1


def test_partial_missing_null_and_raw(client):
    response = post(client, methane_raw=4000, h2s_ppm=None)
    assert response.status_code == 201
    assert response.json["computed_status"] == "unknown"
    assert response.json["created_alert_ids"] == []
    assert client.get("/api/nodes/HW-001").json["latest_reading"]["h2s_ppm"] is None
    normal(client)
    post(client, water_level_cm=20)
    assert client.get("/api/nodes/HW-001").json["computed_status"] == "safe"
    post(client, methane_raw=4000)
    detail = client.get("/api/nodes/HW-001").json
    assert detail["computed_status"] == "unknown"
    assert detail["sensors"]["methane_ppm"]["value"] is None


@pytest.mark.parametrize("fields", [
    {}, {"methane_ppm": None}, {"methane_ppm": "10"}, {"methane_ppm": True},
    {"methane_ppm": -1}, {"methane_ppm": float("inf")}, {"methane_ppm": float("nan")},
    {"methane_raw": -1}, {"water_level_cm": -2}, {"cover_displaced": 1},
    {"methane_ppm": 1, "latitude": 91}, {"methane_ppm": 1, "longitude": -181},
    {"methane_ppm": 1, "source": "fake"}, {"methane_ppm": 1, "node_id": ""},
    {"methane_ppm": 1, "node_id": ["bad"]}, {"methane_ppm": 1, "device_timestamp": "2026-01-01"},
    {"methane_ppm": 1, "device_timestamp": 123}, {"methane_ppm": 1, "computed_status": "safe"},
])
def test_invalid_ingestion_atomic(client, fields):
    response = post(client, **fields)
    assert response.status_code == 400
    assert "error" in response.json
    assert db.session.scalar(db.select(db.func.count(Reading.id))) == 0


def test_json_errors_and_not_found(client):
    assert client.post("/api/reading", json=[]).status_code == 400
    assert client.post("/api/reading", data="{", content_type="application/json").status_code == 400
    assert client.post("/api/reading", data="text").status_code == 415
    assert client.get("/api/nodes/nope").status_code == 404
    assert post(client, node_id="missing", methane_ppm=1).status_code == 404
    assert client.get("/api/nodes/HW-001/readings?range=bad").status_code == 400
    assert client.get("/api/alerts?status=bad").status_code == 400
    assert client.get("/api/nope").is_json
    assert client.put("/api/reading").status_code == 405


@pytest.mark.parametrize("fields, kind", [({"methane_ppm": 1000}, "methane"),
    ({"h2s_ppm": 10}, "h2s"), ({"water_level_cm": 80}, "overflow"), ({"cover_displaced": True}, "cover")])
def test_hazards_duplicate_prevention_and_workflow(client, fields, kind):
    normal(client)
    first = post(client, **fields)
    alert_id = first.json["created_alert_ids"][0]
    assert first.json["computed_status"] == "hazard"
    assert post(client, **fields).json["created_alert_ids"] == []
    url = f"/api/alerts/{alert_id}"
    assert client.patch(url, json={"status": "acknowledged"}).status_code == 200
    assert client.get("/api/nodes/HW-001").json["computed_status"] == "hazard"
    assert post(client, **fields).json["created_alert_ids"] == []
    assert client.patch(url, json={"status": "resolved"}).status_code == 409
    assert normal(client).json["computed_status"] == "safe"
    assert db.session.get(Alert, alert_id).status == "acknowledged"
    resolved = client.patch(url, json={"status": "resolved", "notes": "Verified normal"})
    assert resolved.status_code == 200
    assert resolved.json["resolved_at"].endswith("Z")
    assert resolved.json["alert_type"] == kind
    assert post(client, **fields).json["created_alert_ids"] != []


def test_stale_sensors_and_status_precedence(client):
    normal(client)
    old = db.session.scalar(db.select(Reading))
    old.received_at = utcnow() - timedelta(minutes=10)
    db.session.commit()
    post(client, water_level_cm=10)
    detail = client.get("/api/nodes/HW-001").json
    assert detail["computed_status"] == "unknown"
    assert detail["sensors"]["methane_ppm"]["fresh"] is False
    post(client, methane_ppm=2000)
    assert client.get("/api/nodes/HW-001").json["computed_status"] == "hazard"
    node = db.session.get(Node, "HW-001")
    node.last_seen_at = utcnow() - timedelta(minutes=10)
    db.session.commit()
    assert client.get("/api/nodes/HW-001").json["computed_status"] == "offline"
    alert_id = client.get("/api/alerts").json[0]["id"]
    assert client.patch(f"/api/alerts/{alert_id}", json={"status": "resolved"}).status_code == 409


def test_simulator_and_hardware_isolation(client, app):
    seed_demo()
    for scenario in ("normal", "methane", "h2s", "overflow", "cover"):
        response = client.post("/api/simulator/scenario", json={"node_id": "MH-001", "scenario": scenario})
        assert response.status_code == 201
        assert response.json["computed_status"] == ("safe" if scenario == "normal" else "hazard")
    assert client.post("/api/simulator/scenario", json={"node_id": "HW-001", "scenario": "normal"}).status_code == 409
    assert post(client, node_id="MH-001", methane_ppm=1).status_code == 409
    assert post(client, source="simulator", methane_ppm=1).status_code == 409
    app.config["DEMO_ENABLED"] = False
    assert client.post("/api/simulator/scenario", json={"node_id": "MH-001", "scenario": "normal"}).status_code == 403
    assert post(client, source="simulator", node_id="MH-001", methane_ppm=1).status_code == 403
    assert post(client, methane_raw=100).status_code == 201


def test_summary_alert_filter_and_patch_validation(client):
    normal(client, methane_ppm=2000)
    alert = client.get("/api/alerts?status=active").json[0]
    url = f"/api/alerts/{alert['id']}"
    summary = client.get("/api/summary").json
    assert summary["hazard"] == summary["active_incidents"] == 1
    assert client.patch(url, json={"status": "invalid"}).status_code == 400
    assert client.patch(url, json={"status": "acknowledged", "notes": 1}).status_code == 400
    assert client.patch("/api/alerts/999", json={"status": "resolved"}).status_code == 404
    assert client.patch(url, json={"status": "acknowledged"}).status_code == 200
    assert client.patch(url, json={"status": "acknowledged"}).status_code == 409
    summary = client.get("/api/summary").json
    assert summary["active_incidents"] == 0
    assert summary["unresolved_incidents"] == summary["acknowledged_incidents"] == 1


def test_db_constraints(client):
    db.session.add(Reading(node_id="nonexistent", source="hardware", methane_ppm=1))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()
    normal(client, methane_ppm=2000)
    db.session.add(Alert(node_id="HW-001", alert_type="methane", source="hardware"))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_device_timestamp_and_coordinates(client):
    response = post(client, methane_raw=50, latitude=12.9, longitude=77.5,
                    device_timestamp="2026-10-13T12:00:00+05:30")
    assert response.status_code == 201
    detail = client.get("/api/nodes/HW-001").json
    assert detail["latitude"] == 12.9
    assert detail["latest_reading"]["device_timestamp"] == "2026-10-13T06:30:00.000Z"


def test_restart_preserves_telemetry_and_cli(tmp_path):
    config = {"TESTING": True, "DEMO_ENABLED": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///" + str(tmp_path / "restart.db")}
    first = create_app(config)
    runner = first.test_cli_runner()
    assert runner.invoke(args=["init-db"]).exit_code == 0
    assert runner.invoke(args=["seed-demo"]).exit_code == 0
    response = first.test_client().post("/api/simulator/scenario", json={"node_id": "MH-001", "scenario": "methane"})
    reading_id = response.json["reading_id"]
    with first.app_context():
        db.engine.dispose()
    second = create_app(config)
    assert second.test_cli_runner().invoke(args=["seed-demo"]).exit_code == 0
    detail = second.test_client().get("/api/nodes/MH-001").json
    assert detail["latest_reading"]["id"] == reading_id
    assert detail["computed_status"] == "hazard"
    with second.app_context():
        db.engine.dispose()


def test_register_hardware_cli_and_seed_collision(client, app):
    runner = app.test_cli_runner()
    args = ["register-node", "--node-id", "MH-001", "--name", "Real bench"]
    assert runner.invoke(args=args).exit_code == 0
    assert post(client, node_id="MH-001", methane_raw=150).status_code == 201
    assert seed_demo() == 7
    node = client.get("/api/nodes/MH-001").json
    assert node["is_demo"] is False
    assert node["latest_reading"]["methane_raw"] == 150
    assert runner.invoke(args=args).exit_code != 0
    assert runner.invoke(args=["register-node", "--node-id", "bad id", "--name", "Bench"]).exit_code != 0
    app.config["DEMO_ENABLED"] = False
    assert runner.invoke(args=["seed-demo"]).exit_code != 0


def test_contract_keys(client):
    result = normal(client).json
    assert set(result) == {"reading_id", "node_id", "computed_status", "created_alert_ids", "received_at"}
    node = client.get("/api/nodes/HW-001").json
    assert set(node) == {"id", "name", "location_description", "latitude", "longitude", "is_demo",
                         "created_at", "last_seen_at", "computed_status", "latest_reading", "sensors",
                         "connectivity", "safety_status", "last_measured_safety", "reading_freshness", "demo_scenario"}
    fields = {"methane_raw", "methane_ppm", "h2s_raw", "h2s_ppm", "water_level_cm", "cover_displaced"}
    assert set(node["latest_reading"]) == fields | {"id", "node_id", "received_at", "device_timestamp", "source"}
    assert set(node["sensors"]) == fields
    for sensor in node["sensors"].values():
        assert set(sensor) == {"value", "received_at", "source", "fresh"}
    normal(client, methane_ppm=2000)
    alert = client.get("/api/alerts").json[0]
    assert set(alert) == {"id", "node_id", "alert_type", "severity", "status", "notes", "source",
                          "triggered_at", "last_observed_at", "acknowledged_at", "resolved_at"}


def test_raw_or_missing_cannot_resolve_incident(client):
    response = post(client, methane_ppm=2000)
    alert_id = response.json["created_alert_ids"][0]
    post(client, methane_raw=5)
    assert client.patch(f"/api/alerts/{alert_id}", json={"status": "resolved"}).status_code == 409
    post(client, water_level_cm=2)
    assert client.patch(f"/api/alerts/{alert_id}", json={"status": "resolved"}).status_code == 409


def test_configurable_thresholds(client, app):
    app.config["METHANE_PPM_DEMO_THRESHOLD"] = 50
    assert post(client, methane_ppm=49).json["created_alert_ids"] == []
    assert len(post(client, methane_ppm=50).json["created_alert_ids"]) == 1
    assert client.get("/api/summary").json["demo_thresholds"]["methane"] == 50
