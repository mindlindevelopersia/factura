# Pendientes

La configuración actual de cada servicio está en [configuracion.md](configuracion.md).

## Decisiones

### Dónde se guardan los PDF

La cuenta de servicio no puede subir archivos a un Drive de Gmail ("Service Accounts do not have storage quota"), y Mindlin no tiene Google Workspace (su mail está en Zoho). Por eso la app guarda los archivos con un **script de Apps Script** publicado en la cuenta dueña de la carpeta. El código ya está hecho y probado con un script simulado: [`apps-script/`](../apps-script/README.md).

- [ ] **Decidir de qué cuenta es el Drive.** Lo lógico es una cuenta del cliente (por ejemplo matimindlin111@gmail.com) y no axellaban@gmail.com, para que las facturas sigan siendo de Mindlin cuando termine el proyecto. Si se arranca con axellaban@gmail.com, después hay que mover la carpeta y publicar el script en la otra cuenta.
- [ ] **Publicar el script** con el prompt de computer use de [`apps-script/README.md`](../apps-script/README.md) y cargar `APPS_SCRIPT_URL` y `APPS_SCRIPT_SECRET` en Vercel. Hasta entonces, las facturas se cargan en la planilla con el link vacío.
- [ ] Pasarle la URL del script al desarrollador para verificar que responde.

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

- [ ] Cargar `ANTHROPIC_API_KEY` en Vercel (Production) cuando se defina de quién es la clave.
- [ ] Confirmar que el secreto viejo del cliente OAuth "Facturas Mindlin" esté deshabilitado. Tiene que quedar activo solo el nuevo.
- [ ] Corregir `GOOGLE_PRIVATE_KEY` en Preview y Development, o borrarla de esos entornos.
- [ ] Mover los JSON de las claves (`mindlin-developers-3278eda011de.json` y `mindlin-developers-efd7e536b36d.json`) de Descargas a una carpeta segura.
- [ ] Opcional: rotar la clave `3278eda011de`. Apareció en la conversación de computer use.
- [ ] **Antes de usar la planilla real:** borrar la clave `efd7e536…` de la cuenta de servicio (Google Cloud > Cuentas de servicio > facturas-app > Claves).
- [ ] **Al pasar a la planilla real:** compartirla con la cuenta de servicio como Editor y cambiar `SHEET_ID` y `SHEET_TAB` en Vercel.
- [ ] Cada persona nueva: agregar su mail en `ALLOWED_EMAILS` (Vercel, y después redeploy) y como usuario de prueba en la pantalla de consentimiento de OAuth.

## Desarrollo

- [ ] **Probar con facturas reales en producción** apenas esté `ANTHROPIC_API_KEY`. Hasta ahora la pantalla se probó de punta a punta con la IA simulada; la extracción real todavía no corrió nunca.
- [ ] Correr la evaluación (`npm run eval`) con el mes de muestra del cliente y ajustar el prompt y los rubros según los resultados.
- [ ] Leer el QR de ARCA de fotos y PDF. El validador ya existe, pero recibe el texto del QR.
- [ ] Reglas de rubro por proveedor, si la evaluación muestra que hacen falta.
- [ ] Controlar que el CUIT receptor sea el de Mindlin (falta saber sus CUIT).
- [ ] Si dos personas aprueban la misma factura en el mismo segundo, las dos pueden pasar el control de duplicados. Con el volumen esperado es muy improbable; si pasa, se borra una fila a mano.
- [ ] Las facturas en revisión viven solo en la pestaña del navegador: si se cierra antes de aprobar, hay que volver a cargarlas (y se vuelve a pagar la lectura).
