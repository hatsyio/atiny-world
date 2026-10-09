'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { mapCountries } from '@/i18n/countries'
import { letterHref, mapOrigin, readMapFilters, readMapView, type MapView } from '@/components/navigation/letter-origin'
import { rememberLetterOrigin } from '@/components/navigation/letter-link'
import type { MapBounds } from '@/domain/messages/public-message'
import { buildFeatureRequest, buildMessageRequest } from './public-map-controller'
import { isMissingPublicMessage, mapFeaturesQuery, publicMessageQuery } from './map-queries'
import { MapFilters, type MapFilterValues } from './map-filters'
import { MessageClusterList } from './message-cluster-list'
import { PublicMapLoader } from './public-map-loader'

const DEFAULT_VIEW: MapView = { latitude: 20, longitude: 0, zoom: 2 }

// URL writes reflect exploration; only external navigation should start a new one.
export function MapExplorer() {
  const params = useSearchParams()
  const search = params.toString()
  const [sync, setSync] = useState({ observed: search, context: search, written: search })
  if (search !== sync.observed) {
    setSync({ ...sync, observed: search, context: search === sync.written ? sync.context : search })
  }
  useEffect(() => {
    const restore = () => {
      const search = window.location.search.slice(1)
      setSync({ observed: search, context: search, written: search })
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  const onWrite = useCallback((search: string) => { setSync(current => ({ ...current, written: search })) }, [])
  return <Exploration key={sync.context} search={sync.context} onWrite={onWrite} />
}

function Exploration({ search, onWrite }: { search: string; onWrite: (search: string) => void }) {
  const params = new URLSearchParams(search)
  const initialView = readMapView(params) ?? DEFAULT_VIEW
  const linked = params.get('letter')
  const initialSelection = linked && /^[a-zA-Z0-9-]{1,100}$/.test(linked) ? linked : undefined
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [filters, setFilters] = useState<MapFilterValues>(() => {
    const filters = readMapFilters(params)
    if (!mapCountries.en.some(country => country.value === filters.country)) filters.country = ''
    return filters
  })
  const [selectedId, setSelectedId] = useState(initialSelection)
  const [selectionVersion, setSelectionVersion] = useState(0)
  const [focusSelection, setFocusSelection] = useState(!readMapView(params))
  const [panelOpen, setPanelOpen] = useState(false)
  const view = useRef(initialView)
  const [zoom, setZoom] = useState(initialView.zoom)
  const t = useTranslations('Map.explorer')
  const countries = mapCountries[useLocale()]
  const criteria = [filters.city, countries.find(country => country.value === filters.country)?.label].filter(Boolean)
  const router = useRouter()
  const hasBasemap = Boolean(process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY)
  const query = useQuery({
    ...mapFeaturesQuery(buildFeatureRequest(bounds ?? { west: -180, south: -90, east: 180, north: 90 }, filters, zoom)),
    enabled: hasBasemap && bounds !== null,
  })
  const selection = useQuery({ ...publicMessageQuery(selectedId ?? ''), enabled: hasBasemap && Boolean(selectedId) })
  const selected = selection.isError ? undefined : selection.data
  const visible = (query.isError ? [] : query.data?.features ?? []).filter(feature => !selection.isError || feature.publicId !== selectedId)
  // A panel page can contain a letter omitted by the marker cap, including a shared point.
  const matches = selected && (!filters.city || selected.locality?.toLowerCase() === filters.city.toLowerCase()) && (!filters.country || selected.countryCode === filters.country)
  const features = matches && !visible.some(feature => feature.publicId === selected.publicId) ? [...visible, selected] : visible

  const origin = useCallback((nextFilters = filters, nextId = selectedId) => {
    const url = new URL(mapOrigin(view.current, nextFilters, '/map'), 'https://atiny.invalid')
    if (nextId) url.searchParams.set('letter', nextId)
    return `${url.pathname}${url.search}#map`
  }, [filters, selectedId])
  const write = useCallback((href: string) => {
    const search = href.split('?')[1]?.split('#')[0] ?? ''
    onWrite(search)
    rememberLetterOrigin(href)
  }, [onWrite])
  const changeFilters = (next: MapFilterValues) => {
    setFilters(next)
    setSelectedId(undefined)
    // Passing undefined would use the callback's default selected ID.
    const href = mapOrigin(view.current, next, '/map')
    write(href)
  }
  const preview = (id: string, focus = true) => {
    setSelectionVersion(version => version + 1)
    setFocusSelection(focus)
    setSelectedId(id)
    write(origin(filters, id))
  }

  return <section className="map-explorer" aria-label={t('title')}>
    <div className="map-explorer__toolbar">
      <MapFilters value={filters} onChange={changeFilters} debounceMs={350} />
      <p className="map-explorer__criteria" aria-live="polite">{criteria.length ? criteria.join(' · ') : t('allAreas')}</p>
    </div>
    <div className="map-explorer__workspace">
      <div className="map-explorer__map">
        <div className="map-feedback" aria-live="polite">
          {query.isFetching ? <p role="status">{t('loading')}</p> : null}
          {query.isError ? <div role="status"><p>{t('error')}</p><button onClick={() => void query.refetch()}>{t('retry')}</button></div> : null}
          {query.data?.truncated ? <p role="status">{t('truncated')}</p> : null}
          {linked && !initialSelection ? <p role="status">{t('letterUnavailable')}</p> : null}
          {selection.isError ? <div role="status"><p>{t(isMissingPublicMessage(selection.error) ? 'letterUnavailable' : 'letterError')}</p><button onClick={() => void selection.refetch()}>{t('retry')}</button></div> : null}
        </div>
        <PublicMapLoader hideGroupList initialView={initialView} features={features} selectedPublicId={matches ? selectedId : undefined}
          focusSelection={focusSelection} selectionVersion={selectionVersion} onPreview={id => preview(id, false)}
          onViewChange={next => { view.current = next; setZoom(next.zoom); write(origin()) }} onViewportChange={setBounds}
          onSelect={id => { const href = origin(filters, id); write(href); router.push(letterHref(id, href)) }} />
      </div>
      <aside className={`map-explorer__panel${panelOpen ? ' map-explorer__panel--open' : ''}`} aria-label={t('areaLetters')}>
        <h2>{t('areaLetters')}</h2>
        <button className="map-explorer__panel-toggle" aria-expanded={panelOpen} aria-controls="area-letters" onClick={() => setPanelOpen(open => !open)}>{t(panelOpen ? 'hideLetters' : 'showLetters')}</button>
        <div id="area-letters" className="map-explorer__results">
          {hasBasemap && bounds ? <MessageClusterList keepPreviousViewport requestUrl={buildMessageRequest(bounds, filters)} selectedPublicId={selectedId} showLoadedCount onSelect={id => { preview(id); setPanelOpen(false) }} /> : <p role="status">{t(hasBasemap ? 'loading' : 'mapUnavailable')}</p>}
        </div>
      </aside>
    </div>
  </section>
}
