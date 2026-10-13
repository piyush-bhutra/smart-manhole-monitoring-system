import { test, expect } from '@playwright/test'

test('dashboard, persisted simulator events and incident lifecycle', async ({ page, request }) => {
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning')
      browserErrors.push(message.text())
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Network overview' })).toBeVisible()
  await expect(page.getByTestId('node-MH-001')).toBeVisible()
  const summary = await (await request.get('/api/summary')).json()
  await expect(page.getByTestId('metric-total').locator('strong')).toHaveText(
    String(summary.total_nodes).padStart(2, '0'),
  )
  await expect(page.getByTestId('metric-offline').locator('strong')).toHaveText(
    String(summary.offline).padStart(2, '0'),
  )
  const nodes = await (await request.get('/api/nodes')).json()
  const located = nodes.filter(
    (node: { latitude: number | null; longitude: number | null }) =>
      node.latitude !== null && node.longitude !== null,
  )
  await expect(page.locator('.leaflet-interactive')).toHaveCount(located.length)
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: 'Restore baseline', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'demo nodes refreshed' })).toBeVisible()
  await expect(page.getByTestId('node-MH-003')).toContainText('Hazard')
  await expect(page.getByTestId('node-MH-008')).toContainText('Partial data')
  await page.getByRole('button', { name: 'Inspect MH-008' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('Raw / uncalibrated')
  await page.getByLabel('Chart sensor').selectOption('methane_raw')
  await expect(page.locator('.recharts-line')).toHaveCount(1)
  await page.mouse.move(0, 0)
  await page.screenshot({ path: 'test-results/desktop-node-details.png' })
  await page.getByRole('button', { name: 'Close node details' }).click()
  await page.getByRole('link', { name: 'Simulator', exact: true }).click()
  await page.getByLabel('Demo manhole').selectOption('MH-001')
  await page.getByRole('radio', { name: /Methane hazard/ }).check()
  const hazardResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/simulator/scenario') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Trigger scenario' }).click()
  const hazard = await (await hazardResponse).json()
  expect(hazard.computed_status).toBe('hazard')
  await expect(
    page.locator('.simulation-status').getByText('Hazard', { exact: true }),
  ).toBeVisible()
  const alerts = await (await request.get('/api/alerts')).json()
  const alert = alerts.find(
    (alert: { node_id: string; alert_type: string; status: string }) =>
      alert.node_id === 'MH-001' && alert.alert_type === 'methane' && alert.status !== 'resolved',
  )
  expect(alert).toBeTruthy()
  await page.screenshot({ path: 'test-results/desktop-simulator.png', fullPage: true })
  await page.getByRole('link', { name: /^Alerts/ }).click()
  await page.getByLabel('Search alerts').fill('MH-001')
  const incident = page.getByTestId(`alert-${alert.id}`)
  if (alert.status === 'active') await incident.getByRole('button', { name: 'Acknowledge' }).click()
  await expect(incident).toContainText('Acknowledged')
  expect((await (await request.get('/api/nodes/MH-001')).json()).computed_status).toBe('hazard')
  await expect(incident.getByRole('button', { name: 'Resolve' })).toBeDisabled()
  await page.screenshot({ path: 'test-results/desktop-alerts.png', fullPage: true })
  await page.getByRole('link', { name: 'Simulator', exact: true }).click()
  await page.getByLabel('Demo manhole').selectOption('MH-001')
  await page.getByRole('button', { name: 'Restore normal' }).click()
  await expect(page.locator('.simulation-status').getByText('Safe', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: /^Alerts/ }).click()
  await page.getByLabel('Search alerts').fill('MH-001')
  await expect(
    page.getByTestId(`alert-${alert.id}`).getByRole('button', { name: 'Resolve' }),
  ).toBeEnabled()
  await page.getByTestId(`alert-${alert.id}`).getByRole('button', { name: 'Resolve' }).click()
  await page.getByRole('button', { name: 'All incidents', exact: true }).click()
  await expect(page.getByTestId(`alert-${alert.id}`)).toContainText('Resolved')
  expect(
    (await (await request.get('/api/alerts?status=resolved')).json()).some(
      (entry: { id: number }) => entry.id === alert.id,
    ),
  ).toBe(true)
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(page.locator('.page-content')).toHaveCSS('opacity', '1')
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: 'Dismiss notification' }).click()
  await page.screenshot({ path: 'test-results/desktop-dashboard.png', fullPage: true })
  expect(browserErrors).toEqual([])
})

test('mobile layout, node search, navigation, and drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByTestId('node-MH-001')).toBeVisible()
  await page.getByLabel('Search manholes').fill('MH-001')
  await expect(page.locator('.node-table tbody tr')).toHaveCount(1)
  await expect(page.locator('.page-content')).toHaveCSS('opacity', '1')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible({ timeout: 20000 })
  await expect
    .poll(() =>
      page
        .locator('.leaflet-tile-pane img')
        .evaluateAll(
          (images) =>
            images.length > 0 &&
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
        ),
    )
    .toBe(true)
  await page.screenshot({ path: 'test-results/mobile-dashboard.png', fullPage: true })
  await page.getByRole('button', { name: 'Inspect MH-001' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sensor history' })).toBeVisible()
  await page.screenshot({ path: 'test-results/mobile-node-details.png' })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('link', { name: 'Simulator', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Demo simulator' })).toBeVisible()
  await page.screenshot({ path: 'test-results/mobile-simulator.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('API outage is explicit and never replaced with fixture telemetry', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('node-MH-001')).toBeVisible()
  await page.route('**/api/**', (route) => route.abort('failed'))
  await page.getByRole('button', { name: 'Refresh API data' }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Monitoring API unavailable' }),
  ).toBeVisible()
  await expect(
    page.getByText('Showing the last successful snapshot; values are not current.', {
      exact: false,
    }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Restore baseline', exact: true })).toBeDisabled()
  await page.screenshot({ path: 'test-results/connection-error.png', fullPage: true })
  await page.unroute('**/api/**')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Monitoring API unavailable' }),
  ).not.toBeVisible()
})

test('map tile failure is visible without hiding real node coordinates', async ({
  page,
  request,
}) => {
  await page.route('**/*.tile.openstreetmap.org/**', (route) => route.abort('failed'))
  await page.goto('/')
  const nodes = await (await request.get('/api/nodes')).json()
  await expect(page.locator('.leaflet-interactive')).toHaveCount(
    nodes.filter(
      (node: { latitude: number | null; longitude: number | null }) =>
        node.latitude !== null && node.longitude !== null,
    ).length,
  )
  await expect(
    page.getByText('Map tiles unavailable. Node coordinates remain plotted.'),
  ).toBeVisible()
})

test('incident actions inside node drawer provide visible feedback', async ({ page, request }) => {
  await request.post('/api/simulator/scenario', {
    data: { node_id: 'MH-002', scenario: 'methane' },
  })
  const alerts = await (await request.get('/api/alerts')).json()
  const alert = alerts.find(
    (entry: { node_id: string; alert_type: string; status: string }) =>
      entry.node_id === 'MH-002' && entry.alert_type === 'methane' && entry.status !== 'resolved',
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Inspect MH-002' }).click()
  const dialog = page.getByRole('dialog')
  const incident = dialog.getByTestId(`alert-${alert.id}`)
  if (alert.status === 'active') {
    await incident.getByRole('button', { name: 'Acknowledge' }).click()
    await expect(dialog.getByRole('status')).toContainText('acknowledged')
  }
  await expect(dialog.locator('.drawer-identity')).toContainText('Hazard')
  await request.post('/api/simulator/scenario', { data: { node_id: 'MH-002', scenario: 'normal' } })
  await expect(incident.getByRole('button', { name: 'Resolve' })).toBeEnabled({ timeout: 15000 })
  await incident.getByRole('button', { name: 'Resolve' }).click()
  await expect(dialog.getByRole('status')).toContainText('resolved')
})

test('initial connection failure, empty search, filters and map selection', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort('failed'))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'No monitoring data available' })).toBeVisible()
  await expect(page.getByTestId('metric-total')).not.toBeVisible()
  await page.unroute('**/api/**')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByTestId('node-MH-001')).toBeVisible()
  await page.getByLabel('Search manholes').fill('no-such-manhole')
  await expect(page.getByRole('heading', { name: 'No matching nodes' })).toBeVisible()
  await page.getByLabel('Search manholes').fill('')
  await page.locator('.leaflet-interactive').first().click()
  await expect(page.getByRole('dialog')).toContainText('MH-001')
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: /^Alerts/ }).click()
  await page.getByLabel('Filter severity').selectOption('warning')
  await expect(page.getByRole('heading', { name: 'No incidents here' })).toBeVisible()
})

test('persistent scenario survives a real emitter tick with direct presentation links', async ({
  page,
  request,
}) => {
  test.setTimeout(70000)
  await page.goto('/#simulator')
  await expect(page.getByText('Synthetic readings every 30s')).toBeVisible()
  await page.getByLabel('Demo manhole').selectOption('MH-002')
  await page.getByRole('radio', { name: /Methane hazard/ }).check()
  const response = page.waitForResponse(
    (res) => res.url().endsWith('/api/simulator/scenario') && res.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Trigger scenario' }).click()
  const created = await (await response).json()
  const existingAlerts = await (await request.get('/api/alerts')).json()
  const incidentId =
    created.created_alert_ids[0] ??
    existingAlerts.find(
      (entry: { node_id: string; alert_type: string; status: string }) =>
        entry.node_id === 'MH-002' && entry.alert_type === 'methane' && entry.status !== 'resolved',
    ).id
  await expect(page.getByRole('button', { name: 'Inspect affected node' })).toBeVisible()
  await page.getByRole('button', { name: 'Inspect affected node' }).click()
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'MH-002', exact: true }),
  ).toBeVisible()
  await expect
    .poll(async () => (await (await request.get('/api/nodes/MH-002')).json()).latest_reading.id, {
      timeout: 40000,
      intervals: [1000],
    })
    .toBeGreaterThan(created.reading_id)
  const node = await (await request.get('/api/nodes/MH-002')).json()
  expect(node.demo_scenario).toBe('methane')
  expect(node.safety_status).toBe('hazard')
  expect(node.connectivity).toBe('online')
  const offline = await (await request.get('/api/nodes/MH-007')).json()
  expect(offline.connectivity).toBe('offline')
  expect(offline.safety_status).toBe('unknown')
  await page.getByRole('button', { name: 'Close node details' }).click()
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(page.getByLabel('Selected overview node')).toHaveValue('MH-002')
  await page.getByRole('link', { name: 'Simulator', exact: true }).click()
  await expect(page.getByLabel('Demo manhole')).toHaveValue('MH-002')
  await page.getByRole('button', { name: 'Restore normal' }).click()
  await expect(page.getByRole('radio', { name: /Normal readings/ })).toBeChecked()
  await page.getByRole('button', { name: 'View corresponding incident' }).click()
  await expect(page.locator('.focused-incident')).toContainText(`Incident #${incidentId}`)
  const incident = page.getByTestId(`alert-${incidentId}`)
  if (await incident.getByRole('button', { name: 'Acknowledge' }).isVisible()) {
    await incident.getByRole('button', { name: 'Acknowledge' }).click()
  }
  await expect(incident.getByRole('button', { name: 'Resolve' })).toBeEnabled()
  await incident.getByRole('button', { name: 'Resolve' }).click()
  await expect(incident).toContainText('Resolved')
})
