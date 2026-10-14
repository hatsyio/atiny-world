'use client'

import { useId, useMemo, useState, useSyncExternalStore } from 'react'
import { useLocale } from 'next-intl'
import { ComboBox, I18nProvider, Input, Label, ListBox, ListBoxItem, Popover } from 'react-aria-components'
import { mapCountries } from '@/i18n/countries'
import { matchesCity } from '@/domain/location/city-search'
import type { PublicLetterLocation } from '@/domain/location/public-locations'
import { useAutoFilterField } from './auto-filter-form'

const subscribeToFullscreen = (notify: () => void) => {
  document.addEventListener('fullscreenchange', notify)
  return () => document.removeEventListener('fullscreenchange', notify)
}
const readFullscreen = () => document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : undefined

export function AppCityInput({ label, locations, country = '', value = '', onChange, onSelect }: {
  label: string
  locations: PublicLetterLocation[]
  country?: string
  value?: string
  onChange?: (city: string) => void
  onSelect?: (city: string, country: string) => void
}) {
  const [selection, setSelection] = useState<{ id: string; city: string; country: string } | null>(null)
  const locale = useLocale()
  const filters = useAutoFilterField()
  const owner = useId()
  const selectedCountry = filters?.values.country ?? country
  const city = filters?.values.city ?? value
  const identifyCountries = Boolean(onSelect)
  const cities = useMemo(() => {
    const candidates = locations.filter(location => location.city && (!selectedCountry || location.country === selectedCountry))
    const named = new Map(candidates.map(location => [identifyCountries ? `${location.country}:${location.city}` : location.city!, location]))
    return [...named].filter(([, location]) => matchesCity(location.city, city)).map(([id, location]) => {
      const name = location.city!
      const homonymous = !selectedCountry && identifyCountries && candidates.some(other => other.city === name && other.country !== location.country)
      const countryName = mapCountries[locale].find(country => country.value === location.country)?.label ?? location.country
      return { id, city: name, country: location.country, label: homonymous ? `${name} · ${countryName}` : name }
    }).sort((a, b) => a.label.localeCompare(b.label, locale))
  }, [locations, selectedCountry, city, identifyCountries, locale])
  // Only an explicit catalog selection identifies a map locality. Typing its
  // full name must still leave the suggestion available for selection.
  const selectedKey = identifyCountries
    ? (selection?.city === city && (!selectedCountry || selection.country === selectedCountry) ? selection.id : null)
    : cities.find(option => option.city === city)?.id ?? null
  const change = (next: string) => {
    if (filters) filters.change('city', next, true)
    else onChange?.(next)
  }
  // Read the current fullscreen root before mounting the popup, including a
  // text change arriving before the browser dispatches fullscreenchange.
  const portalContainer = useSyncExternalStore(subscribeToFullscreen, readFullscreen, () => undefined)

  return <I18nProvider locale={locale}>
    <ComboBox className="app-select app-select--paper" data-overlay-owner={owner}
      name="city" inputValue={city} value={selectedKey} items={cities} allowsCustomValue
      onInputChange={next => { if (next !== selection?.city) setSelection(null); change(next) }} onChange={key => { const option = cities.find(option => option.id === key); if (option) { setSelection(option); change(option.city); onSelect?.(option.city, option.country) } }} menuTrigger="focus">
      <Label className="app-select-label">{label}</Label>
      <Input className="app-city-input" autoComplete="off" maxLength={100} />
      <Popover className="app-select-popover app-select-popover--paper" data-overlay-owner={owner}
        UNSTABLE_portalContainer={portalContainer} placement="bottom start" offset={6}>
        <ListBox<{ id: string; label: string; city: string; country: string }> className="app-select-options">
          {option => <ListBoxItem id={option.id} textValue={option.label} className="app-select-option">{option.label}</ListBoxItem>}
        </ListBox>
      </Popover>
    </ComboBox>
  </I18nProvider>
}
