# Navegación del mapa — issue 129

**Objetivo:** cumplir https://github.com/hatsyio/atiny-world/issues/129 sobre el mapa Leaflet existente.

**Diseño:** coordenadas y límites compartidos en app_private.geographic_locations, con identidad única y búsquedas por nombre normalizado/país. Resolución explícita en servidor con Geoapify, nunca durante escritura. Selección de resultado inequívoco antes de encuadrar. La URL conserva la identidad seleccionada. Un controlador de movimiento cancela vuelos anteriores y abre popups al finalizar. Sin expiración, históricos ni nuevas dependencias.

- [x] Probar normalización/validación de Geoapify y reutilización persistida, errores y homónimos; implementar proveedor, repositorio, migración y endpoint.
- [x] Probar selección geográfica explícita, prioridad de localidad, solicitudes obsoletas y conservación de URL; integrar filtros y ambos exploradores.
- [x] Probar vuelo y popup diferido, cancelación, límites y movimiento reducido; integrar controlador Leaflet.
- [x] Ejecutar lint, tipos, suites unitarias/BDD/integración/contrato y build; documentar evidencias y preparar PR.

**Verificación adicional:** límites inválidos, centro sin bbox, territorio sin mensajes, country scope, doble selección y consultas del viewport solo en moveend.
