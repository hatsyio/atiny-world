type MetadataEnvironment = Record<string, string | undefined>

/** A stable origin keeps preview URLs and reader preferences out of canonicals. */
export function metadataBase(environment: MetadataEnvironment = process.env): URL {
  const candidates = [environment.SITE_URL, environment.VERCEL_PROJECT_PRODUCTION_URL && `https://${environment.VERCEL_PROJECT_PRODUCTION_URL}`, 'http://localhost:3000']
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const url = new URL(candidate)
      if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) return new URL(url.origin)
    } catch { /* Invalid optional configuration falls back to a safe origin. */ }
  }
  return new URL('http://localhost:3000')
}
