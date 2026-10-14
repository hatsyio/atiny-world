import { expect, test } from '@playwright/test'
import postgres from 'postgres'

const sql = postgres(process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', { max: 1 })
const cityId = 'city:geoapify:issue129-browser-madrid'
const added: string[] = []
let authorId: string
test.beforeAll(async () => {
  await sql`select pg_advisory_lock(4811, 20260921)`
  for (const [id, kind, name, west, south, east, north] of [
    ['country:es', 'country', 'Spain', -18, 27, 4.5, 44],
    [cityId, 'city', 'Madrid', -3.9, 40.3, -3.5, 40.6],
    ['city:geoapify:000-issue129-browser-madrid-homonym', 'city', 'Madrid', -7.2, 41.8, -6.8, 42],
    ['country:fr', 'country', 'France', -178.4, -50.3, 172.4, 51.4],
  ] as const) {
    const code = id === 'country:fr' ? 'fr' : 'es'
    const homonym = id === 'city:geoapify:000-issue129-browser-madrid-homonym'
    const inserted = await sql`insert into app_private.geographic_locations
      (identity, kind, name, normalized_name, country, country_code, latitude, longitude, west, south, east, north, provider_id, provider, attribution, obtained_at)
      values (${id}, ${kind}, ${name}, ${name.toLowerCase()}, ${code === 'fr' ? 'France' : 'Spain'}, ${code}, ${homonym ? 41.9 : 40.4}, ${homonym ? -7 : -3.7}, ${west}, ${south}, ${east}, ${north}, ${id}, 'Geoapify', 'Powered by Geoapify | © OpenStreetMap contributors', now())
      on conflict do nothing returning identity`
    if (inserted.length) added.push(id)
  }
  const username = `navigation129-${Date.now()}`
  const [author] = await sql`insert into app_private.profiles (clerk_user_id, username, username_normalized, display_name) values (${username}, ${username}, ${username}, 'Navigation129') returning id`
  authorId = author.id
  await sql`insert into app_private.messages (author_id, content, status, location_precision, location_algorithm_version, public_point, locality, country, country_code)
    values (${authorId}, 'Navigation129 Madrid', 'approved', 'approximate', 1, extensions.st_setsrid(extensions.st_makepoint(-3.7,40.4),4326)::extensions.geography, 'Madrid', 'Spain', 'es'),
      (${authorId}, 'Navigation129 Antibes', 'approved', 'approximate', 1, extensions.st_setsrid(extensions.st_makepoint(7.1,43.6),4326)::extensions.geography, 'Antibes', 'France', 'fr')`
})
test.afterAll(async () => {
  if (authorId) { await sql`delete from app_private.messages where author_id = ${authorId}`; await sql`delete from app_private.profiles where id = ${authorId}` }
  for (const id of added) await sql`delete from app_private.geographic_locations where identity = ${id}`
  await sql`select pg_advisory_unlock(4811, 20260921)`
  await sql.end()
})
for (const width of [320, 1440]) {
  test(`frames persisted Spain then a catalog Madrid selection and restores the URL at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route('**/basemaps.cartocdn.com/**', route => route.abort())
    const geographic: string[] = []
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (request.url().includes('/api/map/locations')) geographic.push(request.url()) })
    await page.goto('/map?mapView=20,0,2')
    await expect(page.locator('.leaflet-container')).toBeVisible()
    const input = page.getByRole('combobox', { name: 'City', exact: true })
    await input.fill('Mad')
    await expect.poll(() => new URL(page.url()).searchParams.get('mapCity')).toBe('Mad')
    expect(geographic).toEqual([])
    await input.press('Escape')
    await page.getByRole('button', { name: /Country/ }).click()
    await page.getByRole('option', { name: 'Spain', exact: true }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('mapView')).not.toBe('20,0,2')
    const countryZoom = Number(new URL(page.url()).searchParams.get('mapView')!.split(',')[2])
    expect(countryZoom).toBeLessThanOrEqual(5)
    await input.fill('Madrid')
    await page.getByRole('option', { name: 'Madrid', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Find city' })).toHaveCount(0)
    await expect.poll(() => new URL(page.url()).searchParams.get('mapLocation')).toBe(cityId)
    await expect(page.locator('.map-location-results button')).toHaveCount(0)
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect.poll(() => Number(new URL(page.url()).searchParams.get('mapView')!.split(',')[2])).toBeGreaterThan(8)
    if (width < 760) await page.getByRole('button', { name: 'Show letters', exact: true }).click()
    await expect(page.getByRole('button', { name: /Navigation129 Madrid/ })).toBeVisible()
    await expect(page.locator('.leaflet-control-attribution')).toContainText('Powered by Geoapify')
    await page.screenshot({ path: `test-results-map/issue129-madrid-${width}.png`, fullPage: true })
    const restored = new URL(page.url()).searchParams.get('mapView')
    await page.reload()
    await expect(input).toHaveValue('Madrid')
    await expect.poll(() => new URL(page.url()).searchParams.get('mapView')).toBe(restored)
    await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click()
    await page.getByRole('button', { name: 'Filters (2)', exact: true }).click()
    await expect(page.locator('.map--fullscreen').getByRole('combobox', { name: 'City', exact: true })).toHaveValue('Madrid')
    await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    expect(errors).toEqual([])
  })
}

test('resets exploration when the header navigates back to the clean map URL', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/basemaps.cartocdn.com/**', route => route.abort())
  await page.goto('/map?mapView=40.4,-3.7,8')
  await expect(page.locator('.leaflet-container')).toBeVisible()
  const input = page.getByRole('combobox', { name: 'City', exact: true })
  await input.fill('Madrid')
  await expect.poll(() => new URL(page.url()).searchParams.get('mapCity')).toBe('Madrid')
  await input.press('Escape')
  await page.getByRole('link', { name: 'Map', exact: true }).click()
  await expect(input).toHaveValue('')
  await expect.poll(() => new URL(page.url()).searchParams.has('mapCity')).toBe(false)
})

test('frames metropolitan France and does not offer a country without letters', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/basemaps.cartocdn.com/**', route => route.abort())
  await page.goto('/map?mapView=20,0,2')
  await expect(page.locator('.leaflet-container')).toBeVisible()
  await page.getByRole('button', { name: /Country/ }).click()
  await expect(page.getByRole('option', { name: 'Andorra', exact: true })).toHaveCount(0)
  await page.getByRole('option', { name: 'France', exact: true }).click()
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('mapView')!.split(',')[2])).toBeGreaterThanOrEqual(5)
  const [latitude, longitude] = new URL(page.url()).searchParams.get('mapView')!.split(',').map(Number)
  expect(latitude).toBeGreaterThan(43)
  expect(latitude).toBeLessThan(49)
  expect(longitude).toBeGreaterThan(-1)
  expect(longitude).toBeLessThan(6)
  await expect(page.getByRole('button', { name: /Navigation129 Antibes/ })).toBeVisible()
  await page.screenshot({ path: 'test-results-map/issue129-france.png', fullPage: true })
})

for (const width of [320, 1440]) {
  test(`keeps the same pin mounted while a city filter loads at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route('**/basemaps.cartocdn.com/**', route => route.abort())
    await page.goto('/map?mapView=40.4,-3.7,8')
    const pin = page.locator('.map-message-marker')
    await expect(pin).toHaveCount(1)
    const element = await pin.elementHandle()
    let requested = false
    let release!: () => void
    const pending = new Promise<void>(done => { release = done })
    await page.route('**/api/map/features?**', async route => {
      if (new URL(route.request().url()).searchParams.get('city') === 'Madrid') {
        requested = true
        await pending
      }
      await route.continue()
    })
    try {
      await page.getByRole('combobox', { name: 'City', exact: true }).fill('Madrid')
      await expect.poll(() => requested).toBe(true)
      expect(await element!.evaluate(node => node.isConnected)).toBe(true)
      await expect(pin).toHaveCount(1)
      const response = page.waitForResponse(response => response.url().includes('/api/map/features?') && new URL(response.url()).searchParams.get('city') === 'Madrid')
      release()
      await response
      await expect(page.getByRole('combobox', { name: 'City', exact: true })).toHaveValue('Madrid')
      expect(await element!.evaluate(node => node.isConnected)).toBe(true)
    } finally { release() }
  })
}

test('selects and restores a city without selecting its country filter', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/basemaps.cartocdn.com/**', route => route.abort())
  await page.goto('/map?mapView=20,0,2')
  const input = page.getByRole('combobox', { name: 'City', exact: true })
  await input.fill('Madrid')
  await page.getByRole('option', { name: 'Madrid', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('mapLocation')).toBe(cityId)
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('mapView')!.split(',')[2])).toBeGreaterThan(8)
  await expect(page.getByRole('button', { name: /Country/ })).toHaveText('All')
  expect(new URL(page.url()).searchParams.has('mapCountry')).toBe(false)
  await page.reload()
  await expect(input).toHaveValue('Madrid')
  await expect(page.getByRole('button', { name: /Country/ })).toHaveText('All')
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click()
  await page.getByRole('button', { name: 'Filters (1)', exact: true }).click()
  await expect(page.locator('.map--fullscreen').getByRole('button', { name: /Country/ })).toHaveText('All')
  await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click()
  await page.getByRole('button', { name: /Country/ }).click()
  await page.getByRole('option', { name: 'Spain', exact: true }).click()
  await expect(input).toHaveValue('Madrid')
  await expect.poll(() => new URL(page.url()).searchParams.get('mapCountry')).toBe('es')
})
