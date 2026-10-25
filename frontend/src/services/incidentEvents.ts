import type { Alert, AlertStatus } from '../types/api'

export type IncidentEvent = { kind: 'arrival' | 'acknowledged' | 'resolved'; at: number; from?: AlertStatus }
export type IncidentEvents = Record<number, IncidentEvent>

/** One tracker per monitoring session; only successful complete snapshots enter here. */
export class IncidentTracker {
  private initialized = false
  private seen = new Map<number, AlertStatus>()
  private events: IncidentEvents = {}

  update(alerts: Alert[], now = Date.now()): IncidentEvents {
    const events = Object.fromEntries(Object.entries(this.events).filter(([, event]) => now - event.at < 8000))
    for (const alert of alerts) {
      const previous = this.seen.get(alert.id)
      if (this.initialized && previous === undefined && alert.status === 'active') {
        events[alert.id] = { kind: 'arrival', at: now }
      } else if (previous !== undefined && previous !== alert.status && alert.status !== 'active') {
        events[alert.id] = { kind: alert.status, at: now, from: previous }
      }
      this.seen.set(alert.id, alert.status)
    }
    this.initialized = true
    this.events = events
    return events
  }
}
