import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { NextResponse } from "next/server";
import { isAllowedEmail } from "./lib/auth/allowed";
import { COOKIE_DISPOSITIVO, dispositivoValido, SIN_SEGUNDO_FACTOR, tfaActivo } from "./lib/tfa/dispositivo";

// Lee AUTH_SECRET, AUTH_GOOGLE_ID y AUTH_GOOGLE_SECRET del entorno.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  // La app maneja datos fiscales: la sesión dura una jornada.
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // Al iniciar sesión: solo mails verificados por Google y que estén en la lista.
    signIn({ profile }) {
      return profile?.email_verified === true && isAllowedEmail(profile.email);
    },
    // En cada pedido (proxy.ts): se vuelve a mirar la lista, así sacar a alguien tiene efecto inmediato.
    // Después, la verificación en dos pasos: sin el navegador recordado (cookie firmada), a /verificar
    // (o 401 en la API). Ver lib/tfa.
    async authorized({ auth, request }) {
      const email = auth?.user?.email;
      if (!isAllowedEmail(email)) return false;
      const { pathname, search } = request.nextUrl;
      if (!tfaActivo() || SIN_SEGUNDO_FACTOR(pathname)) return true;
      if (await dispositivoValido(request.cookies.get(COOKIE_DISPOSITIVO)?.value, email, process.env.AUTH_SECRET)) return true;
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Falta el código de verificación. Recargá la página." }, { status: 401 });
      const url = request.nextUrl.clone();
      url.pathname = "/verificar";
      url.search = `?destino=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    },
  },
});
