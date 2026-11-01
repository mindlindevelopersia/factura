// Todo pasa por el login salvo las rutas de Auth.js, el webhook de Telegram (que se valida con su propio secreto),
// la página de login, los logos, los íconos, el manifiesto de la app y los archivos estáticos.
// El manifiesto tiene que quedar afuera: el navegador lo pide sin cookies.
// Sin sesión válida, `authorized` (auth.ts) devuelve false y Auth.js redirige a /login.
export { auth as proxy } from "./auth";

export const config = {
  matcher: ["/((?!api/auth|api/telegram-webhook|login|brand/|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest).*)"],
};
