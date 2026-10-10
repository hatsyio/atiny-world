import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, extname } from 'node:path'

const root = process.cwd()
const output = resolve(root, '.visual-test-build')
const stubs = resolve(root, 'tests/visual/fixtures')
await build({
  entryPoints: [resolve(stubs, 'selects.tsx')], bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic',
  outdir: output, external: ['/images/*'],
  loader: { '.png': 'dataurl' },
  plugins: [{ name: 'location-map-fixture', setup(builder) {
    builder.onResolve({ filter: /^\.\/(letter-location-map|location-selection-map)$/ }, args =>
      args.importer === resolve(root, 'src/components/map/location-picker.tsx')
        ? { path: resolve(stubs, 'location-map.tsx') } : undefined)
  } }],
  alias: {
    '@': resolve(root, 'src'),
    'next/navigation': resolve(stubs, 'navigation.ts'),
    'next/link': resolve(stubs, 'link.tsx'),
    '@clerk/nextjs': resolve(stubs, 'navigation.ts'),
    '@/server/actions/language-preference': resolve(stubs, 'navigation.ts'),
    'posthog-js': resolve(stubs, 'analytics.ts'),
  },
})

// Reuse the self-hosted fonts from the production build for stable typography.
const chunks = resolve(root, '.next/static/chunks')
const compiledCss = (await Promise.all((await readdir(chunks)).filter(name => name.endsWith('.css')).map(name => readFile(resolve(chunks, name), 'utf8')))).join('\n')
const fontCss = (compiledCss.match(/@font-face\{[^}]*\}|\.[\w-]+\{[^}]*--font-(?:display|interface):[^}]*\}/g) ?? []).join('\n')
const fontClasses = [...compiledCss.matchAll(/\.([\w-]+)\{[^}]*--font-(?:display|interface):[^}]*\}/g)].map(match => match[1]).join(' ')
if (!fontClasses || !fontCss.includes('@font-face')) throw new Error('Production fonts not found. Run pnpm build before visual checks.')
const html = `<!doctype html><html lang="es" class="${fontClasses}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fontCss}
body{background:#e8e1d5}.fixture-panel{width:min(480px,calc(100% - 32px));margin:24px auto}
</style><link rel="stylesheet" href="/selects.css"><body><div id="root"></div><script type="module" src="/selects.js"></script></body></html>`
const types = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' }
createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname
  try {
    // A full fixture catalog exercises the dropdown's scrolling and long labels.
    if (path === '/api/map/filter-options') {
      const countries = JSON.parse(await readFile(resolve(root, 'src/i18n/countries/es.json'), 'utf8'))
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ locations: [...countries.map(country => ({ country: country.value, city: null })), ...['Barcelona', 'Badalona', 'Madrid'].map(city => ({ country: 'es', city }))] }))
      return
    }
    if (path === '/') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); return }
    const base = path.startsWith('/_next/') ? root : path.startsWith('/images/') ? resolve(root, 'public') : output
    const relative = path.startsWith('/_next/') ? path.replace('/_next/', '.next/') : path.slice(1)
    const file = resolve(base, relative)
    if (!file.startsWith(base + '/')) { response.writeHead(403).end(); return }
    response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream')
    response.end(await readFile(file))
  } catch { response.writeHead(404).end() }
}).listen(8770, '0.0.0.0', () => process.stdout.write('Visual select fixtures ready on port 8770\n'))
