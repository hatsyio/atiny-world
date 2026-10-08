import { expect, test } from '@playwright/test'

for (const width of [1440, 390]) {
  test(`language dropdown closes with its account menu on pointer down at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/?variant=header')
    if (width < 1120) await page.getByRole('button', { name: 'Menú', exact: true }).click()
    const account = page.getByRole('button', { name: 'Mi cuenta', exact: true })
    await account.click()
    await page.locator('.app-select-trigger').click()
    await expect(page.getByRole('listbox')).toBeVisible()
    const outside = await page.getByRole('link', { name: 'Atiny Atlas', exact: true }).boundingBox()
    await page.mouse.move(outside!.x + outside!.width / 2, outside!.y + outside!.height / 2)
    await page.mouse.down()
    try {
      await expect(account).toHaveAttribute('aria-expanded', 'false')
      await expect(page.locator('.app-select-popover')).toHaveCount(0)
    } finally {
      await page.mouse.up()
    }
  })

  for (const variant of ['header', 'light', 'paper', 'admin-messages', 'admin-users']) {
    test(`${variant}: closed and open at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1100 })
      await page.goto(`/?variant=${variant}`)
      if (variant === 'header') {
        if (width < 1120) await page.getByRole('button', { name: 'Menú', exact: true }).click()
        await page.getByRole('button', { name: 'Mi cuenta', exact: true }).click()
        await expect(page.getByRole('link', { name: 'Entrar', exact: true })).toBeVisible()
      }
      const trigger = page.locator('.app-select-trigger')
      await expect(trigger).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await page.mouse.move(0, 0)
      const surface = variant === 'header' ? page.locator('.account-links') : page.locator('.fixture-panel')
      await expect(surface).toHaveScreenshot(`${variant}-${width}-closed.png`)
      await trigger.click()
      const menu = page.locator('.app-select-popover')
      await expect(page.getByRole('listbox')).toBeVisible()
      await expect(menu).toHaveScreenshot(`${variant}-${width}-open.png`)
      const bounds = await menu.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
      expect(bounds!.y).toBeGreaterThanOrEqual(0)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(1100)
      await page.keyboard.press('Escape')
      await expect(trigger).toBeFocused()
      if (variant === 'header') {
        await expect(page.getByRole('button', { name: 'Mi cuenta', exact: true })).toHaveAttribute('aria-expanded', 'true')
        await trigger.click()
        await page.getByRole('option', { name: 'English', exact: true }).click()
        await expect(page.getByRole('status')).toHaveText('Idioma guardado.')
      } else if (variant === 'paper') {
        await trigger.click()
        await page.getByRole('option', { name: 'ZW', exact: true }).click()
        await expect(trigger).toHaveText('ZW')
      }
    })
  }
}

test('country dropdown works while the map panel is fullscreen', async ({ page }) => {
  await page.goto('/?variant=paper')
  await page.locator('.app-select-trigger').click()
  await page.keyboard.press('Escape')
  await page.locator('.fixture-panel').evaluate(element => element.requestFullscreen())
  await page.locator('.app-select-trigger').click()
  await expect(page.getByRole('listbox')).toBeVisible()
  expect(await page.locator('.app-select-popover').evaluate(element => document.fullscreenElement?.contains(element))).toBe(true)
  await page.getByRole('option', { name: 'ES', exact: true }).click()
  await expect(page.locator('.app-select-trigger')).toHaveText('ES')
  await page.evaluate(() => document.exitFullscreen())
})

test('country dropdown stays above the fullscreen map and fits a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 250 })
  await page.goto('/?variant=paper')
  await page.locator('.fixture-panel').evaluate(element => element.classList.add('map', 'map--fullscreen'))
  await page.locator('.app-select-trigger').click()
  const menu = page.locator('.app-select-popover')
  await expect(menu).toBeVisible()
  const bounds = await menu.boundingBox()
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(250)
  await page.getByRole('option', { name: 'ZW', exact: true }).click()
  await expect(page.locator('.app-select-trigger')).toHaveText('ZW')
})
