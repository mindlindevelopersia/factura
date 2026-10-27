import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail } from "./lib/auth/allowed";

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
    authorized({ auth }) {
      return isAllowedEmail(auth?.user?.email);
    },
  },
});
