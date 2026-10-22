import { expect, test, type Locator } from '@playwright/test'

async function expectReadable(element: Locator) {
  const contrast = await element.evaluate(element => {
    const style = getComputedStyle(element)
    const luminance = (rgb: string) => {
      const channels = rgb.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
        const s = value / 255
        return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4
      })
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
    }
    const text = luminance(style.color)
    const background = luminance(style.backgroundColor)
    return (Math.max(text, background) + .05) / (Math.min(text, background) + .05)
  })
  expect(contrast).toBeGreaterThanOrEqual(4.5)
}

for (const width of [320, 390, 1440]) {
  test(`vector tiles, focus, popup and fullscreen at ${width}px`, async ({ page }) => {
    const errors: string[] = []
    const tilePaths: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      const path = new URL(request.url()).pathname
      if (path.includes('/carto.streets/')) tilePaths.push(path)
    })
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.locator('.leaflet-gl-layer')).toHaveCSS('opacity', '1', { timeout: 30_000 })
    await expect(page.locator('.leaflet-tile')).toHaveCount(0)
    expect(tilePaths.some(path => path.includes('/carto.streets/v2/'))).toBe(true)
    expect(tilePaths.some(path => path.includes('/carto.streets/v1/'))).toBe(false)
    await expectReadable(page.locator('.map-message-cluster').first())
    await expectReadable(page.locator('.map-message-marker').first())
    await expectReadable(page.locator('.leaflet-control-zoom-in'))
    await expectReadable(page.locator('.leaflet-control-attribution'))
    if (width !== 320) await page.screenshot({ path: `docs/previews/issue-131/after-${width}.png`, fullPage: true })

    await page.getByRole('button', { name: 'Select letter' }).click()
    const selected = page.locator('.map-message-marker--selected')
    await expect(selected).toBeVisible()
    await expect(selected).toHaveAttribute('aria-pressed', 'true')
    await expect(selected).toHaveCSS('border-top-style', 'double')
    await expectReadable(selected)
    const popup = page.locator('.map-letter-popup')
    await expect(popup).toContainText('From this corner')
    await expect(popup).toHaveCSS('opacity', '1')
    await expectReadable(popup.locator('.leaflet-popup-content-wrapper'))
    if (width !== 320) await page.screenshot({ path: `docs/previews/issue-131/popup-${width}.png`, fullPage: true })
    await popup.locator('.leaflet-popup-close-button').click()
    await page.keyboard.press('Tab')
    await selected.focus()
    await expect(selected).toHaveCSS('outline-style', 'dashed')
    // A selected letter must remain recognisable on hover.
    await selected.hover()
    await expectReadable(selected)
    await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click()
    await expect(page.locator('.map--fullscreen')).toBeVisible()
    await expect(page.locator('.leaflet-gl-layer')).toHaveCSS('opacity', '1')
    await expect(page.locator('.map__canvas')).toHaveJSProperty('clientHeight', 900)
    if (width !== 320) await page.screenshot({ path: `docs/previews/issue-131/fullscreen-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Exit fullscreen' }).click()

    // A second zoom and terrain view must retain the live renderer and pins.
    await page.evaluate(() => new Promise<void>(resolve => {
      const map = (window as unknown as { paletteMap: { once: (event: string, callback: () => void) => void; setView: (center: number[], zoom: number) => void } }).paletteMap
      map.once('moveend', () => resolve())
      map.setView([41.42, 2.13], 14)
    }))
    await expect.poll(() => page.evaluate(() => {
      const map = (window as unknown as { paletteMap: { getZoom: () => number; _animatingZoom?: boolean; _panAnim?: { _inProgress: boolean } } }).paletteMap
      return { zoom: map.getZoom(), zooming: !!map._animatingZoom, panning: !!map._panAnim?._inProgress }
    })).toEqual({ zoom: 14, zooming: false, panning: false })
    await expect(page.locator('.maplibregl-canvas')).toBeVisible()
    await page.getByRole('button', { name: 'Hide map' }).click()
    await expect(page.locator('.maplibregl-canvas')).toHaveCount(0)
    await page.getByRole('button', { name: 'Show map' }).click()
    await expect(page.locator('.leaflet-gl-layer')).toHaveCSS('opacity', '1', { timeout: 30_000 })
    expect(errors).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  })
}

test('keeps raster tiles and letter interaction when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined }) })
  await page.goto('/')
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible()
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(0)
  await page.getByRole('button', { name: 'Select letter' }).click()
  await expect(page.locator('.map-letter-popup')).toContainText('From this corner')
})

test('returns to raster when a vector resource fails', async ({ page }) => {
  const errors: string[] = []
  let rejectedVectorTile = false
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/vectortiles/carto.streets/v2/**', route => {
    rejectedVectorTile = true
    return route.abort()
  })
  await page.goto('/')
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible()
  await expect(page.locator('.leaflet-gl-layer')).toHaveCount(0, { timeout: 20_000 })
  expect(rejectedVectorTile).toBe(true)
  await page.getByRole('button', { name: 'Select letter' }).click()
  await expect(page.locator('.map-letter-popup')).toContainText('From this corner')
  expect(errors).toEqual([])
})

test('keeps raster tiles and letter interaction when the current vector style fails', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/gl/voyager-gl-style/style.json*', route => route.abort())
  await page.goto('/')
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible()
  await expect(page.locator('.leaflet-gl-layer')).toHaveCount(0, { timeout: 20_000 })
  await page.getByRole('button', { name: 'Select letter' }).click()
  await expect(page.locator('.map-letter-popup')).toContainText('From this corner')
  expect(errors).toEqual([])
})

test('restores raster tiles after losing the active WebGL context', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.leaflet-gl-layer')).toHaveCSS('opacity', '1', { timeout: 30_000 })
  await page.locator('.maplibregl-canvas').evaluate(canvas => {
    (canvas as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext()
  })
  await expect(page.locator('.leaflet-gl-layer')).toHaveCount(0)
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible()
  await page.getByRole('button', { name: 'Select letter' }).click()
  await expect(page.locator('.map-letter-popup')).toContainText('From this corner')
  expect(errors).toEqual([])
})
