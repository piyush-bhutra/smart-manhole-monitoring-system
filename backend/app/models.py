from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import CheckConstraint, Index, event, text
from sqlalchemy.engine import Engine

db = SQLAlchemy()


def utcnow():
    # SQLite stores naive datetimes; all persisted times are UTC.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(value):
    return value.isoformat(timespec="milliseconds") + "Z" if value else None


@event.listens_for(Engine, "connect")
def enable_foreign_keys(connection, _):
    if connection.__class__.__module__.startswith("sqlite3"):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


class Node(db.Model):
    __tablename__ = "nodes"
    id = db.Column(db.String(64), primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    location_description = db.Column(db.String(240), nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    is_demo = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    last_seen_at = db.Column(db.DateTime)
    readings = db.relationship("Reading", back_populates="node", lazy="dynamic")
    alerts = db.relationship("Alert", back_populates="node", lazy="dynamic")
    __table_args__ = (
        CheckConstraint("latitude IS NULL OR latitude BETWEEN -90 AND 90"),
        CheckConstraint("longitude IS NULL OR longitude BETWEEN -180 AND 180"),
    )


class Reading(db.Model):
    __tablename__ = "readings"
    id = db.Column(db.Integer, primary_key=True)
    node_id = db.Column(db.String(64), db.ForeignKey("nodes.id"), nullable=False)
    received_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    device_timestamp = db.Column(db.DateTime)
    methane_raw = db.Column(db.Float)
    methane_ppm = db.Column(db.Float)
    h2s_raw = db.Column(db.Float)
    h2s_ppm = db.Column(db.Float)
    water_level_cm = db.Column(db.Float)
    cover_displaced = db.Column(db.Boolean)
    source = db.Column(db.String(16), nullable=False)
    node = db.relationship("Node", back_populates="readings")
    __table_args__ = (
        CheckConstraint("source IN ('simulator', 'hardware')"),
        *(CheckConstraint(f"{field} IS NULL OR {field} >= 0") for field in (
            "methane_raw", "methane_ppm", "h2s_raw", "h2s_ppm", "water_level_cm"
        )),
        Index("ix_readings_node_time", "node_id", "received_at", "id"),
    )


class Alert(db.Model):
    __tablename__ = "alerts"
    id = db.Column(db.Integer, primary_key=True)
    node_id = db.Column(db.String(64), db.ForeignKey("nodes.id"), nullable=False)
    alert_type = db.Column(db.String(16), nullable=False)
    severity = db.Column(db.String(16), nullable=False, default="critical")
    status = db.Column(db.String(16), nullable=False, default="active")
    triggered_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    last_observed_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    acknowledged_at = db.Column(db.DateTime)
    resolved_at = db.Column(db.DateTime)
    notes = db.Column(db.String(1000))
    source = db.Column(db.String(16), nullable=False)
    node = db.relationship("Node", back_populates="alerts")
    __table_args__ = (
        CheckConstraint("alert_type IN ('methane', 'h2s', 'overflow', 'cover')"),
        CheckConstraint("status IN ('active', 'acknowledged', 'resolved')"),
        CheckConstraint("severity IN ('warning', 'critical')"),
        CheckConstraint("source IN ('simulator', 'hardware')"),
        Index("uq_alert_unresolved", "node_id", "alert_type", unique=True,
              sqlite_where=text("status != 'resolved'")),
    )


class DemoScenario(db.Model):
    __tablename__ = "demo_scenarios"
    node_id = db.Column(db.String(64), db.ForeignKey("nodes.id"), primary_key=True)
    scenario = db.Column(db.String(16), nullable=False)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    __table_args__ = (CheckConstraint("scenario IN ('normal','methane','h2s','overflow','cover','partial','offline')"),)


class DemoMetadata(db.Model):
    __tablename__ = "demo_metadata"
    key = db.Column(db.String(64), primary_key=True)
    value = db.Column(db.Text, nullable=False)
