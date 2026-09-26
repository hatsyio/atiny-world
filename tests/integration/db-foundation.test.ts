import { afterAll, describe, expect, it } from 'vitest'

import { getDb } from '../../src/server/db/client'

const db = getDb()

afterAll(async () => {
  await db.end()
})

type Row = Record<string, unknown>

async function existingRelations(schema: string): Promise<string[]> {
  const rows = await db<
    Row[]
  >`select tablename from pg_tables where schemaname = ${schema}`
  return rows.map((row) => String(row.tablename))
}

describe('app_private schema ownership', () => {
  it('owns the private schema and tables for the migration role', async () => {
    const schemaRows = await db<
      Row[]
    >`select nspowner::regrole as owner from pg_namespace where nspname = 'app_private'`
    expect(schemaRows).toHaveLength(1)
    expect(String(schemaRows[0].owner)).toBe('postgres')

    const tables = await existingRelations('app_private')
    expect(tables).toEqual(
      expect.arrayContaining(['profiles', 'messages', 'settings']),
    )

    const tableOwners = await db<
      Row[]
    >`select tablename, tableowner from pg_tables where schemaname = 'app_private'`
    for (const row of tableOwners) {
      expect(String(row.tableowner)).toBe('postgres')
    }
  })

  it('contains no reaction or like relation or column', async () => {
    const tables = await existingRelations('app_private')
    expect(tables.some((name) => /lik|reaction/.test(name))).toBe(false)

    const columns = await db<
      Row[]
    >`select t.table_name, c.column_name
        from information_schema.tables t
        join information_schema.columns c
          on c.table_schema = t.table_schema and c.table_name = t.table_name
       where t.table_schema = 'app_private'`
    expect(
      columns.some((row) => /lik|reaction/.test(String(row.column_name))),
    ).toBe(false)
  })
})

describe('Data API and default role denial', () => {
  const restrictedRoles = ['anon', 'authenticated', 'service_role'] as const

  for (const role of restrictedRoles) {
    it(`${role} cannot read app_private.profiles`, async () => {
      await expect(
        db.begin(async (tx) => {
          await tx.unsafe(`set local role ${role}`)
          await tx`select * from app_private.profiles limit 1`
        }),
      ).rejects.toThrow()
    })

    it(`${role} cannot read app_private.messages`, async () => {
      await expect(
        db.begin(async (tx) => {
          await tx.unsafe(`set local role ${role}`)
          await tx`select * from app_private.messages limit 1`
        }),
      ).rejects.toThrow()
    })
  }
})

describe('atiny_app_runtime least privilege', () => {
  it('is created with no administrative attributes', async () => {
    const rows = await db<
      Row[]
    >`select rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
        from pg_roles where rolname in ('atiny_app_runtime', 'atiny_preview_reader')`
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.rolsuper).toBe(false)
      expect(row.rolcreatedb).toBe(false)
      expect(row.rolcreaterole).toBe(false)
      expect(row.rolreplication).toBe(false)
      expect(row.rolbypassrls).toBe(false)
    }
  })

  it('can insert, read, update and delete product rows', async () => {
    const tempClerkId = `runtime-check-${crypto.randomUUID()}`
    await db.begin(async (tx) => {
      await tx`set local role atiny_app_runtime`
      await tx`
        insert into app_private.profiles
          (clerk_user_id, username, username_normalized, display_name)
        values (${tempClerkId}, 'runtime', 'runtime', 'Runtime')
      `
      const selected = await tx<
        Row[]
      >`select display_name from app_private.profiles where clerk_user_id = ${tempClerkId}`
      expect(selected).toHaveLength(1)
      expect(selected[0].display_name).toBe('Runtime')

      await tx`
        update app_private.profiles set display_name = 'Updated'
        where clerk_user_id = ${tempClerkId}
      `
      const updated = await tx<
        Row[]
      >`select display_name from app_private.profiles where clerk_user_id = ${tempClerkId}`
      expect(updated[0].display_name).toBe('Updated')

      await tx`delete from app_private.profiles where clerk_user_id = ${tempClerkId}`
    })
  })

  it('can read settings and sequence usage, but cannot run DDL', async () => {
    await db.begin(async (tx) => {
      await tx`set local role atiny_app_runtime`
      const rows = await tx<
        Row[]
      >`select message_limit from app_private.settings where id = 1`
      expect(rows[0].message_limit).toBe(10)
    })

    await expect(
      db.begin(async (tx) => {
        await tx`set local role atiny_app_runtime`
        await tx`alter table app_private.profiles add column should_fail int`
      }),
    ).rejects.toThrow()
  })
})

describe('atiny_preview_reader least privilege', () => {
  it('can read only the deliberate public projection', async () => {
    const rows = await db.begin(async (tx) => {
      await tx`set local role atiny_preview_reader`
      return tx<Row[]>`select * from preview_api.public_messages limit 1`
    })
    expect(Array.isArray(rows)).toBe(true)
  })

  it('cannot read app_private tables directly', async () => {
    await expect(
      db.begin(async (tx) => {
        await tx`set local role atiny_preview_reader`
        await tx`select * from app_private.profiles limit 1`
      }),
    ).rejects.toThrow()

    await expect(
      db.begin(async (tx) => {
        await tx`set local role atiny_preview_reader`
        await tx`select * from app_private.settings limit 1`
      }),
    ).rejects.toThrow()
  })

  it('cannot write through the public projection', async () => {
    await expect(
      db.begin(async (tx) => {
        await tx`set local role atiny_preview_reader`
        await tx`
          insert into preview_api.public_messages (public_id)
          values (gen_random_uuid())
        `
      }),
    ).rejects.toThrow()
  })
})

describe('foreign keys and core indexes', () => {
  it('declares the expected foreign keys', async () => {
    const rows = await db<
      Row[]
    >`select conrelid::regclass::text as table_name, conname,
         pg_get_constraintdef(oid) as definition
      from pg_constraint
      where connamespace = 'app_private'::regnamespace
        and contype = 'f'`
    const definitions = rows.map((row) => String(row.definition))

    for (const expected of [
      /references (app_private\.)?profiles\(id\) on delete set null/i,
      /references (app_private\.)?profiles\(id\)/i,
    ]) {
      expect(definitions.some((definition) => expected.test(definition))).toBe(
        true,
      )
    }
  })

  it('creates the required indexes', async () => {
    const rows = await db<
      Row[]
    >`select indexname, indexdef from pg_indexes where schemaname = 'app_private'`
    const byName = new Map(rows.map((row) => [String(row.indexname), row]))

    for (const name of [
      'profiles_public_id_key',
      'profiles_clerk_user_id_key',
      'profiles_display_name_search_idx',
      'profiles_suspended_by_idx',
      'messages_public_id_key',
      'messages_author_created_idx',
      'messages_status_published_idx',
      'messages_public_point_gix',
      'settings_updated_by_idx',
    ]) {
      expect(byName.has(name), `missing index ${name}`).toBe(true)
    }

    expect(String(byName.get('messages_public_point_gix')?.indexdef)).toContain(
      'gist',
    )
  })
})

describe('settings defaults', () => {
  it('seeds the singleton with the configured defaults', async () => {
    const rows = await db<
      Row[]
    >`select id, premoderation_enabled, message_limit, cooldown_seconds, version from app_private.settings`
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(1)
    expect(rows[0].premoderation_enabled).toBe(false)
    expect(rows[0].message_limit).toBe(10)
    expect(rows[0].cooldown_seconds).toBe(10)
    expect(rows[0].version).toBe(1)
  })

  it('enforces the id = 1 singleton check', async () => {
    await expect(
      db`insert into app_private.settings (id) values (2)`,
    ).rejects.toThrow()
  })

  it('enforces profile and message state checks', async () => {
    await expect(
      db`
        insert into app_private.profiles
          (clerk_user_id, username, username_normalized, display_name, role)
        values ('bad-role', 'bad', 'bad', 'Bad', 'superuser')
      `,
    ).rejects.toThrow()

    await expect(
      db`
        insert into app_private.profiles
          (clerk_user_id, username, username_normalized, display_name, account_state)
        values ('bad-state', 'bad-state', 'bad-state', 'Bad state', 'deleted')
      `,
    ).rejects.toThrow()
  })
})
