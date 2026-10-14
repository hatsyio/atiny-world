import { expect, test } from '@playwright/test'
import postgres from 'postgres'

const sql = postgres(process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', { max: 1 })
const cityId = 'city:geoapify:issue129-browser-madrid'
const added: string[] = []
test.beforeAll(async () => {
  await sql`select pg_advisory_lock(4811, 20260921)`
  for (const [id, kind, name, west, south, east, north] of [
    ['country:es', 'country', 'Spain', -18, 27, 4.5, 44],
    [cityId, 'city', 'Madrid', -3.9, 40.3, -3.5, 40.6],
  ] as const) {
    const inserted = await sql`insert into app_private.geographic_locations
      (identity, kind, name, normalized_name, country, country_code, latitude, longitude, west, south, east, north, provider_id, provider, attribution, obtained_at)
      values (${id}, ${kind}, ${name}, ${name.toLowerCase()}, 'Spain', 'es', 40.4, -3.7, ${west}, ${south}, ${east}, ${north}, ${id}, 'Geoapify', 'Powered by Geoapify | © OpenStreetMap contributors', now())
      on conflict do nothing returning identity`
    if (inserted.length) added.push(id)
  }
})
test.afterAll(async () => {
  for (const id of added) await sql`delete from app_private.geographic_locations where identity = ${id}`
  await sql`select pg_advisory_unlock(4811, 20260921)`
  await sql.end()
})
for (const width of [320, 1440]) {
  test(`frames persisted Spain then Madrid without letters and restores the URL at ${width}px`, async ({ page }) => {
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
    await input.press('Escape')
    await page.getByRole('button', { name: 'Find city', exact: true }).click()
    await page.getByRole('button', { name: /Madrid · Spain/ }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('mapLocation')).toBe(cityId)
    await expect.poll(() => Number(new URL(page.url()).searchParams.get('mapView')!.split(',')[2])).toBeGreaterThan(8)
    if (width < 760) await page.getByRole('button', { name: 'Show letters', exact: true }).click()
    await expect(page.getByText('No messages in this area.', { exact: true })).toBeVisible()
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
