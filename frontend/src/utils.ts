import type { Alert, MonitorNode, Sensor, Summary } from './types/api'

export const statusLabels = {
  safe: 'Safe',
  hazard: 'Hazard',
  offline: 'Offline',
  unknown: 'Partial data',
  active: 'Active',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
}
export const hazardLabels = {
  methane: 'Methane elevated',
  h2s: 'H2S elevated',
  overflow: 'Water overflow',
  cover: 'Cover displaced',
}
export const colors = { safe: '#43d3a3', hazard: '#fb7185', offline: '#82929a', unknown: '#f4bf65' }
export function dateTime(value: string | null) {
  return value
    ? new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Never received'
}
export function time(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
export function number(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}
export function gas(node: MonitorNode, kind: 'methane' | 'h2s') {
  const ppm = node.sensors[`${kind}_ppm`]
  const raw = node.sensors[`${kind}_raw`]
  return ppm.value !== null ? { sensor: ppm, unit: 'ppm' } : { sensor: raw, unit: 'raw' }
}
export function readingValue(sensor: Sensor, unit = '') {
  return sensor.value === null
    ? 'Unknown'
    : `${typeof sensor.value === 'number' ? number(sensor.value) : sensor.value ? 'Displaced' : 'Seated'}${unit ? ` ${unit}` : ''}`
}
export function canResolve(alert: Alert, node: MonitorNode | undefined, summary: Summary) {
  if (!node || node.computed_status === 'offline' || alert.status === 'resolved') return false
  const field = (
    {
      methane: 'methane_ppm',
      h2s: 'h2s_ppm',
      overflow: 'water_level_cm',
      cover: 'cover_displaced',
    } as const
  )[alert.alert_type]
  const sensor = node.sensors[field]
  if (!sensor.fresh || sensor.value === null) return false
  return alert.alert_type === 'cover'
    ? sensor.value === false
    : typeof sensor.value === 'number' && sensor.value < summary.demo_thresholds[alert.alert_type]
}

export function resolutionReason(alert: Alert, node: MonitorNode | undefined, summary: Summary) {
  if (canResolve(alert, node, summary)) return null
  if (!node || node.connectivity === 'offline')
    return 'Node offline; fresh normal telemetry is required.'
  const field = (
    {
      methane: 'methane_ppm',
      h2s: 'h2s_ppm',
      overflow: 'water_level_cm',
      cover: 'cover_displaced',
    } as const
  )[alert.alert_type]
  const sensor = node.sensors[field]
  if (sensor.value === null) return 'Measurement unknown; clearance cannot be confirmed.'
  if (!sensor.fresh) return 'Measurement stale; clearance cannot be confirmed.'
  return 'Hazard still measured; restore normal conditions before resolution.'
}
