import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { withPostHogConfig } from '@posthog/nextjs-config'

const nextConfig: NextConfig = { agentRules: false }
const withIntl = createNextIntlPlugin('./src/i18n/request.ts')(nextConfig)

// Only deployment builds upload maps. Local and CI builds work without secrets.
const uploadSourceMaps = process.env.VERCEL === '1' &&
  ['preview', 'production'].includes(process.env.VERCEL_ENV ?? '')

export default uploadSourceMaps
  ? withPostHogConfig(withIntl, {
      personalApiKey: process.env.POSTHOG_API_KEY ?? '',
      projectId: process.env.POSTHOG_PROJECT_ID ?? '',
      host: 'https://us.posthog.com',
      sourcemaps: {
        enabled: true,
        releaseName: 'atiny-world',
        releaseVersion: process.env.VERCEL_GIT_COMMIT_SHA,
        deleteAfterUpload: true,
      },
    })
  : withIntl
