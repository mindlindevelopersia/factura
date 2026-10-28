# Configuración actual

Estado de los servicios verificado el 28/10/2026, con lo que cambió el 29/10/2026 (ver [puesta en marcha](puesta-en-marcha.md)). Acá no hay valores secretos: los secretos de la app están en Vercel y el del script también en sus propiedades privadas.

Se sigue usando la planilla y la carpeta de **prueba**, por decisión del responsable del proyecto. La planilla real del cliente todavía no está disponible.

## Producción

- **App:** https://mindlin-developers.vercel.app. `factura-three-blue.vercel.app` redirige a ese dominio.
- **Repo:** `mindlindevelopersia/factura`. Vercel despliega desde `main`.
- **Login:** probado en producción con axellaban@gmail.com. Entra, muestra el mail y "Salir" funciona.
- **Integración:** API real de Claude, revisión, aprobación, Drive y Sheets probados con comprobantes sintéticos. Ver [verificacion.md](verificacion.md).
- **Despliegue con la conexión completa:** `4e8mb3kotD1iLi9omB27SyHEKKUN`, estado Ready y Production, con el dominio principal asignado, desde `main` (`b2f414c`).

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

- **Planilla de prueba:** "[PRUEBA] Facturación de Egresos - Mindlin", ID `1ICwVOWj1Bz5htd5j06gnhdpVlnW1Rv-_NYEAEaLM1vA`, pestaña `Hoja 1`. Su propietaria es mindlindevelopers.ia@gmail.com y la cuenta de servicio tiene permiso de Editor. Se copiaron los encabezados y el formato del entorno de prueba; no contiene datos reales del cliente.
- **Carpeta de prueba:** "Facturas Mindlin (prueba)", ID `1ZzZT4P8YVvQkV4lF1Cu9UC7yMLPvzIaP`, propiedad de Mindlin. Los comprobantes se guardan con Apps Script para usar el almacenamiento de esta cuenta de Gmail.

El script **Guardar facturas Mindlin** fue creado, autorizado y publicado desde mindlindevelopers.ia@gmail.com. La prueba del editor creó un archivo en la carpeta nueva y lo envió a la papelera. Después del cambio en Vercel, la app guardó una imagen y un PDF en esa carpeta y agregó las filas 2 y 3 a la planilla de Mindlin. Se verificó que ambos archivos pertenecen a Mindlin y tienen acceso general restringido.

- Proyecto: `1gCnlM-tgv2n45WKKe4LEpq8jcI0TH7yakOJYd9Xkjj-3zP3wYuOHL2FJ`.
- Implementación: versión 1 del 28/10/2026, ejecutada como **Yo (mindlindevelopers.ia@gmail.com)**.
- URL: `https://script.google.com/macros/s/AKfycbzsCnZuxRzSt-FqtdK8_ycfCDdjPBP_vNkB5GqLgrkwYbQyVZ-CIe3Q1MixdIMN5RMl/exec`.
- Las llamadas requieren el secreto de la app. La URL nueva respondió `{"ok":false,"error":"No autorizado"}` ante un secreto incorrecto.
- La autorización de Google para el script abarca Drive completo; el código usa la carpeta configurada. Este alcance y la publicación fueron informados y autorizados para la cuenta de Mindlin.
- La creación de estos recursos y la publicación no requirieron configurar una tarjeta ni activar facturación de Google. El consumo de la API de Anthropic continúa usando la clave ya configurada.

La planilla `16LLVlh-d9OsMCRf6c2XXPs1dEwyN1gRQxOnkb2_qWYo`, la carpeta `1m5AlKHiN-BSFvYQNOG0mep9sP0vu4e-O` y el proyecto de Apps Script `13Ai0PlYTQAzORhuNALbk7hSgo1SuK2MsqWfKBL1Kn5Yz75TRRan3JEWy` de Axel conservan las pruebas anteriores como respaldo. La implementación web de Axel fue **archivada** después de verificar la conexión nueva; su URL devuelve HTTP 404. El proyecto de Google Cloud y el cliente OAuth siguen siendo los existentes, descritos arriba.

Mindlin no tiene Google Workspace: el mail de mindlindevelopers.com está en Zoho. Por eso no hay unidad compartida.

## Variables en Vercel

| Variable | Production | Preview y Development |
|---|---|---|
| `AUTH_SECRET` | ✅ | ❌ |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | ✅ | ✅ |
| `ALLOWED_EMAILS` (`axellaban@gmail.com,matimindlin111@gmail.com`) | ✅ | ❌ |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ✅ | ✅ |
| `GOOGLE_PRIVATE_KEY` | ✅ | ✅ formato corregido |
| `SHEET_ID`, `SHEET_TAB` | ✅ | ✅ |
| `SHEET_TAB_EGRESOS`, `SHEET_TAB_INGRESOS` | ❌ falta ([puesta en marcha](puesta-en-marcha.md)) | ❌ |
| `COLA_SHEET_ID` | ❌ falta ([puesta en marcha](puesta-en-marcha.md)) | ❌ |
| `TELEGRAM_API_KEY` | ✅ cargada el 29/10/2026. El usuario del bot lo pide la app a Telegram (`getMe`) y se ve en la web | ❌ |
| `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET` | ✅ | ❌ |
| `ANTHROPIC_API_KEY` | ✅ | ❌ |

`DRIVE_FOLDER_ID` ya no se usa: las carpetas se configuran en el script de Apps Script. Si está cargada en Vercel, se puede borrar.

`SHEET_TAB` sigue sirviendo como pestaña de egresos mientras no se cargue `SHEET_TAB_EGRESOS`. Sin `SHEET_TAB_INGRESOS`, la app no carga ventas.

Production usa la URL del script de Mindlin y el `SHEET_ID` nuevo. La URL se actualizó en Production y el ID de la planilla en todos los entornos; se volvió a desplegar Production después de guardar ambos cambios. Preview y Development conservan las limitaciones de acceso indicadas en la tabla; la prueba del circuito completo se realizó en Production, apuntando a los archivos de prueba.
