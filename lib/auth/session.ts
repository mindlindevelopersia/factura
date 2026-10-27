import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAllowedEmail } from "./allowed";

/**
 * Devuelve el usuario logueado o redirige a /login.
 *
 * proxy.ts ya bloquea los pedidos sin sesión; esto es la segunda barrera.
 * Llamarlo en cada página y ruta de API que toque datos.
 */
export async function requireUser() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAllowedEmail(email)) redirect("/login");
  return { email, name: session.user?.name ?? email };
}
