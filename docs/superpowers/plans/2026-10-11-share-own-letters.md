# Compartir cartas propias: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar en una PR un menú de compartir cartas propias públicas, textos preparados e imágenes descargables.

**Architecture:** La página decide elegibilidad con las lecturas existentes. Un módulo puro construye extractos y enlaces; componentes accesibles gestionan copia y compartir. Rutas Node.js generan PNG con recursos locales y visibilidad comprobada en cada solicitud.

**Tech Stack:** Next.js 16, React 19, next-intl, React Aria, ImageResponse; Satori para medir el texto con las fuentes de exportación.

**Spec:** `docs/superpowers/specs/2026-10-11-share-own-letters-design.md`

## Global Constraints

- Compartir únicamente cartas propias y públicamente visibles; autoría y visibilidad son controles distintos.
- PNG story 1080 × 1920, publicación 1080 × 1080, Open Graph 1200 × 630.
- Mantener el texto literal, firma y enlaces canónicos sin parámetros de navegación.
- Español e inglés; contenido de la carta en su idioma original.
- Sin migraciones, publicación automática ni servicios externos de generación.

## Review Focus

- Cuenta suspendida o pendiente de eliminación: sin controles ni exportación privada.
- Carta retirada después de abrir el menú: exportación denegada y mensajes claros.
- Texto Unicode, palabras extensas y nombres largos: imágenes legibles sin desbordamiento.
- Cancelación del menú del sistema y navegador sin portapapeles: recuperación útil.
- Enlaces de contenido dentro de la carta: presupuesto de X conservador y parámetros correctamente codificados.

## Task 1: Textos y destinos

**Files:** `src/domain/messages/letter-share.ts`, `tests/unit/domain/messages/letter-share.test.ts`.
**Interfaces:** `letterExcerpt(content, max, locale): string`; `prepareLetterShare(message, locale, origin): {url, text, destinations}`.

- [ ] Añadir pruebas de enlace canónico, texto literal, frase y truncado por grafemas, límites de X y Threads, ubicación larga y parámetros con caracteres especiales.

```ts
expect(new URL(share.destinations.x).searchParams.get('url')).toBe(share.url)
expect(share.text).toContain('Lee mi carta completa en Atiny Atlas')
expect(letterExcerpt('Primera frase. Segunda frase muy larga.', 22, 'es')).toBe('Primera frase.…')
```

- [ ] Ejecutar `pnpm exec vitest run tests/unit/domain/messages/letter-share.test.ts`; comprobar fallo por módulo inexistente.
- [ ] Implementar construcción con `URL`/`URLSearchParams`, `Intl.Segmenter` y cómputo conservador del presupuesto de X. Ningún destino debe recibir el enlace dos veces.
- [ ] Repetir la prueba y confirmar que pasa. Commit del módulo y pruebas.

## Task 2: Exportación e imágenes públicas

**Files:** `src/server/messages/letter-share-image.tsx`, `src/server/messages/letter-share-access.ts`, `src/app/api/messages/[publicId]/share-image/route.ts`, `src/app/api/messages/[publicId]/social-image/route.ts`; pruebas de rutas e imágenes.
**Interfaces:** `renderLetterShareImage(message, format, locale): Promise<Response>`; `format` admite `story | square | og`.

- [ ] Escribir pruebas de acceso, formatos e idiomas inválidos, respuesta sin caché y dimensiones PNG reales. Añadir un caso de carta larga con texto coreano y nombre largo.

```ts
expect(response.status).toBe(404) // usuario distinto del autor
expect(response.headers.get('Cache-Control')).toContain('no-store')
expect(png.readUInt32BE(16)).toBe(1080)
expect(png.readUInt32BE(20)).toBe(1920)
```

- [ ] Ejecutar pruebas y verificar fallos antes de implementar.
- [ ] Añadir fuentes locales con sus licencias. Usar Satori para medir el alto real y buscar el extracto que cabe; generar PNG con `ImageResponse`. Validar identificador y query antes de consultar datos. Comprobar permiso, autoría y lectura pública para exportación; solo lectura pública para Open Graph.
- [ ] Ejecutar pruebas de rutas e imágenes. Commit de la exportación verificada.

## Task 3: Menú y vista previa

**Files:** componentes nuevos en `src/components/messages/`, catálogos `src/i18n/messages/{es,en}/forms.json`, integración en `letter-detail.tsx`, estilos propios importados en `globals.css`.
**Interfaces:** `<LetterShare message={PublicMessageDetail} origin={string} />`; elegibilidad explícita `shareOrigin?: string` en el detalle.

- [ ] Escribir pruebas de abrir/cerrar, destinos, copia con alternativa, descarga, fallo y reintento, cancelación del sistema y ausencia de APIs.

```ts
fireEvent.click(screen.getByRole('button', {name: 'Share'}))
expect(await screen.findByRole('dialog', {name: 'Share your letter'})).toBeVisible()
```

- [ ] Ejecutar las pruebas y verificar fallo.
- [ ] Implementar diálogo no modal anclado en escritorio y panel modal en móvil, con React Aria, y vista previa modal con formatos mediante botones. Obtener el PNG como blob, revocar URLs al cerrar/cambiar y preparar el archivo antes de invocar compartir para preservar la activación del usuario.
- [ ] Implementar estilos con papel `#eed4a7`, tinta `#2b1a12`, azul `#102033`, oro `#c79a50`; firma serif y acciones legibles. La imagen es el elemento protagonista.
- [ ] Ejecutar pruebas y revisión de escritorio/móvil. Commit del flujo.

## Task 4: Integración, metadatos y entrega

**Files:** página de detalle, pruebas `letter-detail-owner.test.tsx`, metadatos, pruebas visuales y documentación.
**Interfaces:** metadatos usan únicamente contenido público y el origen canónico existente.

- [ ] Añadir pruebas de menú visible al autor público y ausente en visitantes, extranjeros y estados privados; metadatos sin contenido privado.
- [ ] Verificar fallos y conectar elegibilidad `authorization.ok && ownMessage && publicMessage` con igualdad de autor. Añadir Open Graph/X usando `/api/messages/{id}/social-image?locale={locale}`.
- [ ] Ejecutar lint, typecheck, suite unitaria y `pnpm test`; informar fallos de infraestructura si la BD de pruebas no está disponible.
- [ ] Inspeccionar PNG y vistas de escritorio/móvil; registrar evidencia y limitaciones de aplicaciones móviles no disponibles.
- [ ] Revisión independiente del diff completo, resolver hallazgos relevantes con regresiones, crear commits y abrir PR contra `main`. Sin merge.
