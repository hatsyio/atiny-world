import { expect, test } from '@playwright/test'

for (const width of [320, 390, 1440]) {
  test(`location suggestions remain stable during loading at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 660 })
    await page.addInitScript(() => {
      const errors: string[] = []
      Object.assign(window, { resizeErrors: errors })
      // ResizeObserver delivery errors are window ErrorEvents, not pageerror exceptions.
      window.addEventListener('error', event => {
        if (event.message.includes('ResizeObserver')) errors.push(event.message)
      })
    })
    await page.route('**/api/locations/suggestions', async route => {
      const { query } = route.request().postDataJSON() as { query: string }
      // Keep the loading state visible before swapping between short and scrollable lists.
      await new Promise(resolve => setTimeout(resolve, 100))
      await route.fulfill({ json: { suggestions: Array.from({ length: query.length % 3 === 0 ? 2 : 12 }, (_, index) => ({
        locality: `${query} ${index}`, country: 'South Korea', countryCode: 'kr',
        point: { latitude: 37.5, longitude: 127 },
        sourceAttribution: { label: 'Fixture', url: 'https://example.com' },
        selectionToken: `token-${index}`,
      })) } })
    })
    await page.goto('/?variant=location')
    const input = page.getByRole('combobox')
    for (const query of ['Seoul', 'Seoul long', 'Seoul longer', 'Seoul very long', 'Seoul']) {
      await input.fill(query)
      await expect(page.getByRole('option', { name: `${query} 0, South Korea`, exact: true })).toBeVisible()
      // Let the browser deliver resize notifications after React renders results.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    }
    await page.setViewportSize({ width, height: 460 })
    await expect(page.getByRole('option').first()).toBeVisible()
    const popover = page.locator('.location-picker__popover')
    await expect.poll(async () => {
      const bounds = await popover.boundingBox()
      return bounds !== null && bounds.y >= 0 && bounds.y + bounds.height <= 461
    }).toBe(true)
    await page.getByRole('option').last().scrollIntoViewIfNeeded()
    await expect(page.getByRole('option').last()).toBeInViewport()
    await page.getByRole('option').first().click()
    await expect(input).toHaveValue('Seoul 0, South Korea')
    await expect(page.getByRole('listbox')).toBeHidden()
    expect(await page.evaluate(() => (window as Window & { resizeErrors?: string[] }).resizeErrors)).toEqual([])
  })
}
