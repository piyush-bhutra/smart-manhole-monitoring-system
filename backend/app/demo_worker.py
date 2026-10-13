"""Explicit standalone worker. Flask app factories/reloaders never start it."""

import argparse
import time

from . import create_app
from .demo import emit_tick, emitter_lock, prepare_demo
from .models import db


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="Prepare and emit one tick, then exit.")
    parser.add_argument("--ticks", type=int, default=0, help="Stop after this many ticks (0 runs continuously).")
    args = parser.parse_args()
    if args.ticks < 0:
        parser.error("--ticks cannot be negative")
    app = create_app()
    if not app.config["DEMO_ENABLED"] or not app.config["DEMO_EMITTER_ENABLED"]:
        parser.error("Set DEMO_ENABLED=true and DEMO_EMITTER_ENABLED=true explicitly.")
    with app.app_context():
        with emitter_lock(db.engine.url.database):
            print(prepare_demo(), flush=True)
            count = 0
            while True:
                print(f"Demo tick: {emit_tick()} simulated nodes", flush=True)
                db.session.remove()
                count += 1
                if args.once or (args.ticks and count >= args.ticks):
                    break
                time.sleep(app.config["DEMO_INTERVAL_SECONDS"])


if __name__ == "__main__":
    main()
