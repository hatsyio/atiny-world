import { execFileSync } from 'node:child_process'
import { relative } from 'node:path'
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'

const root = process.cwd()
const output = resolve(root, '.visual-test-build/map-palette')
await build({
  entryPoints: ['tests/visual/fixtures/map-palette.tsx'], bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic',
  outdir: output, external: ['/images/*'], loader: { '.png': 'dataurl' },
  define: { 'process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY': JSON.stringify(process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY ?? 'fixture'), 'process.env.NODE_ENV': '"development"' },
  alias: { '@': resolve(root, 'src') },
  // Next bundles this URL as a local asset; serve the same installed worker in this harness.
  plugins: [{ name: 'map-worker', setup(builder) {
    if (process.env.MAP_PALETTE_BASELINE_REF) builder.onLoad({ filter: /(public-map-react-leaflet\.tsx|globals\.css)$/ }, args => ({
      contents: execFileSync('git', ['show', `${process.env.MAP_PALETTE_BASELINE_REF}:${relative(root, args.path)}`], { encoding: 'utf8' }),
      loader: args.path.endsWith('.css') ? 'css' : 'tsx',
    }))
    builder.onLoad({ filter: /vector-basemap\.tsx$/ }, async args => ({ contents: (await readFile(args.path, 'utf8')).replace("new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href", "'/maplibre-worker.mjs'"), loader: 'tsx' }))
  } }],
})
const html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/map-palette.css"><style>body{background:#f3ecdf}.map{height:560px}.map__canvas{height:100%}.map--fullscreen{height:100dvh}</style><body><div id="root"></div><script type="module" src="/map-palette.js"></script></body></html>'
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' }
createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname
  try {
    if (path === '/') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); return }
    if (path.startsWith('/api/messages/')) {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ content: 'From this corner of the world, music brings us closer. A letter to share memories, friendship and the same horizon.', author: { displayName: 'ATINY' }, locality: 'Barcelona', country: 'Spain' })); return
    }
    if (path === '/maplibre-worker.mjs') {
      response.setHeader('Content-Type', 'text/javascript')
      response.end(await readFile(resolve(root, 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'))); return
    }
    const base = path.startsWith('/images/') ? resolve(root, 'public') : output
    const file = resolve(base, path.slice(1))
    if (!file.startsWith(base + '/')) { response.writeHead(403).end(); return }
    response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream')
    response.end(await readFile(file))
  } catch { response.writeHead(404).end() }
}).listen(8771, '127.0.0.1', () => process.stdout.write('Map palette fixtures ready on port 8771\n'))
