# Informe de configuración con computer use

Fecha de verificación: 28/10/2026. App: https://mindlin-developers.vercel.app/.

Se aplicaron los pasos de configuración del archivo entregado por el responsable y se verificaron los cambios recientes de `main`, incluidas las mejoras de Telegram para varias cuentas y enlaces que vencen. La cuenta propietaria de los recursos nuevos es **mindlindevelopers.ia@gmail.com**. El Excel original del cliente no se modificó; la copia nativa quedó privada y compartida únicamente con la cuenta de servicio como Editor.

## 1. Carpetas

Raíz **Facturas Mindlin**: `1bNyxX168zdxE0qFzpkW4vQpyqqpHKJFD`.

| Carpeta | ID |
|---|---|
| Pendientes | `1kgGZQiyRNS3ld0oAslS1wguSCzBhfAtu` |
| Facturas de Compras | `1IYy_RL9Iym4kx1HxUNBTDaDaJcGAs9iT` |
| Facturas de Honorarios de Administración | `1_OZ9SKvRJxQyOYmusnScIZA1rp-lHHjk` |
| Facturas de Ventas | `1EqoTWlEiwpIdlR_Ay4-itMpb8WZm-BmZ` |

Se conservaron la carpeta de prueba anterior y sus archivos.

## 2. Apps Script

Proyecto `1gCnlM-tgv2n45WKKe4LEpq8jcI0TH7yakOJYd9Xkjj-3zP3wYuOHL2FJ`, **Guardar facturas Mindlin**, propiedad de Mindlin.

El código del archivo de instrucciones coincide exactamente con `apps-script/guardar-factura.gs`. Se publicó la **versión 2** editando la implementación activa. El diálogo de Google confirmó la versión nueva y la misma URL:

https://script.google.com/macros/s/AKfycbzsCnZuxRzSt-FqtdK8_ycfCDdjPBP_vNkB5GqLgrkwYbQyVZ-CIe3Q1MixdIMN5RMl/exec

Se agregaron `CARPETA_PENDIENTES`, `CARPETA_COMPRAS`, `CARPETA_HONORARIOS` y `CARPETA_VENTAS`. `SECRET` y `CARPETA_ID` se conservaron.

La ejecución de `probar` terminó correctamente y mostró:

- `CARPETA_PENDIENTES OK`
- `CARPETA_COMPRAS OK`
- `CARPETA_HONORARIOS OK`
- `CARPETA_VENTAS OK`
- `CARPETA_ID OK`

La función creó un archivo temporal por destino y lo envió a la papelera. No se eliminaron archivos existentes del cliente.

## 3. Copia contable

Se usó **Guardar como hoja de cálculo de Google** desde la sesión de Mindlin para convertir el archivo de referencia, sin editar el original.

- Nombre: **[PRUEBA] Administración Contable - copia para la app**.
- ID: `1xCCxb2TRpjal_yydlZV7DqRG04MpgWESXG__pYLx_54`.
- Tipo verificado por Drive: `application/vnd.google-apps.spreadsheet`.
- Propietaria verificada: `mindlindevelopers.ia@gmail.com`.
- Ubicación: Mi unidad de Mindlin.
- Se conservaron las 19 pestañas.

Los nombres exactos de las pestañas usadas por la app son **`Facturación de Egresos (Compras`** y **`Facturación de Ingresos (Ventas`**, sin paréntesis de cierre. IDs numéricos: `1206741754` y `136350166`, respectivamente. Se verificaron mediante metadatos de Google Sheets.

## 4. Cola

- Nombre: **Facturas Mindlin - cola de la app**.
- ID: `1beptTswzIVeBNLLUTV_9JY5CBdU5PNlfOzs4B50IfUg`.
- Creada vacía en Mi unidad de Mindlin, como Google Sheets nativo. La app crea sus pestañas internas.

## 5. Permisos

El responsable confirmó expresamente los permisos de las dos planillas, la publicación v2 y la recepción del bot. Se compartieron ambas planillas con **facturas-app@mindlin-developers.iam.gserviceaccount.com** como **Editor**, con las notificaciones desmarcadas.

La lectura posterior de Drive confirmó en ambas la propietaria Mindlin y el permiso `writer` de la cuenta de servicio; no aparece permiso público.

## 6. Vercel

Se configuraron en **Production**:

| Variable | Valor no secreto |
|---|---|
| `SHEET_ID` | `1xCCxb2TRpjal_yydlZV7DqRG04MpgWESXG__pYLx_54` |
| `SHEET_TAB_EGRESOS` | `Facturación de Egresos (Compras` |
| `SHEET_TAB_INGRESOS` | `Facturación de Ingresos (Ventas` |
| `COLA_SHEET_ID` | `1beptTswzIVeBNLLUTV_9JY5CBdU5PNlfOzs4B50IfUg` |

Preview y Development conservaron su `SHEET_ID` anterior. Se separó la asignación de Production para aplicar allí el nuevo ID; no se borraron variables ni se cambiaron los secretos.

Se verificó por nombre y entorno, sin revelar sus valores, que Production tiene `ANTHROPIC_API_KEY`, `TELEGRAM_API_KEY`, `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `AUTH_SECRET` y `ALLOWED_EMAILS`.

Se creó el redeploy **D43vzdMfzsMm9wXB4GZhEQhxHPi1** desde `946c4cb`. El estado de GitHub para ese despliegue confirmó **Vercel: success — Deployment has completed**. Después, los cambios de Telegram de `941e13a` también quedaron desplegados: **9xcbo1h78ZWWV7TxMWiDHQrwsrYo**, con la misma confirmación de Vercel. La configuración fue verificada desde el dominio principal.

## 7. Estado de la app

Al comenzar faltaban ventas, la cola, Apps Script v2 y la activación del bot. IA y la lectura de la planilla anterior ya funcionaban. Después de los cambios, **Revisar la configuración** informó **Todo lo necesario está configurado**:

| Componente | Estado | Texto devuelto |
|---|---|---|
| IA (Anthropic) | ✓ | La clave funciona y tiene acceso a claude-opus-5-5. |
| Planilla Administración Contable | ✓ | La cuenta de servicio la puede leer. |
| Pestaña de compras y honorarios | ✓ | "Facturación de Egresos (Compras". |
| Pestaña de ventas | ✓ | "Facturación de Ingresos (Ventas". |
| Planilla de la cola | ✓ | La cuenta de servicio la puede usar. |
| Drive (script de Apps Script) | ✓ | Versión 2, con las cuatro carpetas configuradas. |
| Bot de Telegram | ✓ | @mindlindevelopers_facturas_bot, activo: los mensajes llegan a esta app. |

El nombre real se obtiene de Telegram con `getMe`: **@mindlindevelopers_facturas_bot**, en plural. Al retomar el trabajo, el webhook ya estaba activo; se verificó ese estado sin modificarlo de nuevo. El nombre singular del archivo original de instrucciones quedó desactualizado.

Cada persona debe usar **Subir → Conectar mi Telegram → Iniciar** en su teléfono. No se enviaron mensajes desde cuentas personales ni se copiaron enlaces privados de vinculación en este informe.

## Validación y alcance

- Código actualizado `941e13a`: **110 tests en 11 archivos pasan**, y `npm run typecheck` pasa.
- La primera ejecución local de TypeScript encontró tipos generados de rutas eliminadas de la versión anterior; `next typegen` los regeneró y la revisión posterior pasó. No se cambió código para resolverlo.
- Los chequeos de configuración, permisos y publicación confirman la conexión de los servicios. No equivalen a medir precisión con las facturas reales de octubre ni a una prueba funcional de recepción, aprobación y archivado desde un Telegram personal.
- La vinculación personal, la evaluación de octubre y la prueba funcional contra la copia siguen como pasos separados en `puesta-en-marcha.md` y `pendientes.md`.
- No se solicitó tarjeta ni activar facturación de Google durante esta configuración. Anthropic mantiene su clave existente.
