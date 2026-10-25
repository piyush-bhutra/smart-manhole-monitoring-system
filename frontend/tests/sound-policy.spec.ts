import { expect, test } from '@playwright/test'
import { SoundPolicy } from '../src/services/incidentSound'
import type { Snapshot } from '../src/types/api'

const snapshot = (ids: number[], at = 100) => ({
  alerts: ids.map(id => ({ id, status: 'active', severity: 'critical' })),
  incidentEvents: Object.fromEntries(ids.map(id => [id, { kind: 'arrival', at }])),
} as Snapshot)

test('sound baselines silently, groups arrivals and consumes muted events', () => {
  const policy = new SoundPolicy()
  expect(policy.update(snapshot([1]), true, true, 100)).toBe(false)
  expect(policy.update(snapshot([1, 2, 3]), true, true, 200)).toBe(true)
  expect(policy.update(snapshot([1, 2, 3]), true, true, 6000)).toBe(false)
  expect(policy.update(snapshot([4]), true, false, 7000)).toBe(false)
  expect(policy.update(snapshot([4]), true, true, 8000)).toBe(false)
})

test('recovery and long snapshot gaps never replay a backlog', () => {
  const policy = new SoundPolicy()
  policy.update(snapshot([]), true, true, 100)
  policy.update(snapshot([]), false, true, 200)
  expect(policy.update(snapshot([1, 2]), true, true, 300)).toBe(false)
  expect(policy.update(snapshot([3]), true, true, 400)).toBe(true)
  expect(policy.update(snapshot([4]), true, true, 40000)).toBe(false)
  expect(policy.update(snapshot([5]), true, true, 40100)).toBe(true)
})

test('warning, acknowledgement and resolution are silent; cooldown drops bursts without queuing', () => {
  const policy = new SoundPolicy()
  policy.update(snapshot([]), true, true, 0)
  const warning = snapshot([1])
  warning.alerts[0].severity = 'warning'
  expect(policy.update(warning, true, true, 100)).toBe(false)
  const ack = snapshot([2])
  ack.alerts[0].status = 'acknowledged'
  expect(policy.update(ack, true, true, 200)).toBe(false)
  expect(policy.update(snapshot([3]), true, true, 300)).toBe(true)
  expect(policy.update(snapshot([4]), true, true, 400)).toBe(false)
  expect(policy.update(snapshot([4]), true, true, 5000)).toBe(false)
})
