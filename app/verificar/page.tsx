import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { Verificar } from "@/components/Verificar";
import { tfaActivo } from "@/lib/tfa/dispositivo";
import { claveDe } from "@/lib/tfa/fuente";
import { emailDeGoogle, segundoFactorOk } from "@/lib/tfa/sesion";

export const metadata: Metadata = { title: "Verificación" };

/** Solo rutas internas, para no redirigir afuera. */
function rutaInterna(destino: string | undefined): string {
  if (!destino || !destino.startsWith("/") || destino.startsWith("//")) return "/";
  return destino;
}

/** El segundo paso del ingreso: el código de 6 números de la app (o darla de alta la primera vez). */
export default async function PaginaVerificar({ searchParams }: { searchParams: Promise<{ destino?: string }> }) {
  const destino = rutaInterna((await searchParams).destino);
  const email = await emailDeGoogle();
  if (!email) redirect("/login");
  if (!tfaActivo() || (await segundoFactorOk(email))) redirect(destino);
  let tieneApp: boolean | null = null;
  try {
    tieneApp = !!(await claveDe(email));
  } catch (e) {
    console.error("verificar", e);
  }
  return (
    <main className="login">
      <div className="login__panel verificar">
        <Image className="login__logo" src="/brand/mindlin-logo.png" alt="Mindlin Developers" width={631} height={219} priority />
        <span className="eyebrow">Verificación en dos pasos</span>
        {tieneApp === null ? (
          <p role="alert" className="alerta alerta--error">
            No se pudo revisar la verificación (la planilla no respondió). Recargá la página en un rato.
          </p>
        ) : (
          <Verificar email={email} tieneApp={tieneApp} destino={destino} />
        )}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="verificar__salir">
            Entrar con otra cuenta
          </button>
        </form>
      </div>
    </main>
  );
}
