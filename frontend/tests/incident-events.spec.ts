import { expect, test } from '@playwright/test'
import { IncidentTracker } from '../src/services/incidentEvents'
import type { Alert } from '../src/types/api'

const alert = (id: number, status: Alert['status'] = 'active') => ({ id, status } as Alert)
test('initial history is silent, new active identities arrive once and polling cannot replay them', () => {
  const tracker = new IncidentTracker()
  expect(tracker.update([alert(1)], 0)).toEqual({})
  expect(tracker.update([alert(1), alert(2)], 100)[2]).toEqual({ kind: 'arrival', at: 100 })
  expect(tracker.update([alert(2), alert(1)], 200)[2].at).toBe(100)
  expect(tracker.update([alert(1), alert(2)], 9000)).toEqual({})
  expect(tracker.update([alert(1)], 10000)).toEqual({})
  expect(tracker.update([alert(2)], 11000)).toEqual({})
})
test('only confirmed lifecycle changes animate and newly discovered resolved history is silent', () => {
  const tracker = new IncidentTracker()
  tracker.update([alert(1)], 0)
  expect(tracker.update([alert(1, 'acknowledged')], 10)[1].kind).toBe('acknowledged')
  expect(tracker.update([alert(1, 'acknowledged')], 20)[1].at).toBe(10)
  expect(tracker.update([alert(1, 'resolved'), alert(2, 'resolved')], 30)).toEqual({ 1: { kind: 'resolved', at: 30, from: 'acknowledged' } })
})
