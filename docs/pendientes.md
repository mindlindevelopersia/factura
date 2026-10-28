# Pendientes

La configuración actual de cada servicio está en [configuracion.md](configuracion.md).

**Actualización del 28/10/2026:** el entorno de prueba ya tiene Anthropic, Drive y Sheets conectados. La prueba con la API real está registrada en [verificacion.md](verificacion.md). Se continúa con la planilla de prueba porque la real del cliente todavía no está disponible.

## Plan de trabajo (18 h)

| Paso | Hs | Estado |
|---|---|---|
| Repo, Next.js, login y deploy en Vercel | 2 | ✅ Hecho y desplegado |
| Extractor con IA y controles de CUIT, suma y QR | 4 | ✅ Hecho. Falta leer el QR de la imagen y probar con facturas reales |
| Script de evaluación contra el mes de muestra | 2 | ✅ Hecho. Falta correrlo: esperamos los datos del cliente |
| Pantalla de carga, revisión y aprobación | 4 | ✅ Hecho |
| Escritura en la planilla, subida a Drive y control de duplicados | 3 | ✅ Hecho. Script publicado e integración real probada con comprobantes sintéticos |
| Ajustes después de medir y entrega | 3 | ⏳ Pendiente: depende de la evaluación |

**Para que el cliente lo pueda usar** faltan, en este orden:

1. Probar con facturas reales del cliente y confirmar las convenciones de importes.
2. Validar la estructura de su planilla. La cuenta propietaria elegida es mindlindevelopers.ia@gmail.com.
3. Pasar a la planilla real cuando esté disponible y hayan pasado esas pruebas.

La clave de Anthropic ya está cargada en Production y el script de Apps Script está publicado, autorizado y conectado a Vercel. El responsable indicó seguir trabajando con la planilla de prueba.

El resto de esta lista mejora la precisión o es limpieza.

## Decisiones

### Dónde se guardan los PDF

La cuenta de servicio no puede subir archivos a un Drive de Gmail ("Service Accounts do not have storage quota"), y Mindlin no tiene Google Workspace (su mail está en Zoho). Por eso la app guarda los archivos con un **script de Apps Script** publicado en la cuenta dueña de la carpeta. El script real ya está publicado y probado desde la app: [`apps-script/`](../apps-script/README.md).

- [x] **Definir la cuenta propietaria para la entrega al cliente.** El responsable eligió mindlindevelopers.ia@gmail.com. Se crearon allí la carpeta, una copia de la planilla de prueba y el script, publicado para ejecutarse como esa cuenta. Ver [configuracion.md](configuracion.md).
- [x] **Publicar el script** y cargar `APPS_SCRIPT_URL` y `APPS_SCRIPT_SECRET` en Production de Vercel. Hecho el 28/10/2026; redeploy finalizado y enlaces a Drive verificados en la planilla.
- [x] Verificar la URL publicada: con secreto incorrecto rechaza la llamada; desde la app guarda los archivos correctamente. Se repitió la prueba después de migrar a Mindlin y se archivó la implementación anterior de Axel.

Alternativas descartadas por ahora: OAuth con una cuenta de Gmail (hay que publicar la app de OAuth, y el token vence si cambia la contraseña) o contratar Google Workspace para Mindlin (tiene costo mensual por usuario).

### Otras decisiones con el cliente

- [ ] **Planilla:** si usan Google Sheets o Excel, y la estructura exacta de las columnas. Hoy la app escribe las columnas de la ficha P02 en el orden de `lib/sheets/columnas.ts`.
- [ ] **Clave de la API de Claude:** a nombre del cliente (lo ideal) o la del consultor durante el desarrollo.
- [ ] **Convenciones de importes** (en `lib/invoice/prompt.ts`):
  - B, C y tickets: el importe va en "no gravado".
  - Exento: va en "no gravado".
  - IVA a otras alícuotas y otros tributos: van en columnas extra.
  - Notas de crédito: se escriben en negativo en la planilla.
- [ ] **Lista de rubros** para `config/rubros.json`, y si existe, la lista de proveedores con su rubro habitual.
- [ ] **Datos para la evaluación:** un mes de facturas y la planilla de ese mes ya cargada, con casos raros (notas de crédito, USD, percepciones, B y C, escaneos malos).

## Configuración (manual)

- [x] Cargar `ANTHROPIC_API_KEY` en Vercel (Production). Cargada por el responsable y verificada con llamadas reales desde la app.
- [x] Confirmar que el secreto viejo del cliente OAuth "Facturas Mindlin" esté deshabilitado. Verificado: el anterior está inhabilitado y el nuevo habilitado.
- [x] Corregir `GOOGLE_PRIVATE_KEY` en Preview y Development. Formato corregido con la clave principal.
- [x] Mover los JSON de las claves de Descargas a una carpeta de credenciales fuera del repositorio y restringir sus permisos locales.
- [ ] Opcional: rotar la clave `3278eda011de`. Apareció en la conversación de computer use.
- [x] Borrar la clave secundaria `efd7e536…` de la cuenta de servicio. Google confirmó su eliminación el 28/10/2026. La clave principal de Vercel permanece activa.
- [ ] **Al pasar a la planilla real:** compartirla con la cuenta de servicio como Editor y cambiar `SHEET_ID` y `SHEET_TAB` en Vercel.
- [ ] Cada persona nueva: agregar su mail en `ALLOWED_EMAILS` (Vercel, y después redeploy) y como usuario de prueba en la pantalla de consentimiento de OAuth.

## Desarrollo

- [x] Probar el circuito completo en Production con la API real y comprobantes sintéticos: imagen en ARS, PDF de nota de crédito en USD y rechazo de duplicados. Ver [verificacion.md](verificacion.md).
- [ ] **Probar con facturas reales del cliente.** La integración ya funciona, pero la precisión del extractor todavía no se midió con la muestra del cliente.
- [ ] Correr la evaluación (`npm run eval`) con el mes de muestra del cliente y ajustar el prompt y los rubros según los resultados.
- [ ] Leer el QR de ARCA de fotos y PDF. El validador ya existe, pero recibe el texto del QR.
- [ ] Reglas de rubro por proveedor, si la evaluación muestra que hacen falta.
- [ ] Controlar que el CUIT receptor sea el de Mindlin (falta saber sus CUIT).
- [ ] Aplicar automáticamente formato de fecha a las filas nuevas de Sheets: `INSERT_ROWS` puede insertar celdas sin formato. En las dos filas de la prueba se corrigió la presentación de `A2:B3`; los valores se conservan como fechas numéricas.
- [ ] Si dos personas aprueban la misma factura en el mismo segundo, las dos pueden pasar el control de duplicados. Con el volumen esperado es muy improbable; si pasa, se borra una fila a mano.
- [ ] Las facturas en revisión viven solo en la pestaña del navegador: si se cierra antes de aprobar, hay que volver a cargarlas (y se vuelve a pagar la lectura).
