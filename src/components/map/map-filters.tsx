'use client'

import { RECIPIENTS } from '@/domain/contracts'

export interface MapFilterValues {
  city?: string
  country?: string
  recipient: string
  fan: string
}

interface Props {
  value: MapFilterValues
  onChange: (values: MapFilterValues) => void
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

function normalizeRecipient(value: string): string {
  return RECIPIENTS.includes(value as (typeof RECIPIENTS)[number]) ? value : ''
}

export function MapFilters({ value, onChange }: Props) {
  return (
    <div className="map-filters" role="group" aria-label="Filtros">
      <label htmlFor="city-filter">Ciudad</label>
      <input
        id="city-filter"
        type="text"
        name="city"
        aria-label="Ciudad"
        value={value.city ?? ''}
        maxLength={MAX_TEXT_FILTER_LENGTH}
        onChange={(event) =>
          onChange({ ...value, city: normalizeTextFilter(event.target.value) })
        }
      />

      <label htmlFor="country-filter">País</label>
      <select
        id="country-filter"
        name="country"
        aria-label="País"
        value={normalizeCountry(value.country ?? '')}
        onChange={(event) =>
          onChange({ ...value, country: normalizeCountry(event.target.value) })
        }
      >
        <option value="">Todos</option>
        {ISO_ALPHA_2_COUNTRIES.map((country) => (
          <option key={country} value={country}>
            {country.toUpperCase()}
          </option>
        ))}
      </select>

      <label htmlFor="recipient-filter">Destinatario</label>
      <select
        id="recipient-filter"
        name="recipient"
        role="combobox"
        aria-label="Destinatario"
        value={normalizeRecipient(value.recipient)}
        onChange={(event) =>
          onChange({ ...value, recipient: normalizeRecipient(event.target.value) })
        }
      >
        <option value="">Todos</option>
        {RECIPIENTS.map((recipient) => (
          <option key={recipient} value={recipient}>
            {recipient}
          </option>
        ))}
      </select>

      <label htmlFor="fan-filter">Fan</label>
      <input
        id="fan-filter"
        type="text"
        name="fan"
        role="textbox"
        aria-label="Fan"
        value={value.fan}
        maxLength={MAX_TEXT_FILTER_LENGTH}
        onChange={(event) =>
          onChange({ ...value, fan: normalizeTextFilter(event.target.value) })
        }
      />
    </div>
  )
}
