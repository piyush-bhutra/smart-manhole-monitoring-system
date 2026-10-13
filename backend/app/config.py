import os


class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///monitoring.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    DEMO_ENABLED = os.getenv("DEMO_ENABLED", "false").lower() == "true"
    DEMO_EMITTER_ENABLED = os.getenv("DEMO_EMITTER_ENABLED", "false").lower() == "true"
    DEMO_INTERVAL_SECONDS = float(os.getenv("DEMO_INTERVAL_SECONDS", "30"))
    METHANE_PPM_DEMO_THRESHOLD = float(os.getenv("METHANE_PPM_DEMO_THRESHOLD", "1000"))
    H2S_PPM_DEMO_THRESHOLD = float(os.getenv("H2S_PPM_DEMO_THRESHOLD", "10"))
    WATER_LEVEL_CM_DEMO_THRESHOLD = float(os.getenv("WATER_LEVEL_CM_DEMO_THRESHOLD", "80"))
    OFFLINE_TIMEOUT_SECONDS = int(os.getenv("OFFLINE_TIMEOUT_SECONDS", "300"))
    SENSOR_STALE_SECONDS = int(os.getenv("SENSOR_STALE_SECONDS", "300"))
    MAX_CONTENT_LENGTH = 16 * 1024
