import { test, expect } from '@playwright/test'
import type { MonitorNode } from '../src/types/api'

test('stale displaced cover is historical while a fresh gas hazard remains active', async ({ page, request }) => {
  const nodes: MonitorNode[] = await (await request.get('/api/nodes')).json()
  const target = nodes.find((node) => node.id === 'MH-001')!
  target.connectivity = 'online'
  target.safety_status = target.computed_status = 'hazard'
  target.reading_freshness = 'stale'
  target.sensors.methane_ppm = { value: 1500, fresh: true, received_at: new Date().toISOString(), source: 'simulator' }
  target.sensors.cover_displaced = { value: true, fresh: false, received_at: '2026-01-01T00:00:00.000Z', source: 'simulator' }
  await page.route('**/api/nodes', (route) => route.fulfill({ json: nodes }))
  await page.goto('/')
  const visual = page.getByTestId('manhole-visualizer')
  await expect(visual).toHaveAttribute('data-mode', 'hazard')
  await expect(visual.locator('.gas-cloud')).toHaveClass(/is-current/)
  await expect(visual.locator('.chamber-cover')).toHaveCSS('opacity', '0.6')
  await expect(visual.locator('.chamber-cover')).toHaveCSS('transition-duration', '0s')
  await expect(visual).toContainText('Cover position is a stale observation')
})

test('acknowledgement and repeated readings cannot clear or remount a measured hazard', async ({ page, request }) => {
  const scenario = (value: string) => request.post('/api/simulator/scenario', { data: { node_id: 'MH-002', scenario: value } })
  await scenario('normal')
  const existing = await (await request.get('/api/alerts')).json()
  for (const incident of existing.filter((entry: { node_id: string; alert_type: string; status: string }) => entry.node_id === 'MH-002' && entry.alert_type === 'methane' && entry.status !== 'resolved')) {
    expect((await request.patch(`/api/alerts/${incident.id}`, { data: { status: 'resolved' } })).ok()).toBeTruthy()
  }
  const created = await (await scenario('methane')).json()
  const incidentId = created.created_alert_ids[0]
  expect(incidentId).toBeTruthy()
  try {
    await page.goto('/')
    await page.getByLabel('Selected overview node').selectOption('MH-002')
    const visual = page.getByTestId('manhole-visualizer')
    await expect(visual).toHaveAttribute('data-mode', 'hazard')
    await visual.evaluate((element) => {
      element.setAttribute('data-identity-probe', 'stable')
      element.querySelector('svg')!.setAttribute('data-identity-probe', 'stable')
      element.querySelector('.gas-particle')!.setAttribute('data-identity-probe', 'stable')
    })
    expect((await request.patch(`/api/alerts/${incidentId}`, { data: { status: 'acknowledged' } })).ok()).toBeTruthy()
    const repeated = await (await scenario('methane')).json()
    expect(repeated.created_alert_ids).toEqual([])
    expect(repeated.reading_id).toBeGreaterThan(created.reading_id)
    const refresh = page.waitForResponse((response) => response.url().endsWith('/api/nodes'))
    await page.getByRole('button', { name: 'Refresh API data' }).click()
    await refresh
    await expect(visual).toHaveAttribute('data-mode', 'hazard')
    await expect(visual).toHaveAttribute('data-identity-probe', 'stable')
    await expect(visual.locator('.chamber-illustration')).toHaveAttribute('data-identity-probe', 'stable')
    await expect(visual.locator('.gas-particle').first()).toHaveAttribute('data-identity-probe', 'stable')
    await expect(visual).toContainText('Methane elevated')
  } finally {
    await scenario('normal')
    await request.patch(`/api/alerts/${incidentId}`, { data: { status: 'resolved' } })
  }
})

test('selected asset visualizer follows real Flask data and keeps its identity across refreshes', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.getByTestId('node-MH-003')).toBeVisible()
  await page.getByLabel('Selected overview node').selectOption('MH-003')
  const node: MonitorNode = await (await request.get('/api/nodes/MH-003')).json()
  const visual = page.getByTestId('manhole-visualizer')
  await expect(visual).toBeVisible()
  await expect(visual).toHaveAttribute('data-mode', node.connectivity === 'offline' ? 'offline' : node.safety_status)
  await visual.evaluate((element) => element.setAttribute('data-identity-probe', 'retained'))
  const refreshed = page.waitForResponse((response) => response.url().endsWith('/api/nodes'))
  await page.getByRole('button', { name: 'Refresh API data' }).click()
  await refreshed
  await expect(visual).toHaveAttribute('data-identity-probe', 'retained')
  await page.getByLabel('Selected overview node').selectOption('MH-007')
  await expect(visual).toHaveAttribute('data-mode', 'offline')
  await expect(visual).toContainText('Safety unconfirmed')
  await page.getByLabel('Selected overview node').selectOption('MH-008')
  await expect(page.getByLabel('Selected node sensors')).toContainText('raw')
})

test('API loss freezes the illustration and overrides apparently fresh sensor cards', async ({ page }) => {
  await page.goto('/')
  const visual = page.getByTestId('manhole-visualizer')
  await expect(visual).toBeVisible()
  await page.route('**/api/**', (route) => route.abort('failed'))
  await page.getByRole('button', { name: 'Refresh API data' }).click()
  await expect(visual).toHaveAttribute('data-mode', 'snapshot-stale')
  await expect(page.locator('.overview-receipt')).toContainText('Last telemetry')
  await expect(page.locator('.overview-receipt')).not.toContainText('Last successful snapshot')
  await expect(page.getByLabel('Selected node sensors')).not.toContainText('Current measurement')
  await page.unroute('**/api/**')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(visual).not.toHaveAttribute('data-mode', 'snapshot-stale')
})

test('combined hazards, missing water and reduced motion use truthful static representations', async ({ page, request }) => {
  // Controlled responses exercise combinations the single-hazard demo controls cannot produce.
  const nodes: MonitorNode[] = await (await request.get('/api/nodes')).json()
  const target = nodes.find((node) => node.id === 'MH-001')!
  target.connectivity = 'online'
  target.safety_status = target.computed_status = 'hazard'
  target.sensors.methane_ppm = { value: 2000, fresh: true, received_at: new Date().toISOString(), source: 'simulator' }
  target.sensors.h2s_ppm = { ...target.sensors.methane_ppm, value: 20 }
  target.sensors.cover_displaced = { ...target.sensors.methane_ppm, value: true }
  target.sensors.water_level_cm = { ...target.sensors.methane_ppm, value: null, fresh: false }
  await page.route('**/api/nodes', (route) => route.fulfill({ json: nodes }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const visual = page.getByTestId('manhole-visualizer')
  await expect(visual).toHaveAttribute('data-mode', 'hazard')
  await expect(visual).toContainText('Methane elevated')
  await expect(visual).toContainText('H2S elevated')
  await expect(visual).toContainText('Cover displaced')
  await expect(visual).toContainText('Water level unavailable')
  await expect(visual.locator('.chamber-water')).toHaveCount(0)
  await expect(visual.locator('.gas-particle').first()).toHaveCSS('animation-name', 'none')
  await expect(visual.locator('.chamber-cover')).toHaveAttribute('data-displaced', 'true')
})
