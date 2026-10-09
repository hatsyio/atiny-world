export interface LetterExploration {
  q?: string
  country?: string
  city?: string
  page?: number
}

export function readLetterExploration(params: Record<string, string | string[] | undefined>): LetterExploration {
  const text = (name: string, length: number) => typeof params[name] === 'string'
    ? [...params[name].trim()].slice(0, length).join('') : ''
  const country = text('country', 2).toLowerCase()
  const page = typeof params.page === 'string' && /^[1-9]\d*$/.test(params.page) ? Number(params.page) : 1
  return {
    q: text('q', 200), city: text('city', 100),
    country: typeof params.country === 'string' && /^[a-z]{2}$/i.test(params.country.trim()) ? country : '',
    page: Number.isSafeInteger(page) ? page : 1,
  }
}

export function lettersHref(criteria: LetterExploration, publicId?: string): string {
  const params = new URLSearchParams()
  for (const key of ['q', 'country', 'city'] as const) {
    if (criteria[key]) params.set(key, criteria[key])
  }
  if (criteria.page && criteria.page > 1) params.set('page', String(criteria.page))
  return `/letters${params.size ? `?${params}` : ''}${publicId ? `#letter-${publicId}` : ''}`
}
