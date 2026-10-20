import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import leaflet from 'leaflet'
import { NextIntlClientProvider } from 'next-intl'
import { ReactLeafletPublicMap } from '@/components/map/public-map-react-leaflet'
import { LeafletMap } from '@/components/map/leaflet-map'
import { MapQueryProvider } from '@/components/map/map-query-provider'
import messages from '@/i18n/messages/en/map.json'
import '@/app/globals.css'

leaflet.Map.addInitHook(function (this: leaflet.Map) { Object.assign(window, { paletteMap: this }) })
const positions = [[41.385, 2.17], [41.3851, 2.1701], [41.395, 2.195], [41.36, 2.20], [41.425, 2.115]]
const features = positions.map(([latitude, longitude], index) => ({
  publicId: `11111111-1111-4111-8111-11111111111${index}`,
  point: { latitude, longitude }, precision: 'approximate' as const,
  locality: 'Barcelona', country: 'Spain', countryCode: 'es', publishedAt: '2026-10-17T10:00:00Z',
  author: { publicId: '22222222-2222-4222-8222-222222222222', displayName: 'ATINY' },
}))
function Fixture() {
  const [fullscreen, setFullscreen] = useState(false)
  const [selected, setSelected] = useState<string>()
  const [visible, setVisible] = useState(true)
  const brandFrame = new URLSearchParams(location.search).get('frame') === 'brand'
  const attributionFixture = new URLSearchParams(location.search).has('attribution')
  return <NextIntlClientProvider locale="en" messages={{ Map: messages }} timeZone="UTC"><MapQueryProvider>
    {brandFrame && <header className="site-header"><span className="nav-brand">Atiny Atlas</span></header>}
    <main className={[brandFrame ? 'paper-world' : '', attributionFixture ? '' : 'palette-fixture'].join(' ')} style={{ maxWidth: 1200, margin: '24px auto', padding: '0 12px' }}>
      <h1 style={{ margin: '0 0 8px', color: '#102033', fontSize: 24 }}>ATINY letters · Barcelona</h1>
      <p style={{ margin: '0 0 16px' }}>Water, city and terrain · map palette</p>
      <button onClick={() => setSelected(features[2].publicId)}>Select letter</button>
      <button onClick={() => setVisible(current => !current)}>{visible ? 'Hide map' : 'Show map'}</button>
      {attributionFixture ? <LeafletMap features={features} onSelect={() => {}} groupRequestUrl="/api/map/messages" /> : visible && <section className={fullscreen ? 'map map--fullscreen' : 'map'}>
        <ReactLeafletPublicMap features={features} apiKey={process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY ?? 'fixture'}
          initialView={new URLSearchParams(location.search).get('view') === 'world'
            ? { latitude: 20, longitude: 0, zoom: 2 } : { latitude: 41.395, longitude: 2.16, zoom: 12 }} selectedPublicId={selected} focusSelection={false}
          isFullscreen={fullscreen} onToggleFullscreen={() => setFullscreen(current => !current)} onSelect={() => {}} />
      </section>}
    </main>
  </MapQueryProvider></NextIntlClientProvider>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
