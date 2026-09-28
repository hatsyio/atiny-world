# Server Action Contracts

Estas acciones son adaptadores de la UI. Deben tratarse como endpoints públicos: validan payload, obtienen identidad con Clerk y vuelven a autorizar contra el perfil y el dato PostgreSQL en cada llamada. Nunca aceptan `actorId`, rol, suspensión, autora o estado como autoridad del cliente.

## Common result

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        messageKey: string;
        fieldErrors?: Record<string, string>;
        retryAfterSeconds?: number;
      };
    };
```

Los mensajes se traducen en la UI mediante `messageKey`. Logs y errores no contienen texto de mensaje, dirección, evidencia, token de selección, correo ni payload de proveedor.

## Profile actions

### `completeProfileForSession`

```ts
completeProfileForSession(): Promise<ActionResult<{ profilePublicId: string }>>
```

- Requiere sesión Clerk e identidad verificada.
- Lee `publicName` de Clerk y lo valida en servidor (1–50 caracteres Unicode tras quitar espacios exteriores).
- Crea el perfil por `clerk_user_id`; conserva el UUID público, nombre, rol y cartas en reintentos.
- El nombre público puede repetirse entre cuentas y no se usa para autenticar ni autorizar.
- No acepta correo, credenciales, nombre ni rol directamente del cliente en esta acción.

### `requestAccountDeletion`

```ts
requestAccountDeletion(input: {
  confirmation: 'DELETE';
}): Promise<ActionResult<{ status: 'completed' | 'pending' }>>
```

- Admite cuenta activa o suspendida; rechaza confirmación incorrecta.
- En una transacción marca `deletion_pending`, oculta la cuenta, borra mensajes, anula referencias permitidas e inserta el job único.
- Llama a Clerk solo después del commit. Si Clerk falla devuelve `pending`, conserva bloqueo total de la cuenta y programa reintento.
- Cierra la sesión cuando Clerk confirma; nunca declara `completed` con pasos pendientes.

## Message actions

### `createMessage`

```ts
createMessage(input: {
  content: string;
  recipient: Recipient | null;
  location:
    | { selectionId: string; precision: 'approximate' }
    | {
        selectionId: string;
        precision: 'precise';
        confirmedPublicPoint: { latitude: number; longitude: number };
        preciseLocationConfirmed: true;
      };
}): Promise<ActionResult<{
  publicId: string;
  version: 1;
  status: 'pending';
}>>
```

- Requiere perfil completo, activo y no suspendido.
- Verifica firma y caducidad de `selectionId`; nunca recibe de nuevo la dirección.
- La verificación es local y no vuelve a llamar a Geoapify: una selección ya confirmada y vigente sigue siendo válida si el proveedor cae. Sin selección confirmada, manipulada o caducada no crea el mensaje y conserva el borrador en la UI.
- Segmenta grafemas en servidor y rechaza 0 o más de 500; conserva el texto exacto aceptado.
- En modo aproximado calcula el desplazamiento una vez desde centro de localidad + UUID del mensaje + versión de algoritmo.
- La transacción bloquea el perfil, lee settings, cuenta todos sus mensajes, aplica límite/cooldown, inserta `pending` y actualiza `last_message_created_at`.
- Errores de dominio estables: `MESSAGE_LIMIT_REACHED`, `MESSAGE_COOLDOWN_ACTIVE`, `PROFILE_INCOMPLETE`, `ACCOUNT_SUSPENDED`, `LOCATION_SELECTION_REQUIRED`, `LOCATION_SELECTION_INVALID`, `LOCATION_SELECTION_EXPIRED`.

### `updateMessage`

```ts
updateMessage(input: {
  publicId: string;
  expectedVersion: number;
  content: string;
  location?:
    | { selectionId: string; precision: 'approximate' }
    | {
        selectionId: string;
        precision: 'precise';
        confirmedPublicPoint: { latitude: number; longitude: number };
        preciseLocationConfirmed: true;
      };
}): Promise<ActionResult<{
  publicId: string;
  version: number;
  status: 'pending';
}>>
```

- Solo la autora activa y no suspendida puede editar, incluido un mensaje rechazado o retirado.
- `expectedVersion` evita sobrescribir una edición concurrente.
- Sustituye texto, incrementa versión y vuelve a `pending`. Si no hay `location`, conserva exactamente el punto existente.
- No crea otra fila ni consume otro espacio; no conserva historial salvo evidencia de revisiones ya creada.

### `deleteMessage`

```ts
deleteMessage(input: {
  publicId: string;
  expectedVersion: number;
  confirmation: true;
}): Promise<ActionResult<{ deleted: true }>>
```

- Solo la autora; permitido también durante suspensión.
- Bloquea primero el perfil y luego el mensaje, borra físicamente y libera cupo.
- No modifica `last_message_created_at`; evidencia vigente queda intacta y sus FK se anulan.

### `requestMessageReview`

```ts
requestMessageReview(input: {
  publicId: string;
  expectedVersion: number;
  reason: string;
}): Promise<ActionResult<{ requestPublicId: string; status: 'open' }>>
```

- Requiere fan autenticada, activa y no suspendida.
- Vuelve a comprobar acceso al mensaje y versión; copia privadamente esa versión exacta.
- No cambia estado, visibilidad ni contadores del mensaje.
- La copia nunca aparece en respuestas públicas o previews.

## Moderation actions

Todas requieren rol `admin` u `owner` vigente y escriben la decisión y `admin_audit` en la misma transacción.

### `moderateMessage`

```ts
moderateMessage(input: {
  publicId: string;
  expectedVersion: number;
  decision: 'approve' | 'reject' | 'withdraw';
  reasonCode?: string;
  note?: string;
}): Promise<ActionResult<{ status: MessageStatus; version: number }>>
```

- `approve`: solo desde `pending`.
- `reject`: desde `pending`, exige `reasonCode`.
- `withdraw`: desde un mensaje actualmente público, exige `reasonCode`.
- Una versión distinta devuelve `MESSAGE_VERSION_CONFLICT` sin efecto parcial.
- Nunca permite editar `content`.

### `closeReviewRequest`

```ts
closeReviewRequest(input: {
  requestPublicId: string;
  resolutionCode: string;
  note?: string;
}): Promise<ActionResult<{ status: 'closed'; purgeAt: string }>>
```

- Bloquea la solicitud abierta, fija `closed_at` y `purge_at` dos años naturales después.
- No decide por sí sola el estado del mensaje; si se requiere moderación se invoca su acción explícita y versionada.

### `previewPremoderationImpact`

```ts
previewPremoderationImpact(input: {
  enabled: boolean;
}): Promise<ActionResult<{
  settingsVersion: number;
  messagesShown: number;
  messagesHidden: number;
}>>
```

- Lectura administrativa; calcula sobre la regla canónica actual y no modifica nada.

### `updateSettings`

```ts
updateSettings(input: {
  expectedVersion: number;
  premoderationEnabled?: boolean;
  messageLimit?: number;
  cooldownSeconds?: number;
}): Promise<ActionResult<{
  version: number;
  premoderationEnabled: boolean;
  messageLimit: number;
  cooldownSeconds: number;
}>>
```

- Revalida los valores y la versión tras la previsualización.
- Cambia configuración y auditoría atómicamente; nunca reescribe mensajes.

### `setSuspension`

```ts
setSuspension(input: {
  profilePublicId: string;
  suspended: boolean;
  reasonCode?: string;
  note?: string;
}): Promise<ActionResult<{ suspended: boolean }>>
```

- Suspender exige motivo; levantar suspensión limpia el estado vigente sin borrar auditoría.
- Un `admin` no puede suspender a otro `admin` ni al `owner`; solo `owner` puede actuar sobre administradores.
- El cambio se refleja en toda lectura nueva sin alterar mensajes.

### `setAdministratorRole`

```ts
setAdministratorRole(input: {
  profilePublicId: string;
  role: 'fan' | 'admin';
}): Promise<ActionResult<{ role: 'fan' | 'admin' }>>
```

- Solo `owner`; no permite asignar otro `owner` ni degradar al propietario mediante esta acción.
- Cambio y auditoría son atómicos.

## Cache and refresh behavior

- Ninguna acción confía en datos renderizados previamente.
- Tras éxito, la UI refresca el árbol y vuelve a consultar el viewport/ficha.
- No se usa invalidación stale-while-revalidate para visibilidad. Una lectura posterior debe observar edición, retirada, suspensión o borrado.
