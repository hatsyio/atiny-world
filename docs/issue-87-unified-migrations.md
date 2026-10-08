# Issue 87: unificación de migraciones locales

## Decisión

Usar Supabase CLI 2.109.1 también en Docker Compose. CI y Compose ejecutan los
mismos ficheros mediante el mismo motor y registran las versiones en
`supabase_migrations.schema_migrations`. Se retira el bucle propio que aplicaba
SQL y escribía en `app_migrations.applied`; `docker/migrate.sh` queda como
orquestación del arranque local y delega la aplicación en `migration up`.

No se sustituyen PostgreSQL/PostGIS ni el perfil `pro`, y no se ejecuta ningún
cambio en una base remota. La rama parte de #94 integrada en #89 (aee4533).

## Camino de ejecución

| Entorno | Preparación / aplicación | Historial |
| --- | --- | --- |
| CI y Supabase local | `supabase db start`, o `migration up --local` para pendientes | `supabase_migrations.schema_migrations` |
| Compose local | Prerrequisitos PostgreSQL, transición antigua y `migration up --db-url` al servicio `db` | `supabase_migrations.schema_migrations` |
| Perfil pro | Solo aplicación; ninguna migración automática | No se modifica |

`docker/Migrate.Dockerfile` instala el CLI de la misma versión fijada en CI.
Los archivos oficiales para amd64 y arm64 se verifican con sus SHA-256 de la
release antes de extraer el binario. El contenedor solo recibe la configuración
y los SQL del repositorio, no `.env.pro`, credenciales remotas ni `supabase/.temp`.

La URL del ejecutor apunta explícitamente a `db:5432`, con las credenciales
locales de Compose. PostgreSQL local no tiene TLS; se indica `sslmode=disable`
para esta conexión interna, ya que el CLI no reconoce el nombre `db` como su
base local y su modo TLS predeterminado no conecta a este servidor. El mensaje
“remote database” de `--db-url` no significa que se use el proyecto enlazado.
`PGDATABASE` permite seleccionar las bases aisladas de la prueba dentro del
mismo servicio local; por defecto es `postgres`.

`bootstrap-db.sql` conserva los prerrequisitos del ejecutor anterior: esquema
extensions, search_path y roles anon/authenticated/service_role sin login.
No representa un segundo ejecutor de migraciones ni registra SQL de aplicación.

## Transición de volúmenes existentes

1. Consultar los historiales disponibles sin ejecutar SQL de aplicación.
2. Comprobar que las versiones del historial CLI existen en el checkout y no
   son ambiguas. Comprobar que los nombres antiguos forman un prefijo contiguo
   exacto de los ficheros actuales; desconocidos, renombrados o huecos requieren
   revisión manual.
3. Invocar `migration repair --status applied` con **las versiones explícitas**
   registradas por el ejecutor antiguo que todavía faltan en el historial CLI.
   Esta operación cambia metadatos, no vuelve a ejecutar esos SQL. Nunca se
   invoca repair sin versiones, ni se utiliza `--include-all`.
4. Aplicar únicamente las pendientes mediante `migration up`.

Las filas antiguas se conservan como archivo y no reciben nuevas escrituras.
Las filas ya existentes del historial CLI no se sobrescriben durante la transición.
Una ejecución repetida no necesita reparación. Una base con app_private pero
sin filas en ninguno de los historiales se detiene: no se adivina su estado a
partir de tablas ni se trata como vacía.

La confianza en las filas antiguas procede de su escritura transaccional junto
al SQL por el ejecutor anterior. Ese historial no tenía checksums; esta transición
no puede demostrar que nadie haya alterado los SQL históricos o el esquema a
mano. Para estados inconsistentes, hay que comparar respaldo, historial y esquema
antes de autorizar una reparación explícita. No usar reset para resolverlos.

## Recuperación y reversión

Antes del primer arranque sobre un volumen con datos de valor, guardar un respaldo
de la base. El cambio de ejecutor es reversible en código; el historial antiguo
es un archivo desde la transición. **No arrancar una versión antigua sobre el
mismo volumen después de aplicar migraciones nuevas con el CLI:** no conocería
esas versiones e intentaría repetirlas. Mantener el ejecutor CLI o restaurar el
respaldo completo en un volumen separado para probar la versión anterior.

Si una migración pendiente falla, el CLI revierte el SQL y no añade su versión;
corregir la pendiente y reintentar. Si el error indica diferencias de historial,
revisar el estado antes de reparar: una sugerencia del CLI de usar `--include-all`
o marcar una versión no autoriza a ejecutar esos cambios automáticamente.

## Validación

`pnpm test:migrations` levanta un proyecto Compose con nombre único, sin puertos
publicados, sin aplicación y con un volumen de datos exclusivo. Elimina únicamente
ese proyecto y su volumen de prueba al terminar. Usa el CLI y PostgreSQL/PostGIS
reales, sin mocks ni acceso a las bases locales existentes.

- Base vacía: todas las migraciones quedan registradas en el historial CLI y un
  segundo arranque no las repite.
- Base heredada: todas menos la última migración registradas por el ejecutor
  antiguo; configuración, perfil y carta como datos testigo. El CLI
  incorpora el historial, aplica la pendiente, conserva los datos y el archivo
  antiguo; otro arranque conserva también los metadatos del historial CLI.
  Los roles de aplicación y preview mantienen sus lecturas permitidas.
- Historial desconocido, huecos y esquema sin historial: rechazo antes de reparar
  o aplicar SQL, conservando los datos y sin crear un historial sustituto.
- Pendiente con error SQL después de crear una tabla: la tabla y la entrada de
  historial no persisten. La misma migración corregida se aplica correctamente.

El job Docker de CI incorpora estas comprobaciones, además del build de la
aplicación. Los jobs de calidad e integración mantienen el entorno Supabase
local que ya utilizaban.

## Referencias

- [Supabase: migraciones de bases de datos](https://supabase.com/docs/guides/deployment/database-migrations)
- [CLI migration up y repair](https://supabase.com/docs/reference/cli/supabase-migration-up)
- [Release fijada 2.109.1](https://github.com/supabase/cli/releases/tag/v2.109.1)
- [Tratamiento TLS de la conexión CLI](https://github.com/supabase/cli/blob/v2.109.1/apps/cli/src/legacy/shared/legacy-db-connection.sql-pg.layer.ts)
