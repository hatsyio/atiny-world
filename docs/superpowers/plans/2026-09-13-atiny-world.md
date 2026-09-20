# ATINY World — Plan de implementación por entregas

Estado: arquitectura aprobada e implementación iniciada el 14 de septiembre de
2026 en la rama `feat/bootstrap`.

**Objetivo:** implementar el alcance validado sin publicar funciones simuladas ni activar servicios de pago.
**Arquitectura:** Next.js App Router con TypeScript, frontend y backend en un mismo proyecto y despliegue en Vercel; identidad Clerk y datos PostgreSQL en Supabase. Esta base está confirmada. Leaflet y el mapa base de CARTO están confirmados. Geoapify está confirmado para geocodificación, inicialmente en su plan gratuito. Los detalles operativos siguen pendientes.
**Especificación:** [requisitos](../../requisitos.md) y [arquitectura](../../arquitectura.md).
**Ejecución:** en esta tarea, por entregas verificables. Este documento organiza el trabajo; cada entrega tendrá sus pasos concretos de código y pruebas al comenzar, una vez disponibles las integraciones de las que depende.

## Restricciones comunes

- Inglés y español; texto internacional y emojis; 500 grafemas por mensaje.
- 10 mensajes por cuenta y cooldown de 10 segundos, ambos configurables.
- Moderación desactivada inicialmente; un cambio de moderación conserva estados, contenido y ubicación.
- Una edición reemplaza contenido y vuelve a pendiente, conservando el identificador público.
- El acceso público nunca revela mensajes ocultos ni evidencias privadas.
- Solo la autora edita; administradores moderan y el propietario asigna administradores.
- Ningún servicio de pago se activa sin autorización.
- Un proyecto Supabase remoto de producción y desarrollo local. Previews de solo lectura por defecto; escrituras autorizadas individualmente.
- Migraciones compatibles mediante expansión y contracción, probadas localmente y aplicadas en un paso controlado; nunca ejecutadas automáticamente desde previews.

## 1. Integraciones reales y base del proyecto

- [x] Consultar las integraciones y sus planes disponibles.
- [x] Vincular el proyecto Vercel `atiny-world`.
- [x] Confirmar los proveedores de identidad y datos con el propietario: Clerk y Supabase.
- [x] Confirmar Next.js con TypeScript y frontend/backend juntos en Vercel, con módulos que faciliten una posible separación futura.
- [x] Confirmar que todas las lecturas y escrituras de datos de Supabase pasan por el backend, sin acceso directo desde el navegador.
- [x] Acordar un único proyecto remoto, desarrollo local y previews con acceso de solo lectura por defecto.
- [x] Acordar migraciones compatibles antes del código dependiente y retirada posterior de estructuras antiguas.
- [x] Confirmar el resto de la arquitectura antes de implementar.
- [x] Acordar Europa para backend y base de datos, priorizando su proximidad.
- [x] Comprobar la región de Supabase (`eu-west-3`), vincular el proyecto y completar las aceptaciones necesarias de Clerk y Supabase.
- [ ] Validar la región efectiva del backend de Vercel y su proximidad con Supabase antes del lanzamiento.
- [x] Completar las altas gratuitas y comprobar que no se crean recursos duplicados.
- [x] Descargar las variables de desarrollo sin imprimir sus valores y excluirlas de Git.
- [x] Crear Next.js con TypeScript, pnpm y lockfile, conservando los documentos existentes.
- [x] Configurar los adaptadores de Clerk y PostgreSQL; verificar la conexión real de base de datos.
- [ ] Verificar registro, inicio de sesión, recuperación y Google con identidades reales.
- [ ] Configurar accesos separados para aplicación, migraciones y previews; comprobar que una preview de solo lectura no puede escribir ni acceder a tablas privadas no autorizadas.

Archivos: `package.json`, lockfile, `.gitignore`, `src/app/layout.tsx`, `src/server/auth/session.ts`, `src/server/db/client.ts`, `src/proxy.ts`.
Resultado: aplicación arrancable con servicios reales, aún sin publicación pública.

## 2. Dominio y persistencia

- [x] Validar el modelo principal de datos, los roles fan/administrador/propietario y la comprobación de permisos en servidor con roles y suspensiones almacenados en Supabase.

- [ ] Definir las tablas e índices a partir de la arquitectura y generar la migración.
- [ ] Probar la matriz de visibilidad con los cuatro estados, ambos modos y cuentas suspendidas.
- [ ] Probar grafemas con coreano, emoji compuesto y textos de 500/501 caracteres visibles.
- [ ] Probar coordenadas estables entre lecturas, distintas por mensaje y conservadas al editar solo texto.
- [ ] Implementar las reglas y ejecutar las pruebas hasta que pasen.
- [ ] Aplicar la migración en desarrollo y comprobar las restricciones únicas de usuarios.

Archivos: `src/domain/messages/{policy,validation}.ts`, `src/domain/location/position.ts`, `src/server/db/schema.ts`, `drizzle/`, `tests/domain/`.
Resultado: reglas ejecutables y almacenamiento preparado con pruebas de los invariantes acordados.

## 3. Publicar y explorar

- [x] Confirmar Leaflet, CARTO y Geoapify como biblioteca, mapa base y geocodificación, respectivamente.
- [ ] Configurar CARTO y Geoapify con las claves, atribuciones y cuotas correspondientes, y verificar búsquedas internacionales.
- [ ] Crear cabecera, introducción, mapa, formulario y footer en inglés y español.
- [ ] Implementar registro y perfil, publicación real, cooldown y límite atómicos.
- [ ] Implementar búsqueda geográfica, modo aproximado predeterminado y selección precisa.
- [ ] Implementar agrupaciones, filtros de destinatario/usuario, ficha y enlace estable.
- [ ] Implementar expansión de mapa y adaptación móvil.
- [ ] Verificar que una cuenta publica y otra visitante puede leer el mensaje público.

Archivos: `src/app/[locale]/page.tsx`, `src/components/map/`, `src/components/messages/`, `src/i18n/`, `src/server/messages/`, `src/app/api/messages/`, `src/app/api/places/`.
Resultado: flujo principal de extremo a extremo con datos persistidos.

## 4. Gestión personal y solicitudes de revisión

- [ ] Implementar «Mis mensajes», edición y borrado.
- [ ] Implementar «Pedir revisión» con copia privada de la versión y motivo.
- [ ] Verificar enlaces después de editar, retirar y borrar.

Archivos: `src/app/[locale]/my-messages/`, `src/server/messages/`, `src/server/moderation/review-requests.ts`, `tests/integration/messages.test.ts`.
Resultado: todas las operaciones de una fan, con límites y privacidad comprobados.

## 5. Administración

- [ ] Crear panel con búsqueda, revisión, solicitudes de revisión, configuración y suspensión.
- [ ] Implementar aprobación/rechazo por versión, retirada y motivos traducidos con nota.
- [ ] Mostrar impacto antes del cambio de moderación y conservar estados, contenido y ubicación.
- [ ] Implementar roles y auditoría atómica; impedir que un administrador edite texto ajeno.
- [ ] Probar suspensión y restitución, incluida la visibilidad y los permisos de borrado.

Archivos: `src/app/[locale]/admin/`, `src/server/moderation/`, `tests/integration/moderation.test.ts`.
Resultado: panel usable por varios administradores sin exposición de datos privados.

## 6. Eliminación y preparación del lanzamiento

- [ ] Implementar eliminación de cuenta y reintentos entre Supabase y Clerk.
- [ ] Implementar purga de copias dos años después del cierre de la solicitud de revisión.
- [ ] Configurar propietario, correo de contacto, dominio y Google de producción.
- [ ] Completar textos de privacidad y normas coherentes con la conservación acordada.
- [ ] Ejecutar comprobación de tipos, pruebas de dominio/integración y compilación.
- [ ] Verificar los flujos de registro, recuperación, vinculación, moderación y borrado con servicios reales.
- [ ] Publicar únicamente cuando esos flujos estén verificados y los datos de lanzamiento estén disponibles.

Archivos: `src/server/accounts/`, `src/server/moderation/retention.ts`, `src/app/[locale]/account/`, configuración de despliegue y documentación operativa.
Resultado: primera versión pública completa; las mejoras futuras permanecen fuera del alcance.
