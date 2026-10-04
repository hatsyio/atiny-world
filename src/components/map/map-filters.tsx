'use client'

import type { Locale } from '@/i18n/locale'

import { useTranslations } from 'next-intl'

export interface MapFilterValues {
  city?: string
  country?: string
}

interface Props {
  value: MapFilterValues
  onChange: (values: MapFilterValues) => void
  lang?: Locale
}

const MAX_TEXT_FILTER_LENGTH = 100
const ISO_ALPHA_2_COUNTRIES = `
ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee eg eh er es et fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug um us uy uz va vc ve vg vi vn vu wf ws ye yt za zm zw
`.trim().split(/\s+/)

function normalizeTextFilter(value: string): string {
  return [...value.trim()].slice(0, MAX_TEXT_FILTER_LENGTH).join('')
}

function normalizeCountry(value: string): string {
  const country = value.trim().toLowerCase()
  return ISO_ALPHA_2_COUNTRIES.includes(country) ? country : ''
}

export function MapFilters({ value, onChange }: Props) {
  const t = useTranslations('Map.filters')
  return (
    <div className="map-filters" role="group" aria-label={t('filters')}>
      <label htmlFor="city-filter">{t('city')}</label>
      <input
        id="city-filter"
        type="text"
        name="city"
        aria-label={t('city')}
        value={value.city ?? ''}
        maxLength={MAX_TEXT_FILTER_LENGTH}
        onChange={(event) =>
          onChange({ ...value, city: normalizeTextFilter(event.target.value) })
        }
      />

      <label htmlFor="country-filter">{t('country')}</label>
      <select
        id="country-filter"
        name="country"
        aria-label={t('country')}
        value={normalizeCountry(value.country ?? '')}
        onChange={(event) =>
          onChange({ ...value, country: normalizeCountry(event.target.value) })
        }
      >
        <option value="">{t('all')}</option>
        {ISO_ALPHA_2_COUNTRIES.map((country) => (
          <option key={country} value={country}>
            {country.toUpperCase()}
          </option>
        ))}
      </select>

    </div>
  )
}
