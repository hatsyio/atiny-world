/** Keep this normalization in sync with the public repository's city predicate. */
export function normalizeCitySearch(value: string): string {
  return value.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{Nd}]/gu, '')
}

export function matchesCity(locality: string | null | undefined, query: string): boolean {
  if (!query) return true
  const search = normalizeCitySearch(query)
  return Boolean(search && locality && normalizeCitySearch(locality).includes(search))
}
