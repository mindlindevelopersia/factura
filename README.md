# Lector de facturas de compra

Iniciativa 1 de Mindlin Developers. La IA lee la factura de compra, propone rubro y proyecto, y la persona revisa y aprueba. Después la app guarda el PDF en Drive y agrega la fila en la planilla de Facturación de Egresos (P02) con estado "En revisión". No calcula retenciones (eso es la iniciativa 11).

## Estado

| Paso | Estado |
|---|---|
| Esqueleto Next.js + TypeScript | Hecho. Página vacía, sin login. |
| Extractor con IA (`lib/invoice/extract.ts`) | Hecho. Probado con una API simulada, todavía no con facturas reales. |
| Controles de CUIT, suma y QR (`lib/validation/`) | Hecho. Falta leer el QR de la imagen o del PDF. |
| Script de evaluación (`scripts/eval/`) | Hecho. Espera el mes de muestra del cliente. |
| Login con Google y lista de mails | Pendiente |
| Pantalla de carga, revisión y aprobación | Pendiente |
| Escritura en la planilla, subida a Drive y control de duplicados | Pendiente. Ya está la clave de duplicado (`claveDuplicado`). |

## Desarrollo

```bash
npm install
cp .env.example .env.local   # completar
npm run dev                  # app en http://localhost:3000
npm test                     # tests (sin llamadas a la API)
npm run typecheck
npm run eval -- --dir muestras/2026-09   # ver scripts/eval/README.md
```

Requiere Node 22 o más nuevo.

## Variables de entorno

Nada de esto va al repo. En local, en `.env.local`. En Vercel, en Settings > Environment Variables.

| Variable | Para qué | Cuándo hace falta |
|---|---|---|
| `ANTHROPIC_API_KEY` | Llamar a Claude | Ya (extractor y evaluación) |
| `AUTH_SECRET` | Firmar las sesiones de Auth.js (`npx auth secret`) | Login |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Cliente OAuth de Google para el login | Login |
| `ALLOWED_EMAILS` | Mails que pueden entrar, separados por coma | Login |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Cuenta de servicio para Sheets y Drive | Planilla y Drive |
| `SHEET_ID`, `SHEET_TAB` | Planilla y pestaña donde se agregan las filas. **Mientras se desarrolla, una copia.** | Planilla |
| `DRIVE_FOLDER_ID` | Carpeta donde se guardan los PDF. **Mientras se desarrolla, una de prueba.** | Drive |

Las credenciales de Google pueden cambiar según cómo se resuelva la subida a Drive (ver Pendientes).

## Cómo funciona la extracción

`extractInvoice(file)` manda el PDF (como bloque `document`) o la foto (como bloque `image`) a `claude-opus-5-5` y devuelve los campos de la planilla P02 según el esquema zod de `lib/invoice/schema.ts`:

- **Salida estructurada** con `output_config.format`: la respuesta siempre es un JSON con ese esquema. El esquema se convierte con `lib/invoice/json-schema.ts` y no con el `zodOutputFormat` del SDK, porque ese helper pasa los `enum` a la descripción en vez de dejarlos como restricción.
- **Esfuerzo bajo** (`output_config.effort: "low"`).
- **Fallback del lado del servidor** (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`): si el modelo rechaza la factura, la API la reintenta con otro modelo. `ExtractionResult.fallback` indica si pasó.
- La IA marca en `campos_dudosos` lo que no pudo leer bien. `validateInvoice` suma a esa lista los campos que fallan algún control: eso es lo que la pantalla de revisión va a marcar en amarillo.

Convenciones de los importes (en `lib/invoice/prompt.ts`), **a confirmar con el cliente**:

- Facturas B, C y tickets (no discriminan IVA): el importe va en `no_gravado`.
- Exento: va en `no_gravado`.
- IVA al 27%, 5% o 2,5%: va en `iva_otras`, que no es una columna de la planilla.
- Percepciones de otras provincias e impuestos internos: van en `otros_tributos`, que tampoco es una columna de la planilla.
- Notas de crédito: importes en positivo. El signo se decide al escribir en la planilla.

Rubros: si `config/rubros.json` tiene una lista, la IA tiene que elegir uno de ahí. Si está vacía, propone uno libre.

## Controles

- **CUIT** (`lib/validation/cuit.ts`): prefijo válido y dígito verificador (módulo 11), para el emisor y el receptor.
- **Suma** (`lib/validation/sum.ts`): neto + no gravado + IVA + percepciones + otros tributos = total, con una tolerancia de $0,05.
- **QR de ARCA** (`lib/validation/qr.ts`): decodifica la URL `https://www.afip.gob.ar/fe/qr/?p=...` y compara CUIT, punto de venta, tipo, número, fecha, importe, moneda y CAE. Por ahora recibe el texto del QR: falta leerlo de la imagen o del PDF.

## Pendientes

- **Excel o Google Sheets**: definir con el cliente, y conocer la estructura exacta de las columnas. La escritura conviene aislarla detrás de una interfaz.
- **Subida a Drive**: una cuenta de servicio no tiene espacio propio. Hace falta una unidad compartida de Google Workspace o OAuth con un usuario de administración (refresh token).
- **Clave de la API**: a nombre del cliente (lo ideal) o la del consultor durante el desarrollo.
- **Leer el QR** de fotos y PDF (por ejemplo con `jsqr`, renderizando el PDF a imagen).
- **Tamaño de archivo**: Vercel acepta hasta 4,5 MB por envío. Comprimir las fotos en el navegador y configurar `maxDuration` en las rutas que llamen a la IA.
- **Reglas de rubro por proveedor**, si la evaluación muestra que hacen falta.
- Controlar que el CUIT receptor sea el de Mindlin.
