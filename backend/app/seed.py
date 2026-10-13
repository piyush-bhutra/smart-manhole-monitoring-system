from datetime import timedelta

from flask import current_app

from .models import Alert, Node, db, utcnow
from .services import HAZARD_FIELDS, THRESHOLD_KEYS, ingest
from .demo_catalogue import CATALOGUE, location_description


def seed_demo():
    now = utcnow()
    created = 0
    for index, entry in enumerate(CATALOGUE, start=1):
        node_id = entry["id"]
        if db.session.get(Node, node_id) is not None:
            continue
        node = Node(id=node_id, name=entry["name"], location_description=location_description(entry),
                    latitude=entry["latitude"], longitude=entry["longitude"], is_demo=True,
                    created_at=now - timedelta(hours=7))
        db.session.add(node)
        db.session.flush()
        for point in range(25):
            when = now - timedelta(minutes=(24 - point) * 15)
            if index == 7:
                when -= timedelta(hours=2)
            values = {"node_id": node_id, "source": "simulator", "cover_displaced": False}
            for kind, key in THRESHOLD_KEYS.items():
                values[HAZARD_FIELDS[kind]] = round(current_app.config[key] * (0.2 + (point % 5) * 0.015), 2)
            if index == 8:
                values = {"node_id": node_id, "source": "simulator", "methane_raw": 1200 + point,
                          "water_level_cm": values["water_level_cm"]}
            if index in (3, 4, 5, 6) and point >= 22:
                kind = {3: "methane", 4: "h2s", 5: "overflow", 6: "cover"}[index]
                values[HAZARD_FIELDS[kind]] = True if kind == "cover" else current_app.config[THRESHOLD_KEYS[kind]] * 1.5
            ingest(values, received_at=when)
        if index == 4:
            alert = db.session.scalar(db.select(Alert).where(Alert.node_id == node_id))
            alert.status = "acknowledged"
            alert.acknowledged_at = now
            alert.notes = "Synthetic incident acknowledged for educational demonstration."
        created += 1
    db.session.commit()
    return created
