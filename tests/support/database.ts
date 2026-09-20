import postgres, { type Sql } from 'postgres'

export type TestProfile = {
  id: string
  public_id: string
  clerk_user_id: string
  username: string
  display_name: string
}

export type TestMessage = {
  id: string
  public_id: string
  author_id: string
  version: number
  status: string
}

type ProfileOverrides = Partial<{
  username: string
  username_normalized: string
  display_name: string
  role: string
  account_state: string
  suspended_at: string | null
  suspension_reason_code: string | null
  suspended_by: string | null
  last_message_created_at: string | null
}>

type MessageOverrides = Partial<{
  version: number
  content: string
  recipient: string | null
  status: string
  moderation_reason_code: string | null
  moderation_note: string | null
  location_precision: string
  locality: string | null
  country: string
  country_code: string
  longitude: number
  latitude: number
  location_algorithm_version: number | null
  published_at: string
}>

export function createTestDb(): Sql {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

  return postgres(url, { max: 1, prepare: false })
}

export function createSecondConnection(): Sql {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

  return postgres(url, { max: 1, prepare: false })
}

export async function truncateProductTables(sql: Sql): Promise<void> {
  await sql`
    with cleared_messages as (
      delete from app_private.messages
    )
    delete from app_private.profiles
  `
}

export async function insertProfile(
  sql: Sql,
  clerkUserId: string,
  overrides: ProfileOverrides = {},
): Promise<TestProfile> {
  const username = overrides.username ?? `fan-${clerkUserId}`
  const rows = await sql<TestProfile[]>`
    insert into app_private.profiles (
      clerk_user_id, username, username_normalized, display_name
    ) values (
      ${clerkUserId}, ${username}, ${overrides.username_normalized ?? username.toLowerCase()},
      ${overrides.display_name ?? username}
    )
    returning id, public_id, clerk_user_id, username, display_name
  `
  const profile = rows[0]

  if (overrides.role !== undefined || overrides.account_state !== undefined || overrides.suspended_at !== undefined) {
    await sql`
      update app_private.profiles
         set role = ${overrides.role ?? 'fan'},
             account_state = ${overrides.account_state ?? 'active'},
             suspended_at = ${overrides.suspended_at ?? null},
             suspension_reason_code = ${overrides.suspension_reason_code ?? null},
             suspended_by = ${overrides.suspended_by ?? null},
             last_message_created_at = ${overrides.last_message_created_at ?? null}
       where id = ${profile.id}
    `
  }

  return profile
}

export async function insertMessage(
  sql: Sql,
  authorId: string,
  overrides: MessageOverrides = {},
): Promise<TestMessage> {
  const rows = await sql<TestMessage[]>`
    insert into app_private.messages (
      author_id, version, content, recipient, status,
      moderation_reason_code, moderation_note, location_precision,
      location_algorithm_version,
      public_point, locality, country, country_code, published_at
    ) values (
      ${authorId}, ${overrides.version ?? 1}, ${overrides.content ?? 'Un mensaje de prueba'},
      ${overrides.recipient ?? null}, ${overrides.status ?? 'pending'},
      ${overrides.moderation_reason_code ?? null}, ${overrides.moderation_note ?? null},
      ${overrides.location_precision ?? 'approximate'},
      ${overrides.location_algorithm_version ?? 1},
      ST_SetSRID(ST_MakePoint(${overrides.longitude ?? -2.5}, ${overrides.latitude ?? 39.5}), 4326)::geography,
      ${overrides.locality ?? null}, ${overrides.country ?? 'España'},
      ${overrides.country_code ?? 'es'}, ${overrides.published_at ?? new Date().toISOString()}
    )
    returning id, public_id, author_id, version, status
  `

  return rows[0]
}

export async function currentSettings(sql: Sql) {
  const rows = await sql<Array<{
    premoderation_enabled: boolean
    message_limit: number
    cooldown_seconds: number
    version: number
  }>>`select premoderation_enabled, message_limit, cooldown_seconds, version from app_private.settings`

  return rows[0]
}