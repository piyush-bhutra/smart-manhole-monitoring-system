import { expect, test } from '@playwright/test'
import { buildSampleFrame } from '../src/services/sampleScenarios'

const start = Date.parse('2026-10-27T10:00:00Z')

test('samples start with a consistent normal network and no incidents', () => {
  const frame = buildSampleFrame('gas', 0, start)
  expect(frame.snapshot.summary).toMatchObject({ total_nodes: 8, safe: 8, hazard: 0, active_incidents: 0 })
  expect(frame.snapshot.alerts).toEqual([])
  expect(frame.snapshot.nodes[0].sensors.methane_ppm.value).toBe(200)
})

test('gas crossing creates one incident with its original time, and recovery does not resolve it', () => {
  const rising = buildSampleFrame('gas', 8, start)
  expect(rising.snapshot.summary.hazard).toBe(0)
  expect(rising.snapshot.nodes[0].sensors.methane_ppm.value).toBe(650)
  const hazard = buildSampleFrame('gas', 24, start)
  expect(hazard.snapshot.alerts).toHaveLength(1)
  expect(hazard.snapshot.alerts[0]).toMatchObject({ node_id: 'MH-001', alert_type: 'methane', status: 'active', triggered_at: '2026-10-27T10:00:16.000Z' })
  const complete = buildSampleFrame('gas', 1000, start)
  expect(complete.completed).toBe(true)
  expect(complete.elapsed).toBe(48)
  expect(complete.snapshot.summary).toMatchObject({ hazard: 0, safe: 8, active_incidents: 1 })
  expect(complete.snapshot.alerts[0].resolved_at).toBeNull()
  expect(complete.history['MH-001'].some(row => row.methane_ppm === 1500)).toBe(true)
})

test('campus incidents occur independently across three locations', () => {
  const frame = buildSampleFrame('campus', 40, start)
  expect(frame.snapshot.summary).toMatchObject({ safe: 5, hazard: 3, active_incidents: 3 })
  expect(frame.snapshot.alerts.map(alert => [alert.node_id, alert.alert_type])).toEqual([
    ['MH-005', 'overflow'], ['MH-004', 'h2s'], ['MH-006', 'cover'],
  ])
  expect(frame.snapshot.nodes.find(node => node.id === 'MH-006')?.sensors.cover_displaced.value).toBe(true)
})

test('combined hazards retain overflow when gas clears, then preserve both open incidents', () => {
  const combined = buildSampleFrame('combined', 24, start)
  expect(combined.snapshot.summary.hazard).toBe(1)
  expect(combined.snapshot.alerts.map(alert => alert.alert_type)).toEqual(['methane', 'overflow'])
  const partial = buildSampleFrame('combined', 32, start)
  expect(partial.snapshot.nodes[0].sensors.methane_ppm.value).toBe(200)
  expect(partial.snapshot.nodes[0].sensors.water_level_cm.value).toBe(110)
  expect(partial.snapshot.summary).toMatchObject({ hazard: 1, active_incidents: 2 })
  const recovered = buildSampleFrame('combined', 48, start)
  expect(recovered.snapshot.summary).toMatchObject({ hazard: 0, active_incidents: 2 })
})

test('sample frames have isolated run timestamps and no shared mutable history', () => {
  const first = buildSampleFrame('combined', 16, start)
  first.snapshot.nodes[0].sensors.methane_ppm.value = 99999
  const next = buildSampleFrame('gas', 0, start + 60000)
  expect(next.snapshot.nodes[0].sensors.methane_ppm.value).toBe(200)
  expect(next.snapshot.summary.generated_at).toBe('2026-10-27T10:01:00.000Z')
  expect(next.snapshot.alerts).toEqual([])
})

test('recovery retains earlier observations and never moves the last hazard time backwards', () => {
  const before = buildSampleFrame('gas', 31, start)
  const recovered = buildSampleFrame('gas', 32, start)
  expect(recovered.history['MH-001']).toEqual(expect.arrayContaining(before.history['MH-001']))
  expect(recovered.snapshot.alerts[0].last_observed_at).toBe('2026-10-27T10:00:31.000Z')
  expect(recovered.snapshot.alerts[0].last_observed_at >= before.snapshot.alerts[0].last_observed_at).toBe(true)
})
