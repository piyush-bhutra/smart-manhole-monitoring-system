import { test, expect } from '@playwright/test'
import { historySeries } from '../src/services/history'
import type { Reading } from '../src/types/api'

function reading(seconds: number, methane: number | null, cover: boolean | null = false): Reading {
  return {
    id: seconds,
    node_id: 'test',
    source: 'simulator',
    received_at: new Date(seconds * 1000).toISOString(),
    device_timestamp: null,
    methane_ppm: methane,
    methane_raw: null,
    h2s_ppm: null,
    h2s_raw: null,
    water_level_cm: null,
    cover_displaced: cover,
  }
}

test('history uses actual elapsed time, inserts substantial gaps and preserves nulls', () => {
  const series = historySeries(
    [reading(0, 1), reading(30, 2), reading(3600, null), reading(3630, 4)],
    'methane_ppm',
    300,
  )
  expect(series.map((point) => point.timestamp)).toEqual([0, 30000, 1815000, 3600000, 3630000])
  expect(series[2]).toMatchObject({ gap: true, value: null })
  expect(series[3].value).toBeNull()
  expect(
    historySeries([reading(0, null, false), reading(30, null, true)], 'cover_displaced', 300).map(
      (point) => point.value,
    ),
  ).toEqual([0, 1])
})
