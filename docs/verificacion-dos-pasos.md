# Verificación en dos pasos

Después de entrar con Google, el hub pide el código de 6 números de una app de códigos (Google
Authenticator u otra compatible). Así, aunque alguien consiga la contraseña de Google de una
cuenta habilitada, no puede entrar sin el celular de esa persona.

## Cómo se usa

- **Primera vez:** `/verificar` muestra un QR (y la clave para cargarla a mano, o el link para
  abrirla en la app desde el celular). Se escanea y se escribe el código para confirmar.
- **Después:** se pide el código solo al entrar desde un navegador nuevo. Con "Recordar este
  navegador" (tildado de entrada) no se vuelve a pedir por 30 días, aunque la sesión de Google
  (12 h) venza y haya que volver a entrar. Sin tildarlo, vale 12 horas.
- **Perdió el celular:** el super administrador, en Ajustes → Usuarios → la persona →
  "Reiniciar (perdió el celular)". En su próximo ingreso escanea un QR nuevo. En la lista de
  usuarios se ve quién ya lo activó.
- **Emergencia:** `TFA_DESACTIVADO=1` en Vercel apaga la verificación para todos (por ejemplo,
  si el super administrador pierde el celular). Se borra la variable para volver a prenderla.

## Cómo está hecho

- **Dónde se exige:**
  - `auth.ts` (`authorized`, que corre en `proxy.ts` en cada pedido): sin el navegador
    recordado, las páginas van a `/verificar` y la API responde 401.
  - `lib/auth/session.ts` (`getUser` / `requireUser`) lo vuelve a revisar como segunda barrera.
  - Sin el código solo se pueden usar `/verificar` y `/api/tfa/*`, siempre con la sesión de Google.
- **Códigos:** TOTP (RFC 6238: SHA-1, 6 dígitos, 30 s; acepta el paso anterior y el siguiente)
  en `lib/tfa/totp.ts`, con los vectores del RFC en los tests.
- **Claves:**
  - Pestaña "Segundo factor" de la planilla del CRM, cifradas con AES-256-GCM con una llave
    derivada de `AUTH_SECRET` (`lib/tfa/cifrado.ts`). Quien vea la planilla no puede generar
    códigos.
  - Si `AUTH_SECRET` cambia, las claves no se pueden leer y cada uno vuelve a escanear el QR.
  - Durante el alta, la clave nueva viaja en una cookie cifrada de 15 minutos hasta confirmarla.
- **Navegador recordado:** cookie `hub-2fa` (`httpOnly`, `secure`, `sameSite=lax`) con el mail y
  el vencimiento, firmada con HMAC-SHA256 (`lib/tfa/dispositivo.ts`). Es de un mail: si entra
  otra cuenta en ese navegador, se le pide su código.
- **Intentos:** 5 códigos mal en 10 minutos por persona y hay que esperar (en memoria de cada
  servidor).
