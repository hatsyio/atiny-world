import { expect, test } from '@playwright/test'
import postgres from 'postgres'

const sql = postgres(process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', { max: 1 })
let authorId: string
let publicId: string
let hiddenId: string
const city = 'Map120Madrid'

test.beforeAll(async () => {
  // Share the repository's test lock without deleting other suites' fixtures.
  await sql`select pg_advisory_lock(4811, 20260921)`
  const username = `map120-${Date.now()}`
  const [author] = await sql`insert into app_private.profiles (clerk_user_id, username, username_normalized, display_name) values (${username}, ${username}, ${username}, 'ATINY120') returning id`
  authorId = author.id
  for (let index = 0; index < 24; index++) {
    const [letter] = await sql`insert into app_private.messages (author_id, content, status, moderation_reason_code, location_precision, location_algorithm_version, public_point, locality, country, country_code, published_at)
      values (${authorId}, ${`Map120 letter ${index}`}, ${index === 23 ? 'withdrawn' : 'approved'}, ${index === 23 ? 'spam' : null}, 'approximate', 1,
        extensions.st_setsrid(extensions.st_makepoint(-3.7, 40.4), 4326)::extensions.geography, ${city}, 'España', 'es', now()) returning public_id`
    if (index === 22) publicId = letter.public_id
    if (index === 23) hiddenId = letter.public_id
  }
})
test.afterAll(async () => {
  if (authorId) {
    await sql`delete from app_private.messages where author_id = ${authorId}`
    await sql`delete from app_private.profiles where id = ${authorId}`
  }
  await sql`select pg_advisory_unlock(4811, 20260921)`
  await sql.end()
})
test.beforeEach(async ({ page }) => {
  await page.route('**/basemaps.cartocdn.com/**', route => route.abort())
})

for (const width of [320, 390, 1440]) {
  test(`paginates, previews shared points, reads a letter and restores exploration at ${width}px`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 844 })
    await page.goto(`/map?mapView=40.4,-3.7,8&mapCity=${city}&mapCountry=es`)
    const map = page.locator('.map__canvas')
    await expect(map).toBeVisible()
    if (width < 760) await page.getByRole('button', { name: 'Show letters' }).click()
    await expect(page.getByText('20 letters loaded', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Load more messages' }).click()
    await expect(page.getByText('23 letters loaded', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Map120 letter 23/ })).toHaveCount(0)
    await page.getByRole('button', { name: /Map120 letter 22/ }).click()
    await expect(page.locator('.map-message-marker--selected')).toBeVisible()
    await expect(page.locator('.map-message-letter')).toContainText('ATINY120')
    await expect(page.locator('.map-message-letter')).toContainText(city)
    // Selecting either letter at the shared point must target that precise letter.
    if (width < 760) await page.getByRole('button', { name: 'Show letters' }).click()
    await page.getByRole('button', { name: /Map120 letter 21/ }).click()
    await expect(page.locator('.map-message-letter')).toContainText('Map120 letter 21')
    let origin = page.url()
    await page.getByRole('button', { name: 'Read full message' }).click()
    await expect(page.locator('.letter-reading__content')).toHaveText('Map120 letter 21')
    const returnTo = new URL(page.url()).searchParams.get('returnTo')!
    const readingContext = new URL(returnTo, origin)
    expect(readingContext.searchParams.get('mapCity')).toBe(city)
    expect(readingContext.searchParams.get('mapCountry')).toBe('es')
    expect(readingContext.searchParams.get('letter')).toBe(new URL(origin).searchParams.get('letter'))
    // Popup auto-pan can finish between locating the preview and clicking Read.
    // The reading action must restore the viewport captured at the actual click.
    origin = readingContext.href
    await page.getByRole('link', { name: '← Back to the map' }).click()
    await expect(page.getByRole('button', { name: 'Read full message' })).toBeVisible()
    expect(page.url()).toBe(origin)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Read full message' })).toBeVisible()
    expect(page.url()).toBe(origin)
    await page.getByRole('button', { name: 'Read full message' }).click()
    await expect(page.locator('.letter-reading__content')).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('button', { name: 'Read full message' })).toBeVisible()
    expect(page.url()).toBe(origin)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    const size = await map.boundingBox()
    expect(size!.height).toBeGreaterThan(350)
    expect(errors).toEqual([])
  })
}

test('combines country and debounced city, clears filters and updates both queries after panning', async ({ page }) => {
  const urls: string[] = []
  page.on('request', request => { if (request.url().includes('/api/map/')) urls.push(request.url()) })
  await page.goto('/map?mapView=40.4,-3.7,8')
  await page.getByRole('textbox', { name: 'City' }).fill(city)
  await page.getByRole('button', { name: /Country/ }).click()
  await page.getByRole('option', { name: 'Spain', exact: true }).click()
  await expect(page.getByText('20 letters loaded', { exact: true })).toBeVisible()
  await expect.poll(() => urls.filter(url => url.includes(`city=${city}`) && url.includes('country=es')).length).toBeGreaterThanOrEqual(2)
  const map = await page.locator('.map__canvas').boundingBox()
  const beforePan = page.url()
  await page.mouse.move(map!.x + map!.width / 2, map!.y + map!.height * .7)
  await page.mouse.down()
  await page.mouse.move(map!.x + map!.width / 2 + 80, map!.y + map!.height * .7, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => page.url()).not.toBe(beforePan)
  await page.getByRole('textbox', { name: 'City' }).fill('')
  await page.getByRole('button', { name: /Country/ }).click()
  await page.getByRole('option', { name: 'All', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.has('mapCity')).toBe(false)
  await expect(page.getByRole('textbox', { name: 'City' })).toHaveValue('')
  expect(new URL(page.url()).searchParams.has('mapCountry')).toBe(false)
  expect(new URL(page.url()).searchParams.has('mapCity')).toBe(false)
})

test('keeps existing marker nodes while a pan refreshes the viewport without a loading overlay', async ({ page }) => {
  await page.goto(`/map?mapView=40.4,-3.7,8&mapCity=${city}`)
  const cluster = page.locator('.map-message-cluster').first()
  await expect(cluster).toContainText('23')
  const node = await cluster.elementHandle()
  let requested = false
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/map/features?**', async route => {
    requested = true
    await held
    await route.continue()
  })
  try {
    const map = await page.locator('.map__canvas').boundingBox()
    await page.mouse.move(map!.x + map!.width / 2, map!.y + map!.height * .7)
    await page.mouse.down()
    await page.mouse.move(map!.x + map!.width / 2 + 60, map!.y + map!.height * .7, { steps: 8 })
    await page.mouse.up()
    await expect.poll(() => requested).toBe(true)
    await expect(page.locator('.map-feedback')).not.toContainText('Loading this area')
    expect(await node!.evaluate(element => element.isConnected)).toBe(true)
    const refreshed = page.waitForResponse(response => response.url().includes('/api/map/features?'))
    release()
    await refreshed
    await expect(cluster).toContainText('23')
    expect(await node!.evaluate(element => element.isConnected)).toBe(true)
  } finally {
    release()
  }
})

for (const width of [320, 1440]) {
  for (const [path, fullscreen] of [['/map', false], ['/map', true], ['/', true]] as const) {
    test(`fits a marker's loaded popup inside ${path} at ${width}px, fullscreen=${fullscreen}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 600 : 900 })
      await page.route('**/api/messages/*', async route => {
        const response = await route.fetch()
        const letter = await response.json()
        await route.fulfill({ json: { ...letter, content: 'A long letter with several paragraphs.\n'.repeat(40) } })
      })
      await page.goto(`${path}?mapView=40.4,-3.7,8&mapCity=${city}`)
      if (fullscreen) await page.getByRole('button', { name: 'Enter fullscreen' }).click()
      await page.locator('.map-message-cluster').first().click()
      await page.locator('.map-message-marker').first().click()
      await expect(page.getByRole('button', { name: 'Read full message' })).toBeVisible()
      const fits = async () => {
        const map = await page.locator('.map__canvas').boundingBox()
        const popup = await page.locator('.map-letter-popup').filter({ has: page.locator('.map-message-letter') }).boundingBox()
        return map && popup ? Math.min(popup.x - map.x, popup.y - map.y,
          map.x + map.width - popup.x - popup.width, map.y + map.height - popup.y - popup.height) : -Infinity
      }
      await expect.poll(fits).toBeGreaterThanOrEqual(-1)
      await page.screenshot({ path: test.info().outputPath('popup.png') })
      if (fullscreen) {
        await page.getByRole('button', { name: 'Exit fullscreen' }).click()
        await expect.poll(fits).toBeGreaterThanOrEqual(-1)
      }
    })
  }
}

test('deep-links to a public letter and reports a non-public letter without blocking controls', async ({ page }) => {
  await page.goto(`/map?letter=${publicId}`)
  await expect(page.locator('.map-message-letter')).toContainText('Map120 letter 22')
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('mapView')?.split(',')[2] ?? 0)).toBeGreaterThanOrEqual(8)
  await page.goto(`/map?letter=${hiddenId}`)
  await expect(page.getByText('This letter is no longer publicly available.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled()
  await expect(page.locator('.map-message-letter')).toHaveCount(0)
})

test('recovers marker and panel errors and explains an empty filtered area', async ({ page }) => {
  let failing = true
  await page.route('**/api/map/**', async route => {
    if (failing) await route.fulfill({ status: 503, json: { code: 'MAP_DATA_UNAVAILABLE' } })
    else await route.continue()
  })
  await page.goto(`/map?mapView=40.4,-3.7,8&mapCity=${city}`)
  await expect(page.getByText('The letters in this area could not be loaded.')).toBeVisible()
  await expect(page.getByText('The messages could not be loaded.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled()
  failing = false
  await Promise.all([
    page.locator('.map-feedback').getByRole('button', { name: 'Try again', exact: true }).click(),
    page.locator('.cluster-list-wrap').getByRole('button', { name: 'Try again', exact: true }).click(),
  ])
  await expect(page.getByText('20 letters loaded', { exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'City' }).fill('Map120NoLetters')
  await expect(page.getByText('No messages in this area.')).toBeVisible()
  await expect(page.locator('.map-message-marker')).toHaveCount(0)
})

test('removes a remotely moderated selection on reconnect', async ({ page, context }) => {
  await page.goto(`/map?letter=${publicId}`)
  await expect(page.locator('.map-message-letter')).toContainText('Map120 letter 22')
  try {
    await sql`update app_private.messages set status = 'withdrawn', moderation_reason_code = 'spam' where public_id = ${publicId}`
    await context.setOffline(true)
    await context.setOffline(false)
    await expect(page.getByText('This letter is no longer publicly available.')).toBeVisible()
    await expect(page.locator('.map-message-marker--selected')).toHaveCount(0)
    await expect(page.locator('.map-message-letter')).toHaveCount(0)
  } finally {
    await sql`update app_private.messages set status = 'approved', moderation_reason_code = null where public_id = ${publicId}`
  }
})

test('uses translated filters and reopens a selected preview entirely by keyboard', async ({ page, context }) => {
  await context.addCookies([{ name: 'atiny-language', value: 'es', url: 'http://localhost:3011' }])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/map?mapView=40.4,-3.7,8&mapCity=${city}`)
  const country = page.getByRole('button', { name: /País/ })
  await country.focus()
  await page.keyboard.press('Enter')
  const option = page.getByRole('option', { name: 'España', exact: true })
  await option.focus()
  await page.keyboard.press('Enter')
  await expect(country).toHaveText('España')
  const toggle = page.getByRole('button', { name: 'Mostrar cartas' })
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('20 cartas cargadas', { exact: true })).toBeVisible()
  const letter = page.getByRole('button', { name: /Map120 letter 22/ })
  await letter.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Leer completo' })).toBeFocused()
  await page.getByRole('button', { name: 'Cerrar ventana' }).press('Enter')
  await expect(page.locator('.map-message-letter')).toHaveCount(0)
  await toggle.focus()
  await page.keyboard.press('Enter')
  await letter.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.map-message-letter')).toContainText('Map120 letter 22')
  await expect(page.locator('.map-message-marker--selected')).toBeVisible()
})

for (const width of [390, 1440]) {
  for (const path of ['/map', '/letters']) {
    test(`applies partial cities automatically without moving the filters on ${path} at ${width}px`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path === '/map' ? '/map?mapView=40.4,-3.7,8' : '/letters')
      const filters = page.locator(path === '/map' ? '.map-filters' : '.letters-archive__filters')
      const clear = page.getByRole('button', { name: path === '/map' ? 'Clear filters' : 'Clear search and filters', exact: true })
      if (path === '/map') await expect(clear).toHaveCount(0)
      else await expect(clear).toBeDisabled()
      const before = await filters.boundingBox()
      if (path === '/map') {
        const map = await page.locator('.map__canvas').boundingBox()
        const city = await page.getByRole('textbox', { name: 'City', exact: true }).boundingBox()
        const country = await page.getByRole('button', { name: /Country/ }).boundingBox()
        expect(Math.abs(city!.x - map!.x)).toBeLessThanOrEqual(2)
        expect(Math.abs(country!.x + country!.width - map!.x - map!.width)).toBeLessThanOrEqual(2)
      }
      const cityField = page.getByRole('textbox', { name: 'City', exact: true })
      await cityField.fill('map120 MÁ-D')
      await expect.poll(() => new URL(page.url()).searchParams.get(path === '/map' ? 'mapCity' : 'city')).toBe('map120 MÁ-D')
      await expect(cityField).toBeFocused()
      if (path !== '/map') await expect(clear).toBeEnabled()
      await page.getByRole('button', { name: /Country/ }).click()
      await page.getByRole('option', { name: /Spain/ }).click()
      await expect.poll(() => new URL(page.url()).searchParams.get(path === '/map' ? 'mapCountry' : 'country')).toBe('es')
      const after = await filters.boundingBox()
      expect(after!.height).toBeCloseTo(before!.height, 1)
      expect(after!.y).toBeCloseTo(before!.y, 1)
      if (path === '/map') {
        if (width < 760) await page.getByRole('button', { name: 'Show letters' }).click()
        await expect(page.getByText('20 letters loaded', { exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: /Map120 letter 22/ })).toBeVisible()
      } else {
        await expect(page.locator('.archive-letter')).toHaveCount(20)
        await expect(page.getByRole('link', { name: 'Page 2', exact: true })).toBeVisible()
        await page.getByRole('searchbox', { name: 'Search letter text' }).fill('letter 22')
        await expect(page.locator('.archive-letter')).toHaveCount(1)
        await expect(page.locator('.archive-letter')).toContainText('Map120 letter 22')
        expect(new URL(page.url()).searchParams.has('page')).toBe(false)
        await page.getByRole('link', { name: 'Read letter by ATINY120', exact: true }).click()
        await page.getByRole('link', { name: /Back to letters/ }).click()
        await expect(cityField).toHaveValue('map120 MÁ-D')
        await expect(page.getByRole('searchbox', { name: 'Search letter text' })).toHaveValue('letter 22')
      }
      if (path === '/map') {
        await cityField.fill('')
        await page.getByRole('button', { name: /Country/ }).click()
        await page.getByRole('option', { name: 'All', exact: true }).click()
      } else {
        await clear.click()
        await expect(clear).toBeDisabled()
      }
      await expect(cityField).toHaveValue('')
      expect((await filters.boundingBox())!.height).toBeCloseTo(before!.height, 1)
      await expect.poll(() => new URL(page.url()).searchParams.has(path === '/map' ? 'mapCity' : 'city')).toBe(false)
      expect(errors).toEqual([])
    })
  }
}
