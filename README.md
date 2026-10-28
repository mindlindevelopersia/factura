# Lector de facturas

Iniciativa 1 de Mindlin Developers. La IA lee el comprobante y lo clasifica en una de las tres carpetas del equipo: **compras**, **honorarios de administración** (las facturas que los socios le hacen a la sociedad) o **ventas**. Propone los datos como los carga el equipo y la persona revisa y aprueba. Después la app guarda el PDF en la carpeta de Drive de su categoría y agrega la fila en la planilla Administración Contable: compras y honorarios en "Facturación de Egresos (Compras)", ventas en "Facturación de Ingresos (Ventas)". No calcula retenciones (eso es la iniciativa 11).

## Estado

| Paso | Estado |
|---|---|
| Esqueleto Next.js + TypeScript | Hecho. |
| Extractor con IA (`lib/invoice/extract.ts`) | Hecho. Probado en producción con la API real de Claude y comprobantes sintéticos en imagen y PDF. Falta medir con facturas reales del cliente. |
| Controles de CUIT, suma y QR (`lib/validation/`) | Hecho. Falta leer el QR de la imagen o del PDF. |
| Script de evaluación (`scripts/eval/`) | Hecho y adaptado a la planilla real. Falta correrlo con octubre de 2026 (ver [pendientes](docs/pendientes.md)). |
| Tres categorías y columnas de la planilla real | Hecho en el código (29/10/2026). Falta publicar el script nuevo de Apps Script y configurar las pestañas (ver [pendientes](docs/pendientes.md)). |
| Login con Google y lista de mails | Hecho y desplegado en https://mindlin-developers.vercel.app |
| Pantalla de carga, revisión y aprobación | Hecho. Probado de punta a punta con la API real, Drive y la planilla de prueba. |
| Escritura en la planilla y control de duplicados | Hecho. Probado contra la planilla de prueba. |
| Subida de los PDF a Drive | Script publicado, autorizado y conectado a Vercel. Guardado de imagen y PDF verificado en la carpeta de prueba. |

Configuración actual de cada servicio: [docs/configuracion.md](docs/configuracion.md). Lo que falta: [docs/pendientes.md](docs/pendientes.md).

**Se continúa trabajando en la planilla y carpeta de prueba de mindlindevelopers.ia@gmail.com**, por decisión del responsable del proyecto el 28/10/2026. La planilla real del cliente todavía no está disponible. Los resultados de las pruebas están en [docs/verificacion.md](docs/verificacion.md).

## Desarrollo

```bash
npm install
cp .env.example .env.local   # completar
npm run dev                  # app en http://localhost:3000
npm test                     # tests (sin llamadas a la API)
npm run typecheck
npm run eval -- --dir muestras/2026-10 --mes 2026-10 --decimal punto   # ver scripts/eval/README.md
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
| `SHEET_ID` | Planilla Administración Contable. **Mientras se desarrolla, una copia.** | Planilla |
| `SHEET_TAB_EGRESOS` | Pestaña de compras y honorarios. Si no está, se usa `SHEET_TAB` (el nombre anterior) | Planilla |
| `SHEET_TAB_INGRESOS` | Pestaña de ventas. Sin esto, la app no carga ventas | Ventas |
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
2. Cada archivo va a `POST /api/facturas/extraer`, que lo lee con la IA, lo clasifica, completa lo que sale de la carga anterior de la misma contraparte (ver abajo), corre los controles y se fija si ya está en la planilla. No guarda nada. Se leen de a dos facturas a la vez.
3. Se muestra la ficha editable al lado del archivo. La categoría se puede cambiar, y cambia los campos: las compras y los honorarios piden razón social, CUIT, rubro y "corresponde a"; las ventas, cliente, tipo de pago y depto.
   - En amarillo, lo que la IA marcó como dudoso y lo que falla un control.
   - Un campo dudoso deja de estar en amarillo cuando la persona pasa por él. Los controles se recalculan mientras se edita.
4. Al aprobar, `POST /api/facturas/aprobar`:
   - Vuelve a validar y a controlar duplicados (si está repetida, responde 409).
   - Guarda el archivo con un nombre estándar en la carpeta de su categoría.
   - Agrega la fila en la pestaña que corresponde.

### Categoría e historial

`lib/invoice/completar.ts`. La categoría sale del CUIT del emisor: si es el de Mindlin (`config/empresa.json`), es una venta; si es el de un socio (la lista `socios` del mismo archivo), son honorarios; si no, una compra.

El equipo le compra casi siempre a los mismos proveedores, y la planilla ya dice cómo se anota cada uno. Por eso, si el CUIT ya tiene cargas:

- **Compras y honorarios:** razón social, rubro y "corresponde a" como en la última carga de ese CUIT. El concepto, solo si las dos últimas cargas lo repiten (un abono, por ejemplo); si no, el que propone la IA.
- **Ventas**, por CUIT del receptor: cliente, tipo de pago y depto. Por ejemplo, las ventas a JH 94 Constructora se anotan a nombre de Martín Miranda, por la unidad 1 A, como "Amortización".

La ficha avisa de qué fila tomó los datos.

## Planilla

`lib/sheets/`. Las columnas son las de la planilla Administración Contable, en el mismo orden (`columnas.ts`): A a Y en egresos y A a O en ingresos. La app no agrega columnas.

- Escribe en la primera fila vacía, como cuando se carga a mano, y le copia el formato de la fila de arriba.
- Deja vacías las columnas que completa el equipo: forma de pago, banco, retención, comprobante de retención y "Pago?". En "Monto a Transferir" escribe la misma fórmula que el equipo (`=T-U`).
- El link al PDF va como "Link", igual que los cargados a mano.
- Moneda como en la planilla ("Pesos", "Dólares"). Las notas de crédito van en negativo. Los importes en 0 quedan vacíos.
- Los importes van como los dice la factura, no con fórmulas: el equipo calcula el IVA con `=M*0,21`, y eso puede diferir en centavos de lo facturado.
- La planilla no tiene columnas para el IVA a otras alícuotas ni para otros tributos (ni, en ventas, para percepciones). Si una factura los tiene, quedan dentro del total y la ficha lo avisa.
- **Duplicados:** se buscan en lo que ya está cargado, también a mano, por CUIT del proveedor + tipo (factura, nota de crédito o de débito) + punto de venta + número. En ventas, sin el CUIT, porque el emisor siempre es Mindlin (`lib/sheets/registros.ts`).
- Si la pestaña está vacía (una planilla de prueba nueva), la app escribe los encabezados.
- El texto que viene de la factura y empieza con `=`, `+`, `-` o `@` se fuerza a texto, para que una factura no pueda meter una fórmula.
- La escritura está detrás de la interfaz `Planilla`: si el cliente usa Excel, se cambia la implementación.

## Archivos

`lib/storage/archivos.ts`. Los PDF se guardan en Drive a través de un script de Apps Script publicado en la cuenta dueña de las carpetas (ver `apps-script/README.md`), porque la cuenta de servicio no tiene espacio en un Drive de Gmail. Cada categoría va a su carpeta: compras, honorarios o ventas. El nombre estándar es `AAAA-MM-DD Razón social - Tipo N°.pdf`; en las ventas, con el cliente en lugar de la razón social.

## Cómo funciona la extracción

`extractInvoice(file)` manda el PDF (como bloque `document`) o la foto (como bloque `image`) a `claude-opus-5-5` y devuelve los datos del comprobante según el esquema zod de `lib/invoice/schema.ts`. Lee el emisor y el receptor por separado, así que sirve para compras y para ventas.

- **Salida estructurada** con `output_config.format`: la respuesta siempre es un JSON con ese esquema. El esquema se convierte con `lib/invoice/json-schema.ts` y no con el `zodOutputFormat` del SDK, porque ese helper pasa los `enum` a la descripción en vez de dejarlos como restricción.
- **Esfuerzo bajo** (`output_config.effort: "low"`).
- **Fallback del lado del servidor** (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`): si el modelo rechaza la factura, la API la reintenta con otro modelo. `ExtractionResult.fallback` indica si pasó.
- La IA marca en `campos_dudosos` lo que no pudo leer bien. `validateInvoice` suma a esa lista los campos que fallan algún control: eso es lo que la pantalla de revisión va a marcar en amarillo.

Convenciones de los importes (en `lib/invoice/prompt.ts`). Las de facturas C y notas de crédito coinciden con la planilla real; las demás, **a confirmar con el cliente**:

- Facturas B, C y tickets (no discriminan IVA): el importe va en `no_gravado`.
- Exento: va en `no_gravado`.
- IVA al 27%, 5% o 2,5%: va en `iva_otras`, que no es una columna de la planilla.
- Liquidaciones bancarias: "Liquidación A", como en la planilla.
- Percepciones de otras provincias e impuestos internos: van en `otros_tributos`, que tampoco es una columna de la planilla.
- Notas de crédito: importes en positivo. El signo se decide al escribir en la planilla.

Concepto, rubro y "corresponde a" siguen cómo carga el equipo (el prompt tiene ejemplos de la planilla):

- **Rubro:** la descripción fiscal del proveedor, de `config/rubros.json`: Materiales, Servicios de Terceros, Honorarios Profesionales o Monotributista. Es lo que usa la columna "Rubro / Descripción" y lo que dijo Tadeo en sus notas. La clasificación más fina que armó con GPT (62 proveedores) no está en la planilla, así que no se usa.
- **Corresponde a:** "Lerma 439" o "HQ" (`config/empresa.json`).
- Para un proveedor que ya está en la planilla, estos tres datos salen de su carga anterior (ver "Categoría e historial").

## Controles

- **CUIT** (`lib/validation/cuit.ts`): prefijo válido y dígito verificador (módulo 11), para el emisor y el receptor.
- **Receptor:** en una compra, el receptor tiene que ser Mindlin (CUIT 30-71881155-0).
- **Suma** (`lib/validation/sum.ts`): neto + no gravado + IVA + percepciones + otros tributos = total, con una tolerancia de $0,05.
- **QR de ARCA** (`lib/validation/qr.ts`): decodifica la URL `https://www.afip.gob.ar/fe/qr/?p=...` y compara CUIT, punto de venta, tipo, número, fecha, importe, moneda y CAE. Por ahora recibe el texto del QR: falta leerlo de la imagen o del PDF.

## Pendientes

En [docs/pendientes.md](docs/pendientes.md).
