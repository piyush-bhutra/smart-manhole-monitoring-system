import type { Reading, SensorField } from '../types/api'

export function historySeries(readings: Reading[], field: SensorField, staleSeconds: number) {
  const points: { timestamp: number; value: number | null; gap?: boolean }[] = []
  let previous: number | null = null
  for (const reading of readings) {
    const timestamp = Date.parse(reading.received_at)
    if (previous !== null && timestamp - previous > staleSeconds * 1000) {
      points.push({ timestamp: previous + (timestamp - previous) / 2, value: null, gap: true })
    }
    const value = reading[field]
    points.push({ timestamp, value: typeof value === 'boolean' ? (value ? 1 : 0) : value })
    previous = timestamp
  }
  return points
}
