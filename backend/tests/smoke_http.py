"""Run an actual Flask subprocess against an isolated SQLite database."""

import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import URLError
from urllib.request import Request, urlopen


def main():
    root = Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory(prefix="manhole-smoke-") as directory:
        env = os.environ | {"DATABASE_URL": "sqlite:///" + str(Path(directory) / "smoke.db"),
                            "DEMO_ENABLED": "true"}
        command = [sys.executable, "-m", "flask", "--app", "app"]
        for args in (["init-db"], ["seed-demo"], ["register-node", "--node-id", "HW-SMOKE", "--name", "HTTP smoke bench"]):
            subprocess.run(command + args, cwd=root, env=env, check=True, capture_output=True)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        base = f"http://127.0.0.1:{port}/api"

        def call(path, body=None, method=None):
            request = Request(base + path, data=json.dumps(body).encode() if body else None,
                              headers={"Content-Type": "application/json"}, method=method)
            with urlopen(request, timeout=2) as response:
                return json.load(response)

        with open(Path(directory) / "server.log", "w+") as log:
            server = subprocess.Popen(command + ["run", "--no-reload", "--no-debugger", "--host", "127.0.0.1", "--port", str(port)],
                                      cwd=root, env=env, stdout=log, stderr=log)
            try:
                for _ in range(50):
                    try:
                        assert call("/health") == {"status": "ok"}
                        break
                    except (URLError, TimeoutError):
                        if server.poll() is not None:
                            raise RuntimeError("Flask exited before startup")
                        time.sleep(0.1)
                else:
                    raise RuntimeError("Flask startup timed out")
                assert call("/summary")["total_nodes"] == 9
                assert len(call("/nodes")) == 9
                assert call("/nodes/MH-001")["is_demo"] is True
                assert len(call("/nodes/MH-001/readings?range=24h")) == 25
                assert len(call("/alerts")) == 4
                hardware = call("/reading", {"node_id": "HW-SMOKE", "source": "hardware", "methane_raw": 1420})
                assert hardware["computed_status"] == "unknown"
                hazard = call("/simulator/scenario", {"node_id": "MH-001", "scenario": "methane"})
                assert hazard["computed_status"] == "hazard"
                alert_id = hazard["created_alert_ids"][0]
                assert call(f"/alerts/{alert_id}", {"status": "acknowledged"}, "PATCH")["status"] == "acknowledged"
                assert call("/nodes/MH-001")["computed_status"] == "hazard"
                assert call("/simulator/scenario", {"node_id": "MH-001", "scenario": "normal"})["computed_status"] == "safe"
                assert call(f"/alerts/{alert_id}", {"status": "resolved"}, "PATCH")["status"] == "resolved"
                print("HTTP smoke passed: all 9 routes, SQLite-backed queries, partial hardware ingestion, simulator, acknowledgement, restoration, resolution.")
            except Exception:
                log.flush()
                log.seek(0)
                print(log.read(), file=sys.stderr)
                raise
            finally:
                if os.name == "nt":
                    # Windows venv launchers spawn a child interpreter; stop both.
                    subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"],
                                   check=True, capture_output=True)
                else:
                    server.terminate()
                server.wait(timeout=10)


if __name__ == "__main__":
    main()
