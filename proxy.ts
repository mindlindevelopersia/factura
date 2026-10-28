// Todo pasa por el login salvo las rutas de Auth.js, el webhook de Telegram (que se valida con su propio secreto),
// la página de login, los logos y los archivos estáticos.
// Sin sesión válida, `authorized` (auth.ts) devuelve false y Auth.js redirige a /login.
export { auth as proxy } from "./auth";

export const config = {
  matcher: ["/((?!api/auth|api/telegram-webhook|login|brand/|_next/static|_next/image|favicon.ico|icon.png).*)"],
};
