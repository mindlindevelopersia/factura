// Todo pasa por el login salvo las rutas de Auth.js, la página de login, los logos y los archivos estáticos.
// Sin sesión válida, `authorized` (auth.ts) devuelve false y Auth.js redirige a /login.
export { auth as proxy } from "./auth";

export const config = {
  matcher: ["/((?!api/auth|login|brand/|_next/static|_next/image|favicon.ico|icon.png).*)"],
};
