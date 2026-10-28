# Pendientes

La configuración actual de cada servicio está en [configuracion.md](configuracion.md).

**Actualización del 29/10/2026:** llegaron los datos del cliente (ver abajo, "Datos de octubre"). La app ya está adaptada a su planilla y a sus tres carpetas, tiene la cola de pendientes, la web para revisar y subir y el bot de Telegram, y está en `main`. Falta la [puesta en marcha](puesta-en-marcha.md) y medir la lectura de la IA con octubre.

**Actualización del 28/10/2026:** el entorno de prueba ya tiene Anthropic, Drive y Sheets conectados. La prueba con la API real está registrada en [verificacion.md](verificacion.md). Se continúa con la planilla de prueba porque la real del cliente todavía no está disponible.

## Plan de trabajo (18 h)

| Paso | Hs | Estado |
|---|---|---|
| Repo, Next.js, login y deploy en Vercel | 2 | ✅ Hecho y desplegado |
| Extractor con IA y controles de CUIT, suma y QR | 4 | ✅ Hecho. Falta leer el QR de la imagen y probar con facturas reales |
| Script de evaluación contra el mes de muestra | 2 | ✅ Hecho y adaptado a la planilla real. Falta correrlo con octubre |
| Pantalla de carga, revisión y aprobación | 4 | ✅ Hecho |
| Escritura en la planilla, subida a Drive y control de duplicados | 3 | ✅ Hecho. Script publicado e integración real probada con comprobantes sintéticos |
| Ajustes después de medir y entrega | 3 | 🔄 En curso: categorías, columnas reales e historial por proveedor hechos; falta medir |

**Para que el cliente lo pueda usar** faltan, en este orden:

1. Hacer la [puesta en marcha](puesta-en-marcha.md) y la prueba de punta a punta contra la copia de la planilla.
2. Correr la evaluación de la IA con octubre y ajustar el prompt según lo que salga.
3. Pasar a la planilla real.

## Datos de octubre (29/10/2026)

El cliente pasó una carpeta de Drive con la "Copia para IA de Administración Contable" (la planilla con las 19 pestañas), las facturas de octubre ordenadas en "Facturas Compras Octubre" (8) y "Facturas Ventas Octubre" (1), y un documento de notas de Tadeo, que hoy hace la carga a mano. Lo que sale de ahí:

- **Volumen:** 20 a 25 facturas por mes, siempre en PDF, por mail o WhatsApp. Cargar una hasta emitir el pago lleva unos 20 minutos.
- **Planilla:** Google Sheets. Las pestañas que importan son "Facturación de Egresos (Compras)" (A a Y) y "Facturación de Ingresos (Ventas)" (A a O). La app ya escribe con esas columnas, en ese orden.
- **Tres carpetas:** compras, honorarios de administración (las facturas que los socios le hacen a la sociedad) y ventas. Los honorarios se anotan en egresos, como una compra.
- **Rubro:** la columna "Rubro / Descripción" usa la descripción fiscal (Materiales, Servicios de Terceros, Honorarios Profesionales, Monotributista). La clasificación de 62 proveedores que armó GPT no está en la planilla: la app la usa como "rubro detallado" (ver abajo).
- **Corresponde a:** "Lerma 439" o "HQ".
- **CUIT de Mindlin:** 30-71881155-0, sacado de las facturas.
- **Casi todos los proveedores se repiten:** de las 17 filas de octubre, 16 son de proveedores que ya estaban cargados. Por eso la app toma rubro, "corresponde a" y razón social de la carga anterior.
- **La planilla tiene errores de carga.** En ventas, la fila 7 (factura 00002-00000006) tiene un importe de $15.169.108,89 y la factura dice $15.169.108,98; el total da $16.761.865,32 en lugar de $16.761.865,42. Hay otros: "Facura B", la fecha 03/08/2062 en la fila 164, una factura de Lerer Florencia (monotributista, el resto de sus facturas son C) anotada como "Factura A". La evaluación los va a marcar como diferencias: hay que mirar `diferencias.csv` antes de culpar a la IA.
- **El IVA de la planilla es una fórmula** (`=M*0,21`), así que puede diferir en centavos de la factura. La app escribe lo que dice la factura.
- **Retenciones:** se calculan en otra planilla (iniciativa 11).
- **Entrada por Telegram:** el cliente quiere mandar las facturas por Telegram más adelante. Se configura después.

## Puesta en marcha de la cola, la web y Telegram

Ver [puesta-en-marcha.md](puesta-en-marcha.md): carpetas, script de Apps Script en versión 2, planilla de prueba con la estructura real, planilla de la cola, variables en Vercel y prueba de punta a punta. Hasta hacerla, la app desplegada no puede recibir comprobantes.

## Resueltas el 29/10/2026

- [x] **Qué hoja replicar:** "Facturación de Egresos (Compras)" y "Facturación de Ingresos (Ventas)". Son las únicas que tienen las facturas de octubre, aparte de "Pagos por Inversor" (ver abajo). Detalle en [auditoria-octubre.md](auditoria-octubre.md).
- [x] **Socios:** Matías Mindlin (20-39801632-8), Michelle Mindlin (24-36498888-1) y Micaela Druck (27-37423564-3), confirmados por el cliente. Sus facturas son honorarios de administración: van a la carpeta de honorarios y a la pestaña de egresos, como antes. Están en `config/empresa.json`.
- [x] **Subcarpetas por mes:** dentro de la carpeta de cada categoría, por la fecha de la factura: "Facturas Compras Octubre 2026". El script las crea.
- [x] **Clasificación de proveedores del documento (GPT):** está en `config/proveedores.json` (los 62). La app la propone como "rubro detallado" en la ficha y la IA la usa para los proveedores nuevos. La columna "Rubro / Descripción" sigue con la descripción fiscal, que es lo que usa la planilla. Si quieren el rubro detallado en la planilla, alcanza con agregar una columna "Rubro detallado" después de la Y: la app la completa sola.
- [x] **Telegram:** el bot de facturas, con el token en Vercel como `TELEGRAM_API_KEY`. Cada persona se conecta desde la web con su mail.

## Preguntas para el cliente

- [ ] **"Pago?":** la app la deja vacía. ¿Conviene que ponga "No"?
- [ ] **"Nota de Crédito":** el equipo la escribe sin letra; la app escribe "Nota de Crédito A". ¿Está bien?
- [ ] **Error en ventas:** la fila 7 (factura 00002-00000006) dice $15.169.108,89 y la factura dice $15.169.108,98 (total $16.761.865,32 en lugar de $16.761.865,42). En "Pagos por Inversor" está bien. Avisarle a Tadeo.
- [ ] **"Pagos por Inversor":** cada venta a Martín Miranda (las certificaciones del canje de la unidad 1A) también se anota en su estado de cuenta, con el tipo de cambio del día y el equivalente en dólares. ¿Quieren que la app lo haga al aprobar una venta? Hace falta saber de dónde sale el tipo de cambio.
- [ ] **El pago:** cuando se transfiere, el equipo anota el egreso en "Caja Flujos en Pesos" por el monto a transferir. Es el paso siguiente a la carga (y depende de las retenciones, iniciativa 11).

## Decisiones

### Dónde se guardan los PDF

La cuenta de servicio no puede subir archivos a un Drive de Gmail ("Service Accounts do not have storage quota"), y Mindlin no tiene Google Workspace (su mail está en Zoho). Por eso la app guarda los archivos con un **script de Apps Script** publicado en la cuenta dueña de la carpeta. El script real ya está publicado y probado desde la app: [`apps-script/`](../apps-script/README.md).

- [x] **Definir la cuenta propietaria para la entrega al cliente.** El responsable eligió mindlindevelopers.ia@gmail.com. Se crearon allí la carpeta, una copia de la planilla de prueba y el script, publicado para ejecutarse como esa cuenta. Ver [configuracion.md](configuracion.md).
- [x] **Publicar el script** y cargar `APPS_SCRIPT_URL` y `APPS_SCRIPT_SECRET` en Production de Vercel. Hecho el 28/10/2026; redeploy finalizado y enlaces a Drive verificados en la planilla.
- [x] Verificar la URL publicada: con secreto incorrecto rechaza la llamada; desde la app guarda los archivos correctamente. Se repitió la prueba después de migrar a Mindlin y se archivó la implementación anterior de Axel.

Alternativas descartadas por ahora: OAuth con una cuenta de Gmail (hay que publicar la app de OAuth, y el token vence si cambia la contraseña) o contratar Google Workspace para Mindlin (tiene costo mensual por usuario).

### Otras decisiones con el cliente

- [x] **Planilla:** Google Sheets, "Administración Contable". La app escribe sus columnas, en su orden.
- [ ] **Clave de la API de Claude:** a nombre del cliente (lo ideal) o la del consultor durante el desarrollo.
- [ ] **Convenciones de importes** (en `lib/invoice/prompt.ts`):
  - B, C y tickets: el importe va en "no gravado".
  - Exento: va en "no gravado".
  - IVA a otras alícuotas y otros tributos: la planilla no tiene columnas para eso; quedan dentro del total y la ficha avisa.
  - Notas de crédito: se escriben en negativo en la planilla.
- [x] **Lista de rubros:** la descripción fiscal de la planilla, en `config/rubros.json`. El rubro habitual de cada proveedor sale de la planilla misma.
- [x] **Datos para la evaluación:** octubre de 2026 (ver arriba). Trae facturas A y C, una nota de crédito y una venta; no trae USD, percepciones ni escaneos.

## Configuración (manual)

- [x] Cargar `ANTHROPIC_API_KEY` en Vercel (Production). Cargada por el responsable y verificada con llamadas reales desde la app.
- [x] Confirmar que el secreto viejo del cliente OAuth "Facturas Mindlin" esté deshabilitado. Verificado: el anterior está inhabilitado y el nuevo habilitado.
- [x] Corregir `GOOGLE_PRIVATE_KEY` en Preview y Development. Formato corregido con la clave principal.
- [x] Mover los JSON de las claves de Descargas a una carpeta de credenciales fuera del repositorio y restringir sus permisos locales.
- [ ] Opcional: rotar la clave `3278eda011de`. Apareció en la conversación de computer use.
- [x] Borrar la clave secundaria `efd7e536…` de la cuenta de servicio. Google confirmó su eliminación el 28/10/2026. La clave principal de Vercel permanece activa.
- [ ] **Al pasar a la planilla real:** compartirla con la cuenta de servicio como Editor y cambiar `SHEET_ID`, `SHEET_TAB_EGRESOS` y `SHEET_TAB_INGRESOS` en Vercel.
- [ ] Cada persona nueva: agregar su mail en `ALLOWED_EMAILS` (Vercel, y después redeploy) y como usuario de prueba en la pantalla de consentimiento de OAuth. Para mandar por Telegram, que toque "Conectar mi Telegram" en la web.

## Desarrollo

- [x] Probar el circuito completo en Production con la API real y comprobantes sintéticos: imagen en ARS, PDF de nota de crédito en USD y rechazo de duplicados. Ver [verificacion.md](verificacion.md).
- [ ] **Correr la evaluación con octubre** (`scripts/eval/README.md`, "Octubre de 2026") y ajustar el prompt según los resultados. Necesita `ANTHROPIC_API_KEY` donde se corra.
- [ ] Leer el QR de ARCA de fotos y PDF. El validador ya existe, pero recibe el texto del QR.
- [x] Reglas de rubro por proveedor: salen de la carga anterior del mismo CUIT (`lib/invoice/completar.ts`).
- [x] Controlar que el CUIT receptor de una compra sea el de Mindlin.
- [x] Formato de las filas nuevas: la app copia el formato de la fila de arriba y pone las fechas en dd/mm/aaaa.
- [x] Entrada por Telegram.
- [ ] Si dos personas aprueban la misma factura en el mismo segundo, las dos pueden pasar el control de duplicados. Con el volumen esperado es muy improbable; si pasa, se borra una fila a mano.
- [x] Las facturas en revisión ya no viven en la pestaña del navegador: quedan en la cola hasta que alguien las aprueba o descarta.
