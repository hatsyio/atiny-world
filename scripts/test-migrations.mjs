import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const fixture = mkdtempSync(join(tmpdir(), 'atiny-migrations-'))
const project = `atiny-migrations-test-${process.pid}`
const compose = ['compose', '-p', project, '-f', 'compose.yaml', '-f', 'tests/migrations/compose.yaml', '--profile', 'local']
function docker(args, input, allowFailure = false) {
  const result = spawnSync('docker', [...compose, ...args], { input, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  if (result.error) throw result.error
  if (result.status !== 0 && !allowFailure) throw new Error(result.stderr || result.stdout)
  return result
}
function sql(database, statement) {
  return docker(['exec', '-T', 'db', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], statement).stdout.trim()
}
function migrate(database, allowFailure = false, volumes = []) {
  return docker(['run', '--rm', '--no-deps', '-e', `PGDATABASE=${database}`, ...volumes.flatMap(volume => ['--volume', volume]), 'migrate'], undefined, allowFailure)
}
function rejected(database, reason) {
  const result = migrate(database, true)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, new RegExp(reason))
}

const migrations = readdirSync('supabase/migrations').filter(file => file.endsWith('.sql')).sort()
const bootstrap = readFileSync('docker/bootstrap-db.sql', 'utf8')
try {
  docker(['build', 'db', 'migrate'])
  docker(['up', '--detach', '--wait', 'db'])
  sql('postgres', 'create database migration_fresh; create database migration_legacy;')
  migrate('migration_fresh')
  assert.equal(sql('migration_fresh', 'select count(*) from supabase_migrations.schema_migrations;'), String(migrations.length))
  assert.equal(sql('migration_fresh', 'select count(*) from app_private.settings where id = 1;'), '1')
  migrate('migration_fresh')
  assert.equal(sql('migration_fresh', 'select count(*) from supabase_migrations.schema_migrations;'), String(migrations.length))
  console.log('PASS: fresh database and repeated startup use CLI history')

  // Reproduce a volume from the old executor, with its last migration still pending.
  sql('migration_legacy', bootstrap + 'create schema app_migrations; create table app_migrations.applied (filename text primary key, applied_at timestamptz default now());')
  for (const filename of migrations.slice(0, -1)) {
    sql('migration_legacy', `begin;\n${readFileSync(`supabase/migrations/${filename}`, 'utf8')}\ninsert into app_migrations.applied (filename) values ('${filename}');\ncommit;`)
  }
  sql('migration_legacy', `
    update app_private.settings set message_limit = 37 where id = 1;
    insert into app_private.profiles (clerk_user_id, display_name) values ('user_migration_fixture', 'Migration fixture');
    insert into app_private.messages (author_id, content, status, location_precision, public_point, country, country_code, location_algorithm_version)
      select id, 'Preserve this letter', 'approved', 'approximate', extensions.st_setsrid(extensions.st_makepoint(-3, 40), 4326)::extensions.geography, 'España', 'es', 1
      from app_private.profiles where clerk_user_id = 'user_migration_fixture';
  `)
  const profile = sql('migration_legacy', "select to_jsonb(p) - 'suspension_version' from app_private.profiles p;")
  const letter = sql('migration_legacy', 'select to_jsonb(m) from app_private.messages m;')
  migrate('migration_legacy')
  assert.equal(sql('migration_legacy', 'select count(*) from supabase_migrations.schema_migrations;'), String(migrations.length))
  assert.equal(sql('migration_legacy', 'select message_limit from app_private.settings where id = 1;'), '37')
  assert.equal(sql('migration_legacy', "select to_jsonb(p) - 'suspension_version' from app_private.profiles p;"), profile)
  assert.equal(sql('migration_legacy', 'select to_jsonb(m) from app_private.messages m;'), letter)
  assert.equal(sql('migration_legacy', "set role atiny_app_runtime; select content from app_private.messages;"), 'Preserve this letter')
  assert.equal(sql('migration_legacy', "set role atiny_preview_reader; select count(*) from preview_api.public_messages;"), '1')
  assert.equal(sql('migration_legacy', 'select count(*) from app_migrations.applied;'), String(migrations.length - 1))
  const history = sql('migration_legacy', 'select version, name, statements from supabase_migrations.schema_migrations order by version;')
  migrate('migration_legacy')
  assert.equal(sql('migration_legacy', 'select version, name, statements from supabase_migrations.schema_migrations order by version;'), history)
  console.log('PASS: legacy history reconciled, pending SQL applied, data and archived history preserved')

  sql('postgres', 'create database migration_unknown; create database migration_untracked; create database migration_gap;')
  sql('migration_unknown', "create schema app_migrations; create table app_migrations.applied (filename text primary key); insert into app_migrations.applied values ('20260101000000_unknown.sql');")
  rejected('migration_unknown', 'legacy filenames')
  assert.equal(sql('migration_unknown', "select to_regclass('supabase_migrations.schema_migrations') is null;"), 't')
  assert.equal(sql('migration_unknown', "select count(*) from app_migrations.applied;"), '1')
  sql('migration_untracked', "create schema app_private; create table app_private.sentinel (value text); insert into app_private.sentinel values ('keep');")
  rejected('migration_untracked', 'no applied migrations are recorded')
  assert.equal(sql('migration_untracked', 'select value from app_private.sentinel;'), 'keep')
  sql('migration_gap', `create schema app_migrations; create table app_migrations.applied (filename text primary key); insert into app_migrations.applied values ('${migrations[0]}'), ('${migrations[2]}');`)
  rejected('migration_gap', 'not a contiguous prefix')
  assert.equal(sql('migration_gap', "select to_regclass('supabase_migrations.schema_migrations') is null;"), 't')
  console.log('PASS: unknown, incomplete and untracked histories fail before repair or application SQL')

  // A failed pending migration must roll back its DDL and leave history untouched.
  cpSync('supabase/migrations', join(fixture, 'migrations'), { recursive: true })
  const pending = join(fixture, 'migrations', '29990101000000_transaction_probe.sql')
  const volumes = [`${join(fixture, 'migrations')}:/workspace/supabase/migrations:ro`]
  writeFileSync(pending, 'create table app_private.migration_probe (value int); select 1 / 0;')
  const failed = migrate('migration_fresh', true, volumes)
  assert.notEqual(failed.status, 0)
  assert.match(failed.stderr + failed.stdout, /At statement: 1\s+select 1 \/ 0/)
  assert.equal(sql('migration_fresh', "select to_regclass('app_private.migration_probe') is null;"), 't')
  assert.equal(sql('migration_fresh', 'select count(*) from supabase_migrations.schema_migrations;'), String(migrations.length))
  writeFileSync(pending, 'create table app_private.migration_probe (value int); insert into app_private.migration_probe values (1);')
  migrate('migration_fresh', false, volumes)
  assert.equal(sql('migration_fresh', 'select value from app_private.migration_probe;'), '1')
  assert.equal(sql('migration_fresh', 'select count(*) from supabase_migrations.schema_migrations;'), String(migrations.length + 1))
  console.log('PASS: failed pending SQL rolls back and a corrected migration can be retried')

} finally {
  // Only this uniquely named disposable test project is removed.
  docker(['down', '--volumes', '--remove-orphans', '--rmi', 'local'])
  rmSync(fixture, { recursive: true, force: true })
}
