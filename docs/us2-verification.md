# Verificación de US2

La aceptación de US2 se ejecuta con `pnpm test:bdd`. Los pasos usan el límite de
sesión y usuario verificado de Clerk mediante lectores inyectados, el adaptador
Geoapify con una respuesta HTTP controlada y PostgreSQL local. La selección se
firma y se verifica con el mismo código del servidor. El mapa y la ficha pública
se consultan mediante sus Route Handlers reales.

El acceso visible a «Mis mensajes» y la cuenta atrás del cooldown se comprueban
en `tests/unit/components/messages/create-message-form.test.tsx`. El BDD comprueba
que los errores reales de la acción contienen el código y los segundos restantes
que consume el formulario. Las pruebas de integración cubren el límite y el
cooldown bajo concurrencia.

Antes del lanzamiento queda pendiente T115: verificar contra proveedores reales
el registro, recuperación, Google y vinculación de identidades de Clerk, además
de las búsquedas internacionales y en coreano y el tratamiento de 429 de
Geoapify. Estas pruebas locales no sustituyen esa comprobación externa.
