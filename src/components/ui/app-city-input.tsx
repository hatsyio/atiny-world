'use client'

import { useId, useSyncExternalStore } from 'react'
import { useLocale } from 'next-intl'
import { ComboBox, I18nProvider, Input, Label, ListBox, ListBoxItem, Popover } from 'react-aria-components'
import { matchesCity } from '@/domain/location/city-search'
import type { PublicLetterLocation } from '@/domain/location/public-locations'
import { useAutoFilterField } from './auto-filter-form'

const subscribeToFullscreen = (notify: () => void) => {
  document.addEventListener('fullscreenchange', notify)
  return () => document.removeEventListener('fullscreenchange', notify)
}
const readFullscreen = () => document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : undefined

export function AppCityInput({ label, locations, country = '', value = '', onChange }: {
  label: string
  locations: PublicLetterLocation[]
  country?: string
  value?: string
  onChange?: (city: string) => void
}) {
  const locale = useLocale()
  const filters = useAutoFilterField()
  const owner = useId()
  const selectedCountry = filters?.values.country ?? country
  const city = filters?.values.city ?? value
  const cities = [...new Set(locations
    .filter(location => !selectedCountry || location.country === selectedCountry)
    .map(location => location.city)
    .filter((name): name is string => Boolean(name)))].sort()
    .filter(name => matchesCity(name, city))
    .map(name => ({ id: name, label: name }))
  const change = (next: string) => {
    if (filters) filters.change('city', next, true)
    else onChange?.(next)
  }
  // Read the current fullscreen root before mounting the popup, including a
  // text change arriving before the browser dispatches fullscreenchange.
  const portalContainer = useSyncExternalStore(subscribeToFullscreen, readFullscreen, () => undefined)

  return <I18nProvider locale={locale}>
    <ComboBox className="app-select app-select--paper" data-overlay-owner={owner}
      name="city" inputValue={city} value={cities.some(option => option.id === city) ? city : null} items={cities} allowsCustomValue
      onInputChange={change} onChange={key => { if (key !== null) change(String(key)) }} menuTrigger="focus">
      <Label className="app-select-label">{label}</Label>
      <Input className="app-city-input" autoComplete="off" maxLength={100} />
      <Popover className="app-select-popover app-select-popover--paper" data-overlay-owner={owner}
        UNSTABLE_portalContainer={portalContainer} placement="bottom start" offset={6}>
        <ListBox<{ id: string; label: string }> className="app-select-options">
          {option => <ListBoxItem id={option.id} textValue={option.label} className="app-select-option">{option.label}</ListBoxItem>}
        </ListBox>
      </Popover>
    </ComboBox>
  </I18nProvider>
}
