"""Fictional placements near recognizable VIT Vellore campus zones, not surveyed assets."""

VERSION = "vit-vellore-1"
REGION = {"name": "VIT Vellore, Tamil Nadu", "center": [12.9710, 79.1590], "fictional": True}
CATALOGUE = (
    {"id": "MH-001", "name": "Main Gate Approach", "latitude": 12.9687, "longitude": 79.1559, "scenario": "normal"},
    {"id": "MH-002", "name": "Periyar Library Walk", "latitude": 12.9696, "longitude": 79.1582, "scenario": "normal"},
    {"id": "MH-003", "name": "Technology Tower Lane", "latitude": 12.9704, "longitude": 79.1591, "scenario": "methane"},
    {"id": "MH-004", "name": "SMV Block Approach", "latitude": 12.9695, "longitude": 79.1577, "scenario": "h2s"},
    {"id": "MH-005", "name": "SJT Campus Road", "latitude": 12.9713, "longitude": 79.1638, "scenario": "overflow"},
    {"id": "MH-006", "name": "GDN Block Walk", "latitude": 12.9690, "longitude": 79.1568, "scenario": "cover"},
    {"id": "MH-007", "name": "Sports Ground Service Road", "latitude": 12.9726, "longitude": 79.1606, "scenario": "offline"},
    {"id": "MH-008", "name": "Hostel Approach Road", "latitude": 12.9732, "longitude": 79.1587, "scenario": "partial"},
)


def location_description(entry):
    return f"Fictional VIT Vellore demonstration placement near {entry['name']}; not a surveyed manhole."
