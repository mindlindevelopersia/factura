# Configuración actual

Estado de los servicios al 28/10/2026. Acá no hay secretos: los secretos están solo en Vercel.

## Producción

- **App:** https://mindlin-developers.vercel.app. `factura-three-blue.vercel.app` redirige a ese dominio.
- **Repo:** `mindlindevelopersia/factura`. Vercel despliega desde `main`.
- **Login:** probado en producción con axellaban@gmail.com. Entra, muestra el mail y "Salir" funciona.

## Google Cloud

Proyecto `mindlin-developers`, en la cuenta **axellaban@gmail.com** (Gmail, no Workspace).

- **APIs habilitadas:** Google Sheets API y Google Drive API.
- **Pantalla de consentimiento:** tipo Externo, app "Facturas Mindlin". Está en modo **Prueba**: solo pueden entrar los usuarios de prueba. No hace falta publicarla mientras la app use solo email y perfil.
- **Usuarios de prueba:** axellaban@gmail.com y matimindlin111@gmail.com. Tienen que coincidir con `ALLOWED_EMAILS`: cada mail nuevo va en los dos lados.
- **Cliente OAuth "Facturas Mindlin":**
  - ID: `40553044262-2ebssljpfk2kmofjr52gj5do87hebkdq.apps.googleusercontent.com`
  - URI de redirección: `https://mindlin-developers.vercel.app/api/auth/callback/google` y `http://localhost:3000/api/auth/callback/google`.
- **Cuenta de servicio:** `facturas-app@mindlin-developers.iam.gserviceaccount.com`, sin roles en el proyecto. Solo accede a lo que se comparte con ella.
  - Clave `3278eda011de…`: la que usa Vercel.
  - Clave `efd7e536…`: la que usa el desarrollador para pruebas. Se compartió en una conversación con Claude, así que **hay que borrarla antes de usar la planilla real**.

## Drive (cuenta axellaban@gmail.com)

- **Planilla de prueba:** "[PRUEBA] Facturación de Egresos", ID `16LLVlh-d9OsMCRf6c2XXPs1dEwyN1gRQxOnkb2_qWYo`, pestaña `Hoja 1`. Es una planilla nueva, no una copia de la real. Está compartida con la cuenta de servicio como Editor. La app escribe los encabezados si la encuentra vacía.
- **Carpeta de prueba:** "Facturas (prueba)", ID `1m5AlKHiN-BSFvYQNOG0mep9sP0vu4e-O`. **La cuenta de servicio no puede subir archivos ahí**: Google responde "Service Accounts do not have storage quota". Por eso los PDF se guardan con un script de Apps Script (ver [pendientes](pendientes.md#dónde-se-guardan-los-pdf)), que puede usar esta carpeta si se publica en axellaban@gmail.com.

Mindlin no tiene Google Workspace: el mail de mindlindevelopers.com está en Zoho. Por eso no hay unidad compartida.

## Variables en Vercel

| Variable | Production | Preview y Development |
|---|---|---|
| `AUTH_SECRET` | ✅ | ❌ |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | ✅ | ✅ |
| `ALLOWED_EMAILS` (`axellaban@gmail.com,matimindlin111@gmail.com`) | ✅ | ❌ |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ✅ | ✅ |
| `GOOGLE_PRIVATE_KEY` | ✅ | ⚠️ sin la corrección del final |
| `SHEET_ID`, `SHEET_TAB` | ✅ | ✅ |
| `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET` | ❌ | ❌ |
| `ANTHROPIC_API_KEY` | ❌ | ❌ |

`DRIVE_FOLDER_ID` ya no se usa: la carpeta se configura en el script de Apps Script. Si está cargada en Vercel, se puede borrar.

Sin `ANTHROPIC_API_KEY` la app no puede leer facturas. Sin `APPS_SCRIPT_URL` y `APPS_SCRIPT_SECRET`, las facturas se cargan en la planilla con el link vacío.
