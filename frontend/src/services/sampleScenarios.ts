import type { Alert, Hazard, MonitorNode, Reading, Sensor, Snapshot } from '../types/api'

export type SampleScenarioId = 'gas' | 'campus' | 'combined'
export const sampleScenarios: { id: SampleScenarioId; name: string; description: string }[] = [
  { id: 'gas', name: 'Developing gas incident', description: 'Watch methane rise, trigger an alert and return to normal.' },
  { id: 'campus', name: 'Multiple campus locations', description: 'Overflow, H₂S and a displaced cover across three locations.' },
  { id: 'combined', name: 'Combined hazards', description: 'Methane and overflow together. One clears before the other.' },
]

const catalogue = [
  ['Main Gate Approach', 12.9687, 79.1559],
  ['Periyar Library Walk', 12.9696, 79.1582],
  ['Technology Tower Lane', 12.9704, 79.1591],
  ['SMV Block Approach', 12.9695, 79.1577],
  ['SJT Campus Road', 12.9713, 79.1638],
  ['GDN Block Walk', 12.9690, 79.1568],
  ['Sports Ground Service Road', 12.9726, 79.1606],
  ['Hostel Approach Road', 12.9732, 79.1587],
] as const
const thresholds = { methane: 1000, h2s: 10, overflow: 80 }
const fields = { methane: 'methane_ppm', h2s: 'h2s_ppm', overflow: 'water_level_cm', cover: 'cover_displaced' } as const
const hazards: Hazard[] = ['methane', 'h2s', 'overflow', 'cover']
const duration = 48

function sampleReading(id: SampleScenarioId, nodeIndex: number, second: number, startedAt: number): Reading {
  const reading: Reading = {
    id: second * 10 + nodeIndex + 1, node_id: `MH-${String(nodeIndex + 1).padStart(3, '0')}`,
    received_at: new Date(startedAt + second * 1000).toISOString(), device_timestamp: null,
    source: 'simulator', methane_raw: null, h2s_raw: null,
    methane_ppm: 200, h2s_ppm: 2, water_level_cm: 16, cover_displaced: false,
  }
  if (id === 'gas' && nodeIndex === 0) {
    reading.methane_ppm = second < 8 ? 200 : second < 16 ? 650 : second < 32 ? 1500 : 200
  }
  if (id === 'campus') {
    if (nodeIndex === 4 && second >= 8) reading.water_level_cm = second < 16 ? 65 : 110
    if (nodeIndex === 3 && second >= 24) reading.h2s_ppm = 15
    if (nodeIndex === 5 && second >= 32) reading.cover_displaced = true
  }
  if (id === 'combined' && nodeIndex === 0) {
    reading.methane_ppm = second < 8 ? 200 : second < 16 ? 700 : second < 32 ? 1600 : 200
    reading.water_level_cm = second < 8 ? 16 : second < 16 ? 60 : second < 24 ? 100 : second < 32 ? 120 : second < 40 ? 110 : 16
  }
  return reading
}

function isHazard(reading: Reading, hazard: Hazard) {
  const value = reading[fields[hazard]]
  return hazard === 'cover' ? value === true : typeof value === 'number' && value >= thresholds[hazard]
}

function observation(value: number | boolean | null, at: string): Sensor {
  return { value, received_at: value === null ? null : at, source: value === null ? null : 'simulator', fresh: value !== null }
}

function stageFor(id: SampleScenarioId, elapsed: number) {
  if (elapsed >= duration) return { title: 'Completed', caption: 'Sequence complete. Inspect the final state or restart to watch again.', focusId: id === 'campus' ? 'MH-006' : 'MH-001' }
  if (id === 'gas') {
    if (elapsed < 8) return { title: 'Normal network', caption: 'All eight sample locations report normal values.', focusId: 'MH-001' }
    if (elapsed < 16) return { title: 'Gas is rising', caption: 'Methane is increasing but remains below the 1,000 ppm demonstration threshold.', focusId: 'MH-001' }
    if (elapsed < 32) return { title: 'Methane alert', caption: 'The threshold is crossed. Watch the gas animation, map marker and new incident.', focusId: 'MH-001' }
    return { title: 'Measurements recovered', caption: 'Gas is normal again. The incident stays open for operator review.', focusId: 'MH-001' }
  }
  if (id === 'campus') {
    if (elapsed < 8) return { title: 'Normal network', caption: 'A fictional eight-location campus network starts in normal conditions.', focusId: 'MH-005' }
    if (elapsed < 16) return { title: 'Water is rising', caption: 'Water at SJT Campus Road approaches the demonstration threshold.', focusId: 'MH-005' }
    if (elapsed < 24) return { title: 'Overflow incident', caption: 'Overflow is detected at SJT Campus Road. The other locations remain normal.', focusId: 'MH-005' }
    if (elapsed < 32) return { title: 'Second location affected', caption: 'H₂S rises at SMV Block Approach while the overflow remains active.', focusId: 'MH-004' }
    return { title: 'Three concurrent incidents', caption: 'The cover at GDN Block Walk is displaced. Three locations now require attention.', focusId: 'MH-006' }
  }
  if (elapsed < 8) return { title: 'Normal network', caption: 'Main Gate Approach begins with normal gas, water and cover observations.', focusId: 'MH-001' }
  if (elapsed < 16) return { title: 'Two channels rising', caption: 'Methane and water increase together, still below their demonstration thresholds.', focusId: 'MH-001' }
  if (elapsed < 32) return { title: 'Combined methane and overflow', caption: 'Two hazards at one location create two incidents. Both remain visible together.', focusId: 'MH-001' }
  if (elapsed < 40) return { title: 'Gas clears; overflow remains', caption: 'Methane is normal, but water remains above threshold. The location is still hazardous.', focusId: 'MH-001' }
  return { title: 'Both measurements recovered', caption: 'Both readings are normal. The two incidents remain open; recovery does not resolve them.', focusId: 'MH-001' }
}

export interface SampleFrame {
  snapshot: Snapshot
  history: Record<string, Reading[]>
  stage: ReturnType<typeof stageFor>
  elapsed: number
  duration: number
  completed: boolean
}

/** Local presentation data only. Never sent to ingestion or persisted as telemetry. */
export function buildSampleFrame(id: SampleScenarioId, elapsedSeconds: number, startedAt: number): SampleFrame {
  const elapsed = Math.min(duration, Math.max(0, Math.floor(Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0)))
  const at = new Date(startedAt + elapsed * 1000).toISOString()
  const history: Record<string, Reading[]> = {}
  const alerts: Alert[] = []
  const nodes: MonitorNode[] = catalogue.map(([name, latitude, longitude], index) => {
    const reading = sampleReading(id, index, elapsed, startedAt)
    const readings = Array.from({ length: elapsed + 1 }, (_, second) => sampleReading(id, index, second, startedAt))
    history[reading.node_id] = readings
    for (const [kindIndex, hazard] of hazards.entries()) {
      const unsafe = readings.filter(row => isHazard(row, hazard))
      if (unsafe.length) alerts.push({
        id: 900000 + index * 10 + kindIndex, node_id: reading.node_id, alert_type: hazard,
        severity: hazard === 'cover' ? 'warning' : 'critical', status: 'active',
        triggered_at: unsafe[0].received_at, last_observed_at: unsafe[unsafe.length - 1].received_at,
        acknowledged_at: null, resolved_at: null, notes: 'Built-in sample incident; not a device event.', source: 'simulator',
      })
    }
    const safety = hazards.some(hazard => isHazard(reading, hazard)) ? 'hazard' : 'safe'
    return {
      id: reading.node_id, name, latitude, longitude,
      location_description: `Fictional sample placement near ${name}; not a surveyed manhole.`,
      is_demo: true, created_at: new Date(startedAt).toISOString(), last_seen_at: at,
      computed_status: safety, safety_status: safety, last_measured_safety: safety,
      connectivity: 'online', reading_freshness: 'current', demo_scenario: null,
      latest_reading: reading,
      sensors: {
        methane_raw: observation(null, at), methane_ppm: observation(reading.methane_ppm, at),
        h2s_raw: observation(null, at), h2s_ppm: observation(reading.h2s_ppm, at),
        water_level_cm: observation(reading.water_level_cm, at), cover_displaced: observation(reading.cover_displaced, at),
      },
    }
  })
  // Display incidents in the order their threshold crossings actually occurred.
  alerts.sort((a, b) => a.triggered_at.localeCompare(b.triggered_at) || a.id - b.id)
  return {
    elapsed, duration, completed: elapsed === duration, stage: stageFor(id, elapsed), history,
    snapshot: {
      sample: true, nodes, alerts,
      summary: {
        total_nodes: nodes.length, safe: nodes.filter(node => node.safety_status === 'safe').length,
        hazard: nodes.filter(node => node.safety_status === 'hazard').length, offline: 0, unknown: 0,
        active_incidents: alerts.length, acknowledged_incidents: 0, unresolved_incidents: alerts.length,
        demo_nodes: nodes.length, generated_at: at, demo_enabled: false,
        demo_thresholds: { ...thresholds }, latest_telemetry_at: at, sensor_stale_seconds: 300,
        demo_session: {
          enabled: false, emitter_status: 'disabled', last_tick_at: null, interval_seconds: 0,
          catalogue_version: 'vit-vellore-samples-1', scenarios: {},
          region: { name: 'VIT Vellore, Tamil Nadu', center: [12.971, 79.159], fictional: true },
        },
      },
    },
  }
}
