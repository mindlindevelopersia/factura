# Lector de facturas

Iniciativa 1 de Mindlin Developers. Las facturas llegan **por Telegram** (al bot de facturas; su usuario aparece en la web, pestaña "Subir") o se suben **en la web**. La IA las lee, las clasifica en una de las tres carpetas del equipo (**compras**, **honorarios de administración**, que son las facturas que los socios le hacen a la sociedad, o **ventas**) y propone los datos como los carga el equipo. Quedan en una cola "Para revisar" en la web; una persona revisa y aprueba. Recién ahí la app agrega la fila en la planilla Administración Contable (compras y honorarios en "Facturación de Egresos (Compras)", ventas en "Facturación de Ingresos (Ventas)") y mueve el PDF a la carpeta de Drive de su categoría, en la subcarpeta del mes. No calcula retenciones (eso es la iniciativa 11).

**Configuración completada el 28/10/2026:** copia contable nativa, cola, carpetas, Apps Script v2 y variables de Production conectados. La app confirma todos los servicios y el bot activo. IDs y resultados en [el informe de configuración](docs/informe-configuracion-2026-10-28.md); vinculación personal de Telegram y prueba con las facturas del cliente en [puesta en marcha](docs/puesta-en-marcha.md).

## Estado

| Paso | Estado |
|---|---|
| Esqueleto Next.js + TypeScript | Hecho. |
| Extractor con IA (`lib/invoice/extract.ts`) | Hecho. Probado en producción con la API real de Claude y comprobantes sintéticos en imagen y PDF. Falta medir con facturas reales del cliente. |
| Controles de CUIT, suma y QR (`lib/validation/`) | Hecho. Falta leer el QR de la imagen o del PDF. |
| Script de evaluación (`scripts/eval/`) | Hecho y adaptado a la planilla real. Falta correrlo con octubre de 2026 (ver [pendientes](docs/pendientes.md)). |
| Tres categorías y columnas de la planilla real | Hecho (29/10/2026). Auditado contra octubre: ver [docs/auditoria-octubre.md](docs/auditoria-octubre.md). |
| Cola de pendientes, web (revisar, subir, historial) y bot de Telegram | Configurado y verificado el 28/10/2026: carpetas, script v2, copia contable, cola y variables. Cada usuario conecta su Telegram desde la web. |
| Login con Google y lista de mails | Hecho y desplegado en https://mindlin-developers.vercel.app |
| Pantalla de carga, revisión y aprobación | Hecho. Probado de punta a punta con la API real, Drive y la planilla de prueba. |
| Escritura en la planilla y control de duplicados | Hecho. Probado contra la planilla de prueba. |
| Subida de los PDF a Drive | Script publicado, autorizado y conectado a Vercel. Guardado de imagen y PDF verificado en la carpeta de prueba. |

Configuración actual de cada servicio: [docs/configuracion.md](docs/configuracion.md). Lo que falta: [docs/pendientes.md](docs/pendientes.md).

**Se continúa trabajando sobre una copia de prueba de Administración Contable y las carpetas de mindlindevelopers.ia@gmail.com**. El archivo original del cliente no se modifica. La verificación de servicios actual está en [el informe](docs/informe-configuracion-2026-10-28.md); las pruebas sintéticas del circuito anterior permanecen en [docs/verificacion.md](docs/verificacion.md).

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
| `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET` | Script que guarda y ordena los PDF en Drive (`apps-script/`, versión 2) | Siempre: la cola guarda cada archivo al llegar |
| `COLA_SHEET_ID` | Planilla aparte para la cola y las cuentas de Telegram conectadas. **No** la de Administración Contable. La app crea sus pestañas | Siempre |
| `COLA_TAB`, `COLA_TAB_TELEGRAM` | Nombres de esas pestañas. Por defecto, "Cola" y "Telegram" | Opcional |
| `TELEGRAM_API_KEY` | Token del bot de Telegram (de BotFather). También se acepta `TELEGRAM_BOT_TOKEN` | Telegram |

## Estilo

Tomado de mindlindevelopers.com. Los colores y estilos están como variables en `app/globals.css`:

- Lima de marca `#D2DA4D` (el color del logo) y negro `#1A1A1A`. Botones principales en lima con texto negro.
- Tipografía Sora (400 y 700), cargada con `next/font`.
- Botones en píldora (radio de 30 px) y tarjetas con radio de 16 px.
- Los campos dudosos van en amarillo (`--dudoso`), un tono distinto del lima para que no se confundan.
- Logos en `public/brand/` y el ícono de la pestaña en `app/icon.png`, copiados del sitio.

## Login

Auth.js (`next-auth` v5) con Google. Solo entran los mails de `ALLOWED_EMAILS`, y tienen que estar verificados por Google.

- `auth.ts`: configuración. La sesión dura 12 horas. Cada persona puede entrar desde todos los dispositivos y navegadores que quiera, a la vez: cada uno tiene su sesión.
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

## Cola, revisión y Telegram

Todo comprobante, llegue por donde llegue, pasa por la misma cola (`lib/cola/`):

1. **Llega.** Por la web (`POST /api/cola`, pestaña "Subir") o por Telegram (`POST /api/telegram-webhook`). Se guarda enseguida en la carpeta de pendientes de Drive, así no se pierde aunque falle algo después, y entra en la cola con estado "leyendo".
2. **Se lee.** La IA lo lee, la app lo clasifica y completa lo que sale de la carga anterior de la misma contraparte (ver abajo). Queda "pendiente", o "error" si no se pudo leer (se puede reintentar). Si llegó por Telegram, el bot le avisa a quien lo mandó con un resumen y el link para revisarlo.
3. **Se revisa** en la web, pestaña "Para revisar" (`components/FichaRevision.tsx`): el archivo al lado de los datos editables.
   - En amarillo, lo que la IA marcó como dudoso y lo que falla un control. Un campo dudoso deja de estar en amarillo cuando la persona pasa por él; los controles se recalculan mientras se edita.
   - La categoría se puede cambiar, y cambia los campos: compras y honorarios piden razón social, CUIT, rubro, rubro detallado y "corresponde a"; las ventas, cliente, tipo de pago y depto.
   - Si la factura ya está en la planilla (cargada a mano o por otra persona), lo dice con el número de fila.
4. **Se aprueba** (`POST /api/cola/<id>/aprobar`): se vuelve a controlar duplicados, el PDF se mueve a la carpeta de su categoría y a la subcarpeta del mes ("Facturas Compras Octubre 2026") con el nombre estándar, y se agrega la fila en la planilla. Si algo falla a mitad de camino, el comprobante sigue pendiente y se puede volver a aprobar sin duplicar nada. O **se descarta**: el archivo va a la papelera de Drive.
5. **Historial:** la pestaña "Historial" muestra lo aprobado (con su fila y el link al archivo) y lo descartado, con quién y cuándo.

La cola vive en una pestaña de la planilla `COLA_SHEET_ID`, una fila por comprobante, con la lectura completa en JSON y columnas legibles (contraparte, comprobante, total, estado). La web la vuelve a consultar cada 20 segundos, así aparece lo que llega por Telegram.

### Telegram

- **Activar el bot**, una sola vez: en la web, pestaña "Subir", botón "Activar bot". Le dice a Telegram que mande los mensajes a `/api/telegram-webhook` de la dirección desde la que se toca (tiene que ser la de producción).
- **Conectar a cada persona:** en la misma pestaña, "Conectar mi Telegram" abre el bot con un código firmado con `AUTH_SECRET` que vence a la hora; al tocar "Iniciar", esa cuenta de Telegram queda conectada al mail con el que entró a la web (pestaña "Telegram" de la planilla de la cola).
- **Varios teléfonos:** una misma cuenta de Telegram abierta en varios dispositivos (celular, compu) es una sola conexión. Si una persona usa dos cuentas de Telegram distintas, conecta cada una con "Conectar otro Telegram"; las dos quedan a su mail. La web lista las cuentas conectadas y deja desconectar cualquiera (por ejemplo, un teléfono perdido). Una cuenta de Telegram va a un solo mail: si se conecta con otro, pasa a ese.
- El bot solo atiende chats privados de cuentas conectadas a un mail que siga en `ALLOWED_EMAILS`. A las demás les contesta cómo conectarse y no guarda nada de lo que mandaron.
- Cada llamada de Telegram trae un secreto derivado del token (`secretoWebhook` en `lib/telegram/api.ts`): el webhook rechaza las que no lo traen. Es la única ruta fuera del login (`proxy.ts`).
- Acepta PDF, JPG, PNG y WEBP como documento, y fotos (toma la de mayor resolución). Hasta 20 MB, el límite de Telegram para bots (5 MB para imágenes como documento: es el límite de Claude). Si Telegram reintenta un mensaje, no se carga dos veces.
- Avisa cuando lee la factura (con un aviso si ya está cargada o si ya la habían mandado), si no la pudo leer, y cuando alguien la aprueba o la descarta en la web.
- **Comentarios:** el texto que acompaña a la foto o al PDF queda guardado con la factura y la IA lo usa de contexto (sirve para lo que el comprobante no dice, como a qué obra corresponde; nunca cambia datos impresos). Un texto o un audio mandado después se anota en la última factura de ese chat de la última media hora; si no hay ninguna, el bot pide mandar primero la factura. Los audios se guardan en Drive y se escuchan en la ficha; al aprobar, quedan en la misma carpeta que la factura ("... - comentario 1.ogg"). No se transcriben: Claude no lee audio.
- En la web, al subir, también se puede escribir un comentario.

### La misma factura más de una vez

- **El mismo archivo** (misma huella SHA-256) no entra dos veces en la cola, venga por donde venga: no se guarda ni se lee de nuevo, y se le dice a quien lo mandó dónde está ("llegó el 29/10, 14:32 y está para revisar", "ya está cargado en la fila 230"). Si el anterior se descartó, sí se puede volver a mandar.
- **El mismo comprobante en otro archivo** (una foto y después el PDF): se lee, pero la ficha avisa que ya lo habían mandado y el bot también. Se reconoce por proveedor, tipo, punto de venta, número y total.
- **Ya cargado en la planilla** (a mano o desde la app): la ficha lo dice con la fila y no se deja aprobar.

### Estado de la configuración

Si falta configurar algo, la web muestra qué (`lib/estado.ts`, `GET /api/estado`): la clave de Anthropic (la prueba contra la API), las planillas y sus pestañas (con los nombres que tiene la planilla, para copiarlos), la planilla de la cola, el script de Drive (versión y carpetas) y el bot. También se ve desde "Subir > Revisar la configuración".

### Categoría e historial

`lib/invoice/completar.ts`. La categoría sale del CUIT del emisor: si es el de Mindlin (`config/empresa.json`), es una venta; si es el de un socio (la lista `socios` del mismo archivo), son honorarios; si no, una compra. Los socios, confirmados por el cliente el 29/10/2026, son Matías Mindlin, Michelle Mindlin y Micaela Druck.

El equipo le compra casi siempre a los mismos proveedores, y la planilla ya dice cómo se anota cada uno. Por eso, si el CUIT ya tiene cargas:

- **Compras y honorarios:** razón social, rubro y "corresponde a" como en la última carga de ese CUIT. El concepto, solo si las tres últimas cargas lo repiten, no es de un período (una certificación o una cuota cambian cada vez) y el proveedor no es de materiales; si no, el que propone la IA. El rubro detallado sale de la clasificación de proveedores de las notas del cliente (`config/proveedores.json`).
- **Ventas**, por CUIT del receptor: cliente, tipo de pago y depto. Por ejemplo, las ventas a JH 94 Constructora se anotan a nombre de Martín Miranda, por la unidad 1 A, como "Amortización".

La ficha avisa de qué fila tomó los datos. Medido sobre las 218 filas de egresos de la planilla real, con lo cargado antes de cada una: rubro 97%, "corresponde a" 98%, razón social 96% y concepto 95% de aciertos ([auditoría](docs/auditoria-octubre.md)).

## Planilla

`lib/sheets/`. Las columnas son las de la planilla Administración Contable, en el mismo orden (`columnas.ts`): A a Y en egresos y A a O en ingresos. La app no agrega columnas.

- Escribe en la primera fila vacía, como cuando se carga a mano, y le copia el formato de la fila de arriba.
- Deja vacías las columnas que completa el equipo: forma de pago, banco, retención, comprobante de retención y "Pago?". En "Monto a Transferir" escribe la misma fórmula que el equipo (`=T-U`).
- El link al PDF va como "Link", igual que los cargados a mano.
- Moneda como en la planilla ("Pesos", "Dólares"). Las notas de crédito van en negativo. Los importes en 0 quedan vacíos.
- Los importes van como los dice la factura, no con fórmulas: el equipo calcula el IVA con `=M*0,21`, y eso puede diferir en centavos de lo facturado.
- La planilla no tiene columnas para el IVA a otras alícuotas ni para otros tributos (ni, en ventas, para percepciones). Si una factura los tiene, quedan dentro del total y la ficha lo avisa.
- **Duplicados:** se buscan en lo que ya está cargado, también a mano, por CUIT del proveedor + tipo (factura, nota de crédito o de débito) + punto de venta + número; en ventas, sin el CUIT, porque el emisor siempre es Mindlin. Si además coincide el total (±$1), es la misma factura y no se deja cargar. Si el número coincide pero el total no, se avisa y se deja: Banco Nación repite el número de liquidación de un mes a otro (`lib/sheets/registros.ts`).
- **Rubro detallado:** la planilla no tiene esa columna. Si el equipo agrega una columna titulada "Rubro detallado" después de la Y, la app la completa (`COLUMNAS_OPCIONALES` en `columnas.ts`).
- Si la pestaña está vacía (una planilla de prueba nueva), la app escribe los encabezados.
- El texto que viene de la factura y empieza con `=`, `+`, `-` o `@` se fuerza a texto, para que una factura no pueda meter una fórmula.
- La escritura está detrás de la interfaz `Planilla`: si el cliente usa Excel, se cambia la implementación.

## Archivos

`lib/storage/archivos.ts`. Los PDF se guardan en Drive a través de un script de Apps Script publicado en la cuenta dueña de las carpetas (ver `apps-script/README.md`), porque la cuenta de servicio no tiene espacio en un Drive de Gmail.

- Al llegar, van a la carpeta de pendientes, con el nombre original.
- Al aprobarlos, el mismo archivo se mueve a la carpeta de su categoría (compras, honorarios o ventas), dentro de la subcarpeta del mes de la factura ("Facturas Compras Octubre 2026", como las arma el equipo, con el año), y se renombra: `AAAA-MM-DD Razón social - Tipo N°.pdf`; en las ventas, con el cliente en lugar de la razón social. El script crea la subcarpeta si no existe.
- Al descartarlos, van a la papelera de Drive.
- El script solo toca archivos que estén en sus carpetas.

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
