/** @vitest-environment jsdom */

import leaflet from 'leaflet'
import { cleanup, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { render } from '../../../support/intl'
import { LetterLocationMap } from '@/components/map/letter-location-map'

const point = { latitude: 40.4167, longitude: -3.7033 }

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it('keeps the letter pin centered with all navigation disabled and no fullscreen control', async () => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
  const mapFactory = vi.spyOn(leaflet, 'map')
  const { container, unmount } = render(<LetterLocationMap point={point} content="Una carta desde Madrid." />)
  await waitFor(() => expect(mapFactory).toHaveReturned())
  const map = mapFactory.mock.results[0].value as leaflet.Map
  expect(map.getCenter().lat).toBeCloseTo(40.4167)
  expect(map.getCenter().lng).toBeCloseTo(-3.7033)
  expect(map.getZoom()).toBe(13)
  for (const handler of [map.dragging, map.touchZoom, map.doubleClickZoom, map.scrollWheelZoom, map.boxZoom, map.keyboard]) {
    expect(handler.enabled()).toBe(false)
  }
  expect(container.querySelector('.leaflet-control-zoom')).toBeNull()
  expect(container.querySelector('.leaflet-control-fullscreen')).toBeNull()
  const marker = container.querySelector('.leaflet-marker-icon')
  expect(marker).toHaveClass('map-message-marker')
  expect(marker?.querySelector('svg')).toBeTruthy()
  expect(marker?.tagName).toBe('DIV')
  expect(marker).toHaveAttribute('tabindex', '0')
  const remove = vi.spyOn(map, 'remove')
  unmount()
  expect(remove).toHaveBeenCalledOnce()
})

it('recenters on a different letter and removes the previous map', async () => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
  const mapFactory = vi.spyOn(leaflet, 'map')
  const { rerender } = render(<LetterLocationMap point={point} content="Una carta desde Madrid." />)
  await waitFor(() => expect(mapFactory).toHaveReturned())
  const previousMap = mapFactory.mock.results[0].value as leaflet.Map
  const remove = vi.spyOn(previousMap, 'remove')
  rerender(<LetterLocationMap point={{ latitude: 37.5665, longitude: 126.978 }} content="Una carta desde Seúl." />)
  await waitFor(() => expect(mapFactory).toHaveBeenCalledTimes(2))
  const nextMap = mapFactory.mock.results[1].value as leaflet.Map
  expect(remove).toHaveBeenCalledOnce()
  expect(nextMap.getCenter().lat).toBeCloseTo(37.5665)
  expect(nextMap.getCenter().lng).toBeCloseTo(126.978)
  expect(nextMap.getZoom()).toBe(13)
})

it('shows an unavailable status when the basemap is not configured', () => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', '')
  const mapFactory = vi.spyOn(leaflet, 'map')
  const { getByRole } = render(<LetterLocationMap point={point} content="Una carta desde Madrid." />)
  expect(getByRole('status')).toBeInTheDocument()
  expect(mapFactory).not.toHaveBeenCalled()
})

it('opens and closes the letter popup without moving or zooming the static map', async () => {
  vi.stubEnv('NEXT_PUBLIC_CARTO_BASEMAP_KEY', 'test-key')
  const mapFactory = vi.spyOn(leaflet, 'map')
  const content = 'Mi carta <script>alert(1)</script> desde Madrid.'
  const { container, getByText, getByRole } = render(<LetterLocationMap point={point} content={content} />)
  await waitFor(() => expect(container.querySelector('.leaflet-marker-icon')).toBeTruthy())
  const map = mapFactory.mock.results[0].value as leaflet.Map
  const marker = getByRole('button', { name: 'View 1 message' })
  expect(container.querySelector('.leaflet-popup')).toBeNull()
  fireEvent.click(marker)
  expect(getByText(content)).toBeVisible()
  expect(container.querySelector('.leaflet-popup script')).toBeNull()
  expect(map.getCenter().lat).toBeCloseTo(40.4167)
  expect(map.getCenter().lng).toBeCloseTo(-3.7033)
  expect(map.getZoom()).toBe(13)
  fireEvent.click(getByRole('button', { name: 'Close popup' }))
  expect(container.querySelector('.leaflet-popup')).toBeNull()
  fireEvent.keyPress(marker, { key: 'Enter', keyCode: 13 })
  expect(getByText(content)).toBeVisible()
  expect(map.getCenter().lat).toBeCloseTo(40.4167)
  expect(map.getCenter().lng).toBeCloseTo(-3.7033)
})
