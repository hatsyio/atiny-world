import { expect, test, type Page } from '@playwright/test'

async function expectSeparateControls(page: Page) {
  const attribution = page.locator('.leaflet-control-attribution')
  const button = page.getByRole('button', { name: 'View 5 messages' })
  await expect(attribution).toBeVisible()
  await expect(button).toBeVisible()
  await expect.poll(async () => {
    const text = await attribution.boundingBox()
    const toggle = await button.boundingBox()
    return text !== null && toggle !== null && toggle.y + toggle.height < text.y
  }).toBe(true)
  const panel = page.locator('#map-cluster-list')
  if (await panel.count()) {
    const canvas = (await page.locator('.map__canvas').boundingBox())!
    const list = (await panel.boundingBox())!
    expect(list.y).toBeGreaterThanOrEqual(canvas.y)
    expect(list.y + list.height).toBeLessThanOrEqual(canvas.y + canvas.height)
  }
  for (const link of await attribution.getByRole('link').all()) {
    await expect(link).toBeVisible()
    await link.click({ trial: true })
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

for (const width of [320, 390, 768, 1440]) {
  test(`messages and wrapped attribution remain usable at ${width}px`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    // Tile availability is independent of the controls' layout.
    await page.addInitScript(() => { Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined }) })
    await page.route('**/basemaps.cartocdn.com/**', route => route.abort())
    await page.route('**/api/map/messages', route => route.fulfill({ json: {
      items: Array.from({ length: 20 }, (_, index) => ({
        publicId: `letter-${index}`, content: `Letter ${index + 1} for ATINY`,
        locality: 'Barcelona', country: 'Spain', author: { displayName: 'ATINY' },
      })), nextCursor: null,
    } }))
    await page.goto('/?attribution')
    await expectSeparateControls(page)
    await testInfo.attach('separate-controls', { body: await page.locator('.map').screenshot(), contentType: 'image/png' })
    // Transparent space beside the closed control must still receive map gestures.
    expect(await page.locator('.map__messages-control').evaluate(element => {
      const box = element.getBoundingClientRect()
      const hit = document.elementFromPoint(box.left + 2, box.top + box.height / 2)
      return hit?.classList.contains('leaflet-container')
    })).toBe(true)
    await page.getByRole('button', { name: 'View 5 messages' }).click()
    await expect(page.locator('#map-cluster-list')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Letter 1 for ATINY', exact: false })).toBeVisible()
    await expectSeparateControls(page)

    // Constrain the attribution to force multiple lines even on desktop.
    await page.locator('.leaflet-control-attribution').evaluate(element => { element.style.maxWidth = '180px' })
    await expect.poll(async () => (await page.locator('.leaflet-control-attribution').boundingBox())!.height).toBeGreaterThan(30)
    await expectSeparateControls(page)
    await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click()
    await expect(page.locator('.map--fullscreen')).toBeVisible()
    await expectSeparateControls(page)
    await page.setViewportSize({ width: 320, height: 660 })
    await expectSeparateControls(page)
    await page.keyboard.press('Escape')
    await expect(page.locator('.map--fullscreen')).toHaveCount(0)
    await expectSeparateControls(page)
    const lastLetter = page.getByRole('button', { name: 'Letter 20 for ATINY', exact: false })
    await lastLetter.click()
    await expect(page.locator('#map-cluster-list')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
