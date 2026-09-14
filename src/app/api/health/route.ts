import { createHealthResponse } from '@/server/db/health-response'

export function GET() {
  return createHealthResponse()
}
