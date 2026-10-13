import math
import os

import click
from flask import Flask, jsonify
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException

from .config import Config
from .models import db


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)
    if not app.config["SQLALCHEMY_DATABASE_URI"].startswith("sqlite:"):
        raise ValueError("This milestone supports SQLite databases only")
    for name in ("OFFLINE_TIMEOUT_SECONDS", "SENSOR_STALE_SECONDS",
                 "DEMO_INTERVAL_SECONDS",
                 "METHANE_PPM_DEMO_THRESHOLD", "H2S_PPM_DEMO_THRESHOLD",
                 "WATER_LEVEL_CM_DEMO_THRESHOLD"):
        value = app.config[name]
        if not math.isfinite(value) or value <= 0:
            raise ValueError(f"{name} must be finite and positive")
    os.makedirs(app.instance_path, exist_ok=True)
    db.init_app(app)
    from .routes import api
    app.register_blueprint(api)

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify(error={"code": error.name.lower().replace(" ", "_"),
                              "message": error.description}), error.code

    @app.errorhandler(IntegrityError)
    def integrity_error(error):
        db.session.rollback()
        return jsonify(error={"code": "conflict", "message": "Database constraint conflict; retry request."}), 409

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify(error={"code": "internal_error", "message": "Internal server error."}), 500

    @app.cli.command("init-db")
    def init_db():
        db.create_all()
        click.echo("Database tables initialized (existing data preserved).")

    @app.cli.command("seed-demo")
    def seed_demo_command():
        from .seed import seed_demo
        if not app.config["DEMO_ENABLED"]:
            raise click.ClickException("Demo mode is disabled.")
        db.create_all()
        count = seed_demo()
        click.echo(f"Created {count} demo nodes; existing nodes and telemetry preserved.")

    @app.cli.command("prepare-demo")
    def prepare_demo_command():
        from .demo import emitter_lock, prepare_demo
        try:
            with emitter_lock(db.engine.url.database):
                click.echo(prepare_demo())
        except RuntimeError as error:
            raise click.ClickException(str(error)) from error

    @app.cli.command("register-node")
    @click.option("--node-id", required=True)
    @click.option("--name", required=True)
    @click.option("--location", default="Hardware installation; location not supplied")
    def register_node(node_id, name, location):
        import re
        from .models import Node
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", node_id):
            raise click.ClickException("Invalid node ID; use 1-64 letters, digits, underscores or hyphens.")
        if not name.strip() or len(name) > 120 or len(location) > 240:
            raise click.ClickException("Provide a nonempty name up to 120 characters and location up to 240 characters.")
        db.create_all()
        if db.session.get(Node, node_id):
            raise click.ClickException("Node ID already exists; no changes made.")
        db.session.add(Node(id=node_id, name=name, location_description=location, is_demo=False))
        db.session.commit()
        click.echo(f"Registered hardware node {node_id}.")

    return app
