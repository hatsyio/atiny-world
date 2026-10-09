import en from './countries/en.json'
import es from './countries/es.json'
import type { Locale } from './locale'

// Stable names and ordering avoid SSR differences between Node and browser ICU versions.
export const mapCountries: Record<Locale, { value: string; label: string }[]> = { en, es }
