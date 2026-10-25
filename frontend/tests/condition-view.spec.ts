import { test, expect } from '@playwright/test'
import { conditionView } from '../src/services/conditionView'
import type { MonitorNode, Sensor } from '../src/types/api'

const thresholds = { methane: 1000, h2s: 10, overflow: 80 }
const observation = (value: number | boolean | null, fresh = value !== null): Sensor => ({
  value, fresh, received_at: '2026-10-25T12:00:00.000Z', source: 'hardware',
})
function node(): MonitorNode {
  return {
    id: 'HW-TEST', name: 'Test installation', location_description: 'Test',
    latitude: null, longitude: null, is_demo: false,
    created_at: '2026-10-25T12:00:00.000Z', last_seen_at: '2026-10-25T12:00:00.000Z',
    computed_status: 'safe', connectivity: 'online', safety_status: 'safe',
    last_measured_safety: 'safe', reading_freshness: 'current', demo_scenario: null,
    latest_reading: null,
    sensors: {
      methane_raw: observation(null), methane_ppm: observation(200),
      h2s_raw: observation(null), h2s_ppm: observation(2),
      water_level_cm: observation(16), cover_displaced: observation(false),
    },
  }
}

test('all four fresh normal channels establish a calm state, including zero', () => {
  const asset = node()
  asset.sensors.water_level_cm = observation(0)
  expect(conditionView(asset, thresholds, true)).toMatchObject({
    mode: 'safe', hazards: [], waterRatio: 0, coverDisplaced: false,
  })
})

test('all simultaneous hazards remain visible at inclusive thresholds', () => {
  const asset = node()
  asset.sensors.methane_ppm = observation(1000)
  asset.sensors.h2s_ppm = observation(10)
  asset.sensors.water_level_cm = observation(80)
  asset.sensors.cover_displaced = observation(true)
  expect(conditionView(asset, thresholds, true)).toMatchObject({
    mode: 'hazard', hazards: ['methane', 'h2s', 'overflow', 'cover'],
    waterRatio: 1, coverDisplaced: true,
  })
})

test('partial latest rows do not replace effective sensor observations', () => {
  const asset = node()
  asset.sensors.h2s_ppm = observation(12)
  expect(conditionView(asset, thresholds, true).hazards).toEqual(['h2s'])
})

test('raw gas remains uncalibrated and cannot establish safe or hazardous ppm', () => {
  const asset = node()
  asset.sensors.methane_ppm = observation(null)
  asset.sensors.methane_raw = observation(4095)
  expect(conditionView(asset, thresholds, true)).toMatchObject({
    mode: 'unknown', hazards: [], channels: { methane: 'raw' },
  })
})

test('missing water and cover never render as empty or seated measurements', () => {
  const asset = node()
  asset.sensors.water_level_cm = observation(null)
  asset.sensors.cover_displaced = observation(null)
  expect(conditionView(asset, thresholds, true)).toMatchObject({
    mode: 'unknown', waterRatio: null, coverDisplaced: null,
    channels: { overflow: 'unknown', cover: 'unknown' },
  })
})

test('fresh cover hazard survives a stale gas channel without animating stale gas', () => {
  const asset = node()
  asset.sensors.methane_ppm = observation(1500, false)
  asset.sensors.cover_displaced = observation(true)
  expect(conditionView(asset, thresholds, true)).toMatchObject({
    mode: 'hazard', hazards: ['cover'], lastKnownHazards: ['methane', 'cover'],
    channels: { methane: 'stale', cover: 'hazard' },
  })
})

test('offline suppresses current hazards but preserves last known danger', () => {
  const asset = node()
  asset.connectivity = 'offline'
  asset.sensors.methane_ppm = observation(1500)
  expect(conditionView(asset, thresholds, true)).toMatchObject({
    mode: 'offline', hazards: [], lastKnownHazards: ['methane'],
    channels: { methane: 'stale' },
  })
})

test('API failure overrides frozen freshness flags and prevents a safe claim', () => {
  expect(conditionView(node(), thresholds, false)).toMatchObject({
    mode: 'snapshot-stale', hazards: [], channels: { methane: 'stale', cover: 'stale' },
  })
})

test('unknown backend safety remains unknown even if supplied channels appear normal', () => {
  const asset = node()
  asset.safety_status = 'unknown'
  expect(conditionView(asset, thresholds, true).mode).toBe('unknown')
})

test('threshold configuration drives presentation rather than hardcoded defaults', () => {
  expect(conditionView(node(), { methane: 200, h2s: 1, overflow: 10 }, true).hazards)
    .toEqual(['methane', 'h2s', 'overflow'])
})
