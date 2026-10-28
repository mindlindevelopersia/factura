# Configuración actual

Estado de los servicios verificado el 28/10/2026. La configuración de la cola, Apps Script v2 y las dos pestañas contables ya está aplicada en Production; el bot fue verificado activo. Detalle: [informe de configuración](informe-configuracion-2026-10-28.md). Acá no hay valores secretos: los secretos de la app están en Vercel y el del script también en sus propiedades privadas.

Se trabaja sobre una **copia de prueba de Administración Contable**, convertida del archivo Excel de referencia del cliente. El original no se modifica. Los recursos activos pertenecen a mindlindevelopers.ia@gmail.com.

## Producción

- **App:** https://mindlin-developers.vercel.app. `factura-three-blue.vercel.app` redirige a ese dominio.
- **Repo:** `mindlindevelopersia/factura`. Vercel despliega desde `main`.
- **Login:** probado en producción con axellaban@gmail.com. Entra, muestra el mail y "Salir" funciona.
- **Integración:** API real de Claude, revisión, aprobación, Drive y Sheets probados con comprobantes sintéticos. Ver [verificacion.md](verificacion.md).
- **Despliegue de configuración:** `D43vzdMfzsMm9wXB4GZhEQhxHPi1`, desde `main` (`946c4cb`); Vercel confirmó su finalización en el estado del commit de GitHub. Después se verificó el código actualizado `941e13a`: 110 tests y TypeScript pasan; su despliegue `9xcbo1h78ZWWV7TxMWiDHQrwsrYo` también figura completado. La app confirma que todas las integraciones están configuradas.

## Google Cloud

Proyecto `mindlin-developers`, en la cuenta **axellaban@gmail.com** (Gmail, no Workspace).

- **APIs habilitadas:** Google Sheets API y Google Drive API.
- **Pantalla de consentimiento:** tipo Externo, app "Facturas Mindlin". Está en modo **Prueba**: solo pueden entrar los usuarios de prueba. No hace falta publicarla mientras la app use solo email y perfil.
- **Usuarios de prueba:** axellaban@gmail.com y matimindlin111@gmail.com. Tienen que coincidir con `ALLOWED_EMAILS`: cada mail nuevo va en los dos lados.
- **Cliente OAuth "Facturas Mindlin":**
  - ID: `40553044262-2ebssljpfk2kmofjr52gj5do87hebkdq.apps.googleusercontent.com`
  - URI de redirección: `https://mindlin-developers.vercel.app/api/auth/callback/google` y `http://localhost:3000/api/auth/callback/google`.
  - Secreto anterior: inhabilitado. El secreto nuevo permanece habilitado.
- **Cuenta de servicio:** `facturas-app@mindlin-developers.iam.gserviceaccount.com`, sin roles en el proyecto. Solo accede a lo que se comparte con ella.
  - Clave `3278eda011de…`: la que usa Vercel.
  - Clave `efd7e536…`: **borrada el 28/10/2026**, con autorización del responsable del proyecto. Google confirmó la eliminación. Vercel conserva la clave principal `3278eda011de…`.
  - Los JSON locales se retiraron de Descargas y se guardaron fuera del repositorio, en una carpeta de credenciales con permisos restringidos.

## Drive (cuenta mindlindevelopers.ia@gmail.com)

- **Copia contable activa:** "[PRUEBA] Administración Contable - copia para la app", ID `1xCCxb2TRpjal_yydlZV7DqRG04MpgWESXG__pYLx_54`. Es Google Sheets nativo, conserva las 19 pestañas del archivo de referencia y pertenece a Mindlin. La cuenta de servicio tiene permiso de Editor; el acceso general es restringido.
- **Pestaña de compras y honorarios:** `Facturación de Egresos (Compras`, ID numérico `1206741754`.
- **Pestaña de ventas:** `Facturación de Ingresos (Ventas`, ID numérico `136350166`.
- Los dos nombres anteriores **no llevan paréntesis de cierre**. Se verificaron con los metadatos de Google Sheets y se cargaron exactamente así en Vercel.
- **Cola:** "Facturas Mindlin - cola de la app", ID `1beptTswzIVeBNLLUTV_9JY5CBdU5PNlfOzs4B50IfUg`. Se creó vacía en Mi unidad de Mindlin y se compartió con la cuenta de servicio como Editor, sin notificaciones. La app crea sus pestañas internas.
- **Carpeta raíz:** "Facturas Mindlin", ID `1bNyxX168zdxE0qFzpkW4vQpyqqpHKJFD`.

| Carpeta | Propiedad de Apps Script | ID |
|---|---|---|
| Pendientes | `CARPETA_PENDIENTES` | `1kgGZQiyRNS3ld0oAslS1wguSCzBhfAtu` |
| Facturas de Compras | `CARPETA_COMPRAS` | `1IYy_RL9Iym4kx1HxUNBTDaDaJcGAs9iT` |
| Facturas de Honorarios de Administración | `CARPETA_HONORARIOS` | `1_OZ9SKvRJxQyOYmusnScIZA1rp-lHHjk` |
| Facturas de Ventas | `CARPETA_VENTAS` | `1EqoTWlEiwpIdlR_Ay4-itMpb8WZm-BmZ` |

El script **Guardar facturas Mindlin** está publicado para ejecutar como **Yo (mindlindevelopers.ia@gmail.com)**. Se pegó el código v2 del repositorio, idéntico al entregado en el archivo de instrucciones. La función `probar` terminó sin errores y registró OK en las cuatro carpetas nuevas y en la carpeta por defecto. Los archivos temporales creados por esa función fueron enviados a la papelera por la propia prueba.

- Proyecto: `1gCnlM-tgv2n45WKKe4LEpq8jcI0TH7yakOJYd9Xkjj-3zP3wYuOHL2FJ`.
- Implementación: **versión 2 del 28/10/2026**. Se editó la implementación activa; no se creó otra.
- URL conservada: `https://script.google.com/macros/s/AKfycbzsCnZuxRzSt-FqtdK8_ycfCDdjPBP_vNkB5GqLgrkwYbQyVZ-CIe3Q1MixdIMN5RMl/exec`.
- `SECRET`, `APPS_SCRIPT_SECRET`, `APPS_SCRIPT_URL` y la propiedad anterior `CARPETA_ID` se conservaron.
- `CARPETA_ID` sigue apuntando a "Facturas Mindlin (prueba)": `1ZzZT4P8YVvQkV4lF1Cu9UC7yMLPvzIaP`. La carpeta y la planilla anteriores `1ICwVOWj1Bz5htd5j06gnhdpVlnW1Rv-_NYEAEaLM1vA` permanecen como respaldo.
- La autorización de Drive existente se conserva. Los permisos de Editor sobre las dos planillas, la publicación de v2 y la recepción del bot fueron confirmados expresamente por el responsable.
- No se solicitó tarjeta ni activar facturación de Google durante esta configuración. Anthropic conserva la clave existente.

El script y los archivos de las pruebas anteriores de Axel se conservan como respaldo; su implementación web sigue archivada. El proyecto de Google Cloud y el cliente OAuth continúan siendo los existentes, descritos arriba.

Mindlin no tiene Google Workspace: el mail de mindlindevelopers.com está en Zoho. Por eso no hay unidad compartida.

## Variables en Vercel

| Variable | Production | Preview y Development |
|---|---|---|
| `AUTH_SECRET` | ✅ | ❌ |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | ✅ | ✅ |
| `ALLOWED_EMAILS` (`axellaban@gmail.com,matimindlin111@gmail.com`) | ✅ | ❌ |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ✅ | ✅ |
| `GOOGLE_PRIVATE_KEY` | ✅ | ✅ formato corregido |
| `SHEET_ID` | ✅ copia contable nueva | ✅ planilla anterior, sin cambiar su valor |
| `SHEET_TAB` | ✅ variable anterior conservada | ✅ |
| `SHEET_TAB_EGRESOS`, `SHEET_TAB_INGRESOS` | ✅ nombres exactos verificados | ❌ |
| `COLA_SHEET_ID` | ✅ cola nueva | ❌ |
| `TELEGRAM_API_KEY` | ✅ existente; bot real verificado con `getMe`: @mindlindevelopers_facturas_bot | ❌ |
| `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET` | ✅ | ❌ |
| `ANTHROPIC_API_KEY` | ✅ | ❌ |

`DRIVE_FOLDER_ID` ya no se usa: las carpetas se configuran en el script de Apps Script. Si está cargada en Vercel, se puede borrar.

`SHEET_TAB_EGRESOS` está configurada y tiene prioridad sobre la variable anterior `SHEET_TAB`, que se conserva. Ventas usa `SHEET_TAB_INGRESOS`.

Se editaron o agregaron solamente las cuatro variables de configuración de Production: `SHEET_ID`, `SHEET_TAB_EGRESOS`, `SHEET_TAB_INGRESOS` y `COLA_SHEET_ID`. Para conservar el valor anterior de `SHEET_ID` en Preview y Development, se separó su asignación de Production; no se borró la variable. Las credenciales existentes se verificaron por nombre y entorno, sin revelar ni copiar sus valores.

## Telegram

La app consulta `getMe` de Telegram: el usuario real del bot es **@mindlindevelopers_facturas_bot**. El chequeo de configuración confirma que su webhook apunta a esta app. Cada persona debe abrir la web con su mail habilitado y usar **Subir → Conectar mi Telegram → Iniciar** desde la cuenta de Telegram que quiera vincular. El enlace personal vence; no se copia en la documentación.
