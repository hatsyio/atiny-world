import { checkDatabaseHealth } from "@/server/db/health"

type HealthProbe = typeof checkDatabaseHealth

export async function createHealthResponse(
  probe: HealthProbe = checkDatabaseHealth,
) {
  try {
    return Response.json(await probe())
  } catch {
    return Response.json({ database: "unavailable" }, { status: 503 })
  }
}
