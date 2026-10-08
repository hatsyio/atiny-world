import { globSync, rmSync } from 'node:fs'
import { join } from 'node:path'

// Next.js can emit its nomodule polyfill map after the PostHog compiler hook.
// Remove any remaining public maps before Vercel packages the deployment.
if (process.env.VERCEL === '1' && ['preview', 'production'].includes(process.env.VERCEL_ENV)) {
  const directory = join(process.cwd(), '.next', 'static')
  const maps = globSync('**/*.map', { cwd: directory })
  for (const map of maps) rmSync(join(directory, map))
  console.log(`Removed ${maps.length} remaining browser source map(s).`)
}
