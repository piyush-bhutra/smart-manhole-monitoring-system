export type Source = 'simulator' | 'hardware'
export type NodeStatus = 'safe' | 'hazard' | 'offline' | 'unknown'
export type AlertStatus = 'active' | 'acknowledged' | 'resolved'
export type Hazard = 'methane' | 'h2s' | 'overflow' | 'cover'
export type Scenario = 'normal' | Hazard
export type Range = '1h' | '24h' | '7d'
export type SensorField =
  'methane_raw' | 'methane_ppm' | 'h2s_raw' | 'h2s_ppm' | 'water_level_cm' | 'cover_displaced'
export interface Sensor<T = number | boolean> {
  value: T | null
  received_at: string | null
  source: Source | null
  fresh: boolean
}
export interface Reading {
  id: number
  node_id: string
  received_at: string
  device_timestamp: string | null
  source: Source
  methane_raw: number | null
  methane_ppm: number | null
  h2s_raw: number | null
  h2s_ppm: number | null
  water_level_cm: number | null
  cover_displaced: boolean | null
}
export interface MonitorNode {
  id: string
  name: string
  location_description: string
  latitude: number | null
  longitude: number | null
  is_demo: boolean
  created_at: string
  last_seen_at: string | null
  computed_status: NodeStatus
  connectivity: 'online' | 'offline'
  safety_status: 'safe' | 'hazard' | 'unknown'
  last_measured_safety: 'safe' | 'hazard' | 'unknown'
  reading_freshness: 'current' | 'stale'
  demo_scenario: Scenario | 'partial' | 'offline' | null
  latest_reading: Reading | null
  sensors: Record<SensorField, Sensor>
}
export interface Alert {
  id: number
  node_id: string
  alert_type: Hazard
  severity: 'warning' | 'critical'
  status: AlertStatus
  triggered_at: string
  last_observed_at: string
  acknowledged_at: string | null
  resolved_at: string | null
  notes: string | null
  source: Source
}
export interface Summary {
  total_nodes: number
  safe: number
  hazard: number
  offline: number
  unknown: number
  active_incidents: number
  acknowledged_incidents: number
  unresolved_incidents: number
  demo_nodes: number
  generated_at: string
  demo_enabled: boolean
  demo_thresholds: Record<'methane' | 'h2s' | 'overflow', number>
  latest_telemetry_at: string | null
  sensor_stale_seconds: number
  demo_session: {
    enabled: boolean
    emitter_status: 'running' | 'stopped' | 'disabled'
    last_tick_at: string | null
    interval_seconds: number
    catalogue_version: string | null
    region: { name: string; center: [number, number]; fictional: boolean }
    scenarios: Record<string, Scenario | 'partial' | 'offline'>
  }
}
export interface IngestResult {
  reading_id: number
  node_id: string
  computed_status: NodeStatus
  created_alert_ids: number[]
  received_at: string
}
export interface Snapshot {
  summary: Summary
  nodes: MonitorNode[]
  alerts: Alert[]
}
