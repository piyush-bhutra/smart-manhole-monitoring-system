import { test, expect } from '@playwright/test'
import type { Alert, MonitorNode } from '../src/types/api'

test('new incidents enter once, acknowledgement retains danger, resolution settles, and navigation does not invent arrivals', async ({ page, request }) => {
  const alerts: Alert[] = await (await request.get('/api/alerts')).json()
  let current = alerts
  await page.route('**/api/alerts', route => route.fulfill({ json: current }))
  await page.goto('/#alerts')
  await expect(page.locator('.incident').first()).toBeVisible()
  await expect(page.locator('[data-event="arrival"]')).toHaveCount(0)
  const incident = { ...alerts[0], id: 987654, node_id: 'MH-003', alert_type: 'methane', status: 'active', triggered_at: new Date().toISOString() } as Alert
  current = [incident, ...alerts]
  await page.getByRole('button', { name: 'Refresh API data' }).click()
  const card = page.getByTestId('alert-987654')
  await expect(card).toHaveAttribute('data-event', 'arrival')
  await card.evaluate(el => el.setAttribute('data-probe', 'stable'))
  const start = await card.getAttribute('data-event-at')
  await page.getByRole('button', { name: 'Refresh API data' }).click()
  await expect(card).toHaveAttribute('data-probe', 'stable')
  await expect(card).toHaveAttribute('data-event-at', start!)
  await page.waitForTimeout(1200)
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await page.getByRole('link', { name: /^Alerts/ }).click()
  await expect(card).toHaveAttribute('data-event-at', start!)
  expect(parseFloat(await card.evaluate(el => el.style.getPropertyValue('--event-delay')))).toBeLessThan(-1100)
  const originalDelay = await card.evaluate(el => el.style.getPropertyValue('--event-delay'))
  await page.route('**/api/summary', route => route.abort())
  await page.getByRole('button', { name: 'Refresh API data' }).click()
  await expect(card).not.toHaveAttribute('data-event', 'arrival')
  await page.unroute('**/api/summary')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(card).toHaveAttribute('data-event', 'arrival')
  expect(parseFloat(await card.evaluate(el => el.style.getPropertyValue('--event-delay')))).toBeLessThan(parseFloat(originalDelay))
  await page.getByRole('button', { name: 'active', exact: true }).click()
  current = [{ ...incident, status: 'acknowledged' }, ...alerts]
  await page.getByRole('button', { name: 'Refresh API data' }).click()
  await expect(card).toHaveAttribute('data-event', 'acknowledged')
  await expect(card).toContainText('Measured hazard persists')
  await page.getByRole('button', { name: 'acknowledged', exact: true }).click()
  current = [{ ...incident, status: 'resolved' }, ...alerts]
  await page.getByRole('button', { name: 'Refresh API data' }).click()
  await expect(card).toHaveAttribute('data-event', 'resolved')
  await expect(card).toContainText('Incident closed')
})

test('real Flask incident creation, repeated hazard, acknowledgement and resolution drive presentation', async ({ page, request }) => {
  const scenario = (scenario: string) => request.post('/api/simulator/scenario', { data: { node_id: 'MH-002', scenario } })
  await scenario('normal')
  const history: Alert[] = await (await request.get('/api/alerts')).json()
  for (const alert of history.filter(a => a.node_id === 'MH-002' && a.alert_type === 'methane' && a.status !== 'resolved')) {
    expect((await request.patch(`/api/alerts/${alert.id}`, { data: { status: 'resolved' } })).ok()).toBeTruthy()
  }
  await page.goto('/#alerts')
  await expect(page.getByRole('heading', { name: 'Incident management' })).toBeVisible()
  await expect(page.locator('.incident-ribbon')).toBeVisible()
  const result = await (await scenario('methane')).json()
  const id = result.created_alert_ids[0]
  expect(id).toBeTruthy()
  try {
    await page.getByRole('button', { name: 'Refresh API data' }).click()
    const card = page.getByTestId(`alert-${id}`)
    await expect(card).toHaveAttribute('data-event', 'arrival')
    const at = await card.getAttribute('data-event-at')
    expect((await (await scenario('methane')).json()).created_alert_ids).toEqual([])
    await page.getByRole('button', { name: 'Refresh API data' }).click()
    await expect(card).toHaveAttribute('data-event-at', at!)
    await card.getByRole('button', { name: 'Acknowledge', exact: true }).click()
    await expect(card).toHaveAttribute('data-event', 'acknowledged')
    await expect(card).toContainText('Measured hazard persists')
    await expect(card.getByRole('button', { name: 'Resolve', exact: true })).toBeDisabled()
    await scenario('normal')
    await page.getByRole('button', { name: 'Refresh API data' }).click()
    await expect(card).toContainText('Measured clear')
    await card.getByRole('button', { name: 'Resolve', exact: true }).click()
    await expect(card).toHaveAttribute('data-event', 'resolved')
    await expect(card).toContainText('Fresh normal observation')
  } finally {
    await scenario('normal')
    await request.patch(`/api/alerts/${id}`, { data: { status: 'resolved' } })
  }
})

test('rapid map resize and navigation cleans up map movement', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByTestId('map-MH-003')).toBeVisible()
  for (const width of [1366, 1920, 1440]) {
    await page.setViewportSize({ width, height: 1080 })
    await page.getByRole('button', { name: 'Fit all nodes' }).click()
    await page.getByRole('link', { name: /^Alerts/ }).click()
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  }
  await page.waitForTimeout(400)
  expect(errors).toEqual([])
})

test('resolved history reports fresh normal measurements independently of workflow eligibility', async ({ page, request }) => {
  const alerts: Alert[] = await (await request.get('/api/alerts')).json()
  const nodes: MonitorNode[] = await (await request.get('/api/nodes')).json()
  const node = nodes.find(n => n.id === 'MH-001')!
  node.connectivity = 'online'
  node.sensors.methane_ppm = { value: 0, fresh: true, received_at: new Date().toISOString(), source: 'simulator' }
  await page.route('**/api/nodes', route => route.fulfill({ json: nodes }))
  await page.route('**/api/alerts', route => route.fulfill({ json: [{ ...alerts[0], id: 987653, node_id: node.id, alert_type: 'methane', status: 'resolved' }] }))
  await page.goto('/#alerts')
  await page.getByRole('button', { name: 'resolved', exact: true }).click()
  await expect(page.getByTestId('alert-987653')).toContainText('Incident closed · Fresh normal observation')
})

test('map symbols preserve simultaneous hazards and suspend on offline or API loss; reduced motion stays informative', async ({ page, request }) => {
  const nodes: MonitorNode[] = await (await request.get('/api/nodes')).json()
  const target = nodes.find(n => n.id === 'MH-001')!
  target.connectivity = 'online'
  target.safety_status = target.computed_status = 'hazard'
  for (const [field, value] of Object.entries({ methane_ppm: 9000, h2s_ppm: 100, water_level_cm: 150, cover_displaced: true })) {
    target.sensors[field as keyof typeof target.sensors] = { value, fresh: true, received_at: new Date().toISOString(), source: 'simulator' }
  }
  await page.route('**/api/nodes', route => route.fulfill({ json: nodes }))
  await page.goto('/')
  const marker = page.getByTestId('map-MH-001')
  await expect(marker.locator('.hazard-symbol')).toHaveCount(4)
  await expect(marker).toHaveAttribute('data-mode', 'hazard')
  await marker.evaluate(el => el.setAttribute('data-probe', 'stable'))
  await page.getByRole('button', { name: 'Refresh API data' }).click()
  await expect(marker).toHaveAttribute('data-probe', 'stable')
  const plume = marker.locator('.symbol-plume').first()
  const elapsed = await plume.evaluate(el => Number(el.getAnimations()[0]?.currentTime))
  await page.waitForTimeout(150)
  expect(await plume.evaluate(el => Number(el.getAnimations()[0]?.currentTime))).toBeGreaterThan(elapsed)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(marker.locator('.symbol-plume').first()).toHaveCSS('animation-name', 'none')
  target.connectivity = 'offline'
  await page.getByRole('button', { name: 'Refresh API data' }).click()
  await expect(marker).toHaveAttribute('data-mode', 'offline')
  await expect(marker.locator('xpath=../..')).toHaveAttribute('aria-label', /Offline.*unconfirmed/)
  await expect(marker.locator('.is-moving')).toHaveCount(0)
  await page.route('**/api/summary', route => route.abort())
  await page.getByRole('button', { name: 'Refresh API data' }).click()
  await expect(marker).toHaveAttribute('data-mode', 'snapshot-stale')
})
