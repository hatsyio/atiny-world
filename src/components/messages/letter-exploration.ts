export interface LetterExploration {
  q?: string
  country?: string
  city?: string
  cursor?: string
}

export function readLetterExploration(params: Record<string, string | string[] | undefined>): LetterExploration {
  const text = (name: string, length: number) => typeof params[name] === 'string'
    ? [...params[name].trim()].slice(0, length).join('') : ''
  const country = text('country', 2).toLowerCase()
  return {
    q: text('q', 200), city: text('city', 100),
    country: typeof params.country === 'string' && /^[a-z]{2}$/i.test(params.country.trim()) ? country : '',
    cursor: text('cursor', 2048),
  }
}

export function lettersHref(criteria: LetterExploration, publicId?: string): string {
  const params = new URLSearchParams()
  for (const key of ['q', 'country', 'city', 'cursor'] as const) {
    if (criteria[key]) params.set(key, criteria[key])
  }
  return `/letters${params.size ? `?${params}` : ''}${publicId ? `#letter-${publicId}` : ''}`
}
