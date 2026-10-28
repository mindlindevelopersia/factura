# Configuración actual

Estado de los servicios verificado el 28/10/2026. Acá no hay valores secretos: los secretos de la app están en Vercel y el del script también en sus propiedades privadas.

Se sigue usando la planilla y la carpeta de **prueba**, por decisión del responsable del proyecto. La planilla real del cliente todavía no está disponible.

## Producción

- **App:** https://mindlin-developers.vercel.app. `factura-three-blue.vercel.app` redirige a ese dominio.
- **Repo:** `mindlindevelopersia/factura`. Vercel despliega desde `main`.
- **Login:** probado en producción con axellaban@gmail.com. Entra, muestra el mail y "Salir" funciona.
- **Integración:** API real de Claude, revisión, aprobación, Drive y Sheets probados con comprobantes sintéticos. Ver [verificacion.md](verificacion.md).
- **Despliegue con la conexión completa:** `BzvgR3WYqtze7iAcbZ1F9UYoUDnb`, estado Ready y Production/Current, desde `main` (`b2f414c`).

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

## Drive (cuenta axellaban@gmail.com)

- **Planilla de prueba:** "[PRUEBA] Facturación de Egresos", ID `16LLVlh-d9OsMCRf6c2XXPs1dEwyN1gRQxOnkb2_qWYo`, pestaña `Hoja 1`. Es una planilla nueva, no una copia de la real. Está compartida con la cuenta de servicio como Editor. La app escribe los encabezados si la encuentra vacía.
- **Carpeta de prueba:** "Facturas (prueba)", ID `1m5AlKHiN-BSFvYQNOG0mep9sP0vu4e-O`. La cuenta de servicio no puede subir archivos a un Drive de Gmail por su cuota de almacenamiento. Por eso los comprobantes se guardan con el script de Apps Script publicado en la cuenta propietaria.

El script **Guardar facturas Mindlin** ya está publicado en la cuenta axellaban@gmail.com y guarda en esa carpeta. La prueba del editor creó un archivo y lo envió a la papelera; después la app guardó comprobantes y sus enlaces en Sheets.

- Proyecto: `13Ai0PlYTQAzORhuNALbk7hSgo1SuK2MsqWfKBL1Kn5Yz75TRRan3JEWy`.
- Implementación: versión 1 del 28/10/2026, ejecutada como la cuenta propietaria.
- URL: `https://script.google.com/macros/s/AKfycbwEyQqlRuvpOdozM-LlWLM5JvB2U9EbMZuFZm7iuHgzUwVcxNEJ_iyN-i7vbJ3LJw7jFQ/exec`.
- Las llamadas requieren el secreto de la app. Una llamada con un secreto incorrecto respondió `{"ok":false,"error":"No autorizado"}`.
- La autorización de Google para el script abarca Drive completo; el código usa la carpeta configurada. Este alcance se informó y fue autorizado por el responsable del proyecto.

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
| `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET` | ✅ | ❌ |
| `ANTHROPIC_API_KEY` | ✅ | ❌ |

`DRIVE_FOLDER_ID` ya no se usa: la carpeta se configura en el script de Apps Script. Si está cargada en Vercel, se puede borrar.

Production ya tiene esas tres variables y se volvió a desplegar después de configurarlas. Preview y Development conservan las limitaciones de acceso indicadas en la tabla; la prueba del circuito completo se realizó en Production, apuntando a los archivos de prueba.
