# Lector de facturas de compra

Iniciativa 1 de Mindlin Developers. La IA lee la factura de compra, propone rubro y proyecto, y la persona revisa y aprueba. Después la app guarda el PDF en Drive y agrega la fila en la planilla de Facturación de Egresos (P02) con estado "En revisión". No calcula retenciones (eso es la iniciativa 11).

## Estado

| Paso | Estado |
|---|---|
| Esqueleto Next.js + TypeScript | Hecho. |
| Extractor con IA (`lib/invoice/extract.ts`) | Hecho. Probado en producción con la API real de Claude y comprobantes sintéticos en imagen y PDF. Falta medir con facturas reales del cliente. |
| Controles de CUIT, suma y QR (`lib/validation/`) | Hecho. Falta leer el QR de la imagen o del PDF. |
| Script de evaluación (`scripts/eval/`) | Hecho. Espera el mes de muestra del cliente. |
| Login con Google y lista de mails | Hecho y desplegado en https://mindlin-developers.vercel.app |
| Pantalla de carga, revisión y aprobación | Hecho. Probado de punta a punta con la API real, Drive y la planilla de prueba. |
| Escritura en la planilla y control de duplicados | Hecho. Probado contra la planilla de prueba. |
| Subida de los PDF a Drive | Script publicado, autorizado y conectado a Vercel. Guardado de imagen y PDF verificado en la carpeta de prueba. |

Configuración actual de cada servicio: [docs/configuracion.md](docs/configuracion.md). Lo que falta: [docs/pendientes.md](docs/pendientes.md).

**Se continúa trabajando en la planilla y carpeta de prueba**, por decisión del responsable del proyecto el 28/10/2026. La planilla real del cliente todavía no está disponible. Los resultados de las pruebas están en [docs/verificacion.md](docs/verificacion.md).

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
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Cuenta de servicio para la planilla. La clave va como en el JSON, con los `\n` escritos | Planilla |
| `SHEET_ID`, `SHEET_TAB` | Planilla y pestaña donde se agregan las filas. **Mientras se desarrolla, una copia.** | Planilla |
| `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET` | Script que guarda los PDF en Drive (`apps-script/`) | Archivos. Sin esto, las facturas se cargan sin link |

## Estilo

Tomado de mindlindevelopers.com. Los colores y estilos están como variables en `app/globals.css`:

- Lima de marca `#D2DA4D` (el color del logo) y negro `#1A1A1A`. Botones principales en lima con texto negro.
- Tipografía Sora (400 y 700), cargada con `next/font`.
- Botones en píldora (radio de 30 px) y tarjetas con radio de 16 px.
- Los campos dudosos van en amarillo (`--dudoso`), un tono distinto del lima para que no se confundan.
- Logos en `public/brand/` y el ícono de la pestaña en `app/icon.png`, copiados del sitio.

## Login

Auth.js (`next-auth` v5) con Google. Solo entran los mails de `ALLOWED_EMAILS`, y tienen que estar verificados por Google.

- `auth.ts`: configuración. La sesión dura 12 horas.
- `proxy.ts`: todo pedido sin sesión válida va a `/login`. La lista se vuelve a mirar en cada pedido, así que sacar un mail de `ALLOWED_EMAILS` (y volver a desplegar) le corta el acceso a esa persona en el momento, aunque tenga la sesión abierta.
- `requireUser()` (`lib/auth/session.ts`): segunda barrera. Llamarlo al principio de cada página y ruta de API que toque datos.

### Crear el cliente OAuth de Google

1. En https://console.cloud.google.com, en el proyecto que se use para la app, ir a **APIs y servicios > Pantalla de consentimiento de OAuth** y completarla. Si el cliente tiene Google Workspace, conviene el tipo **Interno**: solo pueden entrar cuentas de su dominio.
2. **APIs y servicios > Credenciales > Crear credenciales > ID de cliente de OAuth**, tipo **Aplicación web**.
3. En **URI de redireccionamiento autorizados**, agregar:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<dominio de Vercel>/api/auth/callback/google`
4. Copiar el ID y el secreto a `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET`.

### Deploy en Vercel

1. En Vercel, **Add New > Project** e importar el repo `mindlindevelopersia/factura`. Vercel detecta Next.js solo.
2. Cargar `AUTH_SECRET` (generado con `npx auth secret`), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` y `ALLOWED_EMAILS`. `ANTHROPIC_API_KEY` todavía no hace falta en Vercel.
3. Desplegar y agregar el dominio que asigne Vercel en el paso 3 del cliente OAuth.

## Carga y revisión

La pantalla principal (`components/CargaFacturas.tsx`) funciona así:

1. La persona arrastra las facturas, en PDF o en foto. Las fotos se comprimen en el navegador (`lib/client/comprimir.ts`), porque Vercel acepta hasta 4,5 MB por pedido.
2. Cada archivo va a `POST /api/facturas/extraer`, que lo lee con la IA, corre los controles y se fija si ya está en la planilla. No guarda nada. Se leen de a dos facturas a la vez.
3. Se muestra la ficha editable al lado del archivo:
   - En amarillo, lo que la IA marcó como dudoso y lo que falla un control.
   - Un campo dudoso deja de estar en amarillo cuando la persona pasa por él. Los controles se recalculan mientras se edita.
4. Al aprobar, `POST /api/facturas/aprobar`:
   - Vuelve a validar y a controlar duplicados (si está repetida, responde 409).
   - Guarda el archivo con un nombre estándar.
   - Agrega la fila con estado "En revisión".

## Planilla

`lib/sheets/`. Las columnas y su orden están en `columnas.ts`: primero las de la ficha P02, después las que agrega la app (proyecto, estado, IVA otras alícuotas, otros tributos, tipo de cambio, CAE, cargado por y la clave de duplicado, que va en la última columna).

- Si la pestaña está vacía, la app escribe los encabezados. Si tiene menos columnas que las necesarias, las agrega.
- Las fechas y los importes se escriben como fechas y números. Las notas de crédito van en negativo.
- El texto que viene de la factura y empieza con `=`, `+`, `-` o `@` se fuerza a texto, para que una factura no pueda meter una fórmula.
- La escritura está detrás de la interfaz `Planilla`: si el cliente usa Excel, se cambia la implementación.

## Archivos

`lib/storage/archivos.ts`. Los PDF se guardan en Drive a través de un script de Apps Script publicado en la cuenta dueña de la carpeta (ver `apps-script/README.md`), porque la cuenta de servicio no tiene espacio en un Drive de Gmail. El nombre estándar es `AAAA-MM-DD Razón social - Tipo N°.pdf`.

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

En [docs/pendientes.md](docs/pendientes.md).
