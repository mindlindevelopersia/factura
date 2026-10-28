import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAllowedEmail } from "./allowed";

export interface Usuario {
  email: string;
  name: string;
}

/** El usuario logueado y habilitado, o null. Para rutas de API, que responden 401. */
export async function getUser(): Promise<Usuario | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAllowedEmail(email)) return null;
  return { email, name: session.user?.name ?? email };
}

/**
 * Devuelve el usuario logueado o redirige a /login.
 *
 * proxy.ts ya bloquea los pedidos sin sesión; esto es la segunda barrera.
 * Llamarlo en cada página que toque datos (en rutas de API, getUser).
 */
export async function requireUser(): Promise<Usuario> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
