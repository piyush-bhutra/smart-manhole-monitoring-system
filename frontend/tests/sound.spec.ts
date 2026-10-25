import { expect, test } from '@playwright/test'
import type { Alert } from '../src/types/api'

test('opt-in native audio groups new incidents, deduplicates navigation and polling, and silences recovery', async ({ page, request }) => {
  await page.addInitScript(() => {
    const original = OscillatorNode.prototype.start
    Object.assign(window, { cueNotes: 0 })
    OscillatorNode.prototype.start = function (...args) {
      const probe = window as unknown as { cueNotes: number }
      probe.cueNotes++
      return original.apply(this, args)
    }
  })
  const alerts: Alert[] = await (await request.get('/api/alerts')).json()
  let current = alerts
  await page.route('**/api/alerts', route => route.fulfill({ json: current }))
  const count = () => page.evaluate(() => (window as unknown as { cueNotes: number }).cueNotes)
  const refresh = async () => {
    await page.getByRole('button', { name: 'Refresh API data' }).click()
    await expect(page.getByRole('button', { name: 'Refresh API data' })).toBeEnabled()
  }
  const incident = (id: number) => ({ ...alerts[0], id, status: 'active', severity: 'critical' } as Alert)
  await page.goto('/')
  await expect(page.getByTestId('manhole-visualizer')).toBeVisible()
  const sound = page.getByRole('button', { name: 'Alert sounds', exact: true })
  await expect(sound).toHaveAttribute('aria-pressed', 'false')
  current = [incident(99001), ...current]
  await refresh()
  expect(await count()).toBe(0)
  await sound.click()
  await expect(sound).toHaveAttribute('aria-pressed', 'true')
  await refresh()
  expect(await count()).toBe(0)
  current = [incident(99002), incident(99003), ...current]
  await refresh()
  await expect.poll(count).toBe(2)
  await page.getByRole('link', { name: /^Alerts/ }).click()
  await refresh()
  expect(await count()).toBe(2)
  current = current.map(a => a.id === 99002 ? { ...a, status: 'acknowledged' } : a)
  await refresh()
  expect(await count()).toBe(2)
  await page.route('**/api/summary', route => route.abort())
  await refresh()
  await expect(page.getByRole('heading', { name: 'Incident management' })).toBeVisible()
  current = [incident(99004), ...current]
  await page.unroute('**/api/summary')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Refresh API data' })).toBeEnabled()
  expect(await count()).toBe(2)
  await sound.click()
  await expect(sound).toHaveAttribute('aria-pressed', 'false')
  current = [incident(99005), ...current]
  await refresh()
  expect(await count()).toBe(2)
  await page.reload()
  await expect(sound).toHaveAttribute('aria-pressed', 'false')
})

test('unsupported and rejected audio remain usable and honest', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'AudioContext', { value: undefined }) })
  await page.goto('/')
  const sound = page.getByRole('button', { name: 'Alert sounds', exact: true })
  await sound.click()
  await expect(sound).toContainText('Audio unavailable')
  await expect(sound).toBeDisabled()
  await expect(page.getByTestId('manhole-visualizer')).toBeVisible()
})

test('blocked resume and cancelled enable never claim sound is on', async ({ page }) => {
  await page.addInitScript(() => { AudioContext.prototype.resume = () => Promise.reject(new Error('blocked')) })
  await page.goto('/')
  const sound = page.getByRole('button', { name: 'Alert sounds', exact: true })
  await sound.click()
  await expect(sound).toContainText('Enable again')
  await expect(sound).toHaveAttribute('aria-pressed', 'false')
})

test('mute cancels an in-flight enable even if resume completes later', async ({ page }) => {
  await page.addInitScript(() => {
    AudioContext.prototype.resume = () => new Promise(resolve => {
      Object.assign(window, { releaseAudio: resolve })
    })
  })
  await page.goto('/')
  const sound = page.getByRole('button', { name: 'Alert sounds', exact: true })
  await sound.click()
  await expect(sound).toContainText('Cancel audio')
  await sound.click()
  await page.evaluate(() => (window as unknown as { releaseAudio: () => void }).releaseAudio())
  await expect(sound).toContainText('Sound off')
  await expect(sound).toHaveAttribute('aria-pressed', 'false')
})

test('desktop presentation preserves all views with the audio control', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByTestId('manhole-visualizer')).toBeVisible()
  await page.getByRole('button', { name: 'Alert sounds', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Alert sounds', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1080 })
    for (const name of ['Dashboard', 'Alerts', 'Simulator']) {
      await page.getByRole('link', { name: new RegExp(`^${name}`) }).click()
      await expect(page.locator('.page-content')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `.tmp/4d-${name.toLowerCase()}-${width}.png`, fullPage: true })
    }
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
    await page.getByRole('button', { name: 'Inspect MH-003', exact: true }).click()
    await expect(page.getByRole('dialog').locator('.recharts-line')).toHaveCount(1)
    await page.screenshot({ path: `.tmp/4d-details-${width}.png` })
    await page.keyboard.press('Escape')
  }
  expect(errors).toEqual([])
})
