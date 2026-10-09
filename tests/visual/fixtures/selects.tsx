import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { NextIntlClientProvider } from 'next-intl'
import { SiteHeader } from '@/components/navigation/site-header'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { LanguagePreferenceProvider } from '@/components/i18n/language-context'
import { MapFilters, type MapFilterValues } from '@/components/map/map-filters'
import { AppSelect } from '@/components/ui/app-select'
import { LocationPicker } from '@/components/map/location-picker'
import Forms from '@/i18n/messages/es/forms.json'
import Settings from '@/i18n/messages/es/settings.json'
import Navigation from '@/i18n/messages/es/navigation.json'
import Map from '@/i18n/messages/es/map.json'
import '@/app/globals.css'

function Fixture() {
  const variant = new URLSearchParams(location.search).get('variant') ?? 'header'
  const [filters, setFilters] = useState<MapFilterValues>({ city: '', country: '' })
  return <NextIntlClientProvider locale="es" messages={{ Settings, Navigation, Map, Forms }} timeZone="UTC">
    <LanguagePreferenceProvider preference="auto">
      {variant === 'location' ? <main className="letter-workspace">
        <section className="letter-workspace__paper"><textarea defaultValue="Dear ATEEZ…" /></section>
        <section className="letter-workspace__properties"><LocationPicker onChange={() => {}} /></section>
      </main> : variant === 'header' ? <SiteHeader /> : <main className="fixture-panel">
        {variant === 'light' ? <section className="account-preferences"><LanguageSwitcher /></section>
          : variant === 'paper' ? <section className="map__filters-panel"><MapFilters value={filters} onChange={setFilters} /></section>
            : <section className={`admin-panel admin-section admin-section--${variant === 'admin-users' ? 'users' : 'messages'}`} style={{ display: 'block', padding: '1rem', margin: 0 }}>
              <AppSelect variant={variant === 'admin-users' ? 'admin-users' : 'admin-messages'} label="Motivo" name="reasonCode" placeholder="Elige un motivo" required options={[
                { value: 'spam', label: 'Contenido no deseado' },
                { value: 'conduct', label: 'Acoso o mala conducta' },
                { value: 'privacy', label: 'Datos personales o información privada' },
                { value: 'community_guidelines', label: 'Incumplimiento de las normas de la comunidad' },
              ]} />
            </section>}
      </main>}
    </LanguagePreferenceProvider>
  </NextIntlClientProvider>
}

createRoot(document.getElementById('root')!).render(<Fixture />)
