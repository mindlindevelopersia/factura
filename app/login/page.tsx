import Image from "next/image";
import { signIn } from "@/auth";

const ERRORES: Record<string, string> = {
  AccessDenied:
    "Ese mail no está habilitado para usar la app. Pedile acceso al administrador.",
  Configuration: "El login no está bien configurado. Avisale al administrador.",
};

/** Se queda solo con la ruta de callbackUrl, para no redirigir a otro sitio después del login. */
function rutaInterna(callbackUrl: string | undefined): string {
  if (!callbackUrl) return "/";
  try {
    const url = new URL(callbackUrl, "http://interno");
    return url.pathname + url.search;
  } catch {
    return "/";
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;
  const destino = rutaInterna(callbackUrl);

  return (
    <main className="login">
      <div className="login__panel">
        <Image
          className="login__logo"
          src="/brand/mindlin-logo.png"
          alt="Mindlin Developers"
          width={631}
          height={219}
          priority
        />
        <span className="eyebrow">Administración de comprobantes</span>
        <h1>
          Menos carga manual.
          <br />
          Más control.
        </h1>
        <p>
          Compras, honorarios y ventas en un mismo lugar. La IA propone los
          datos; vos revisás y aprobás.
        </p>
        {error && (
          <p role="alert" className="alerta alerta--error">
            {ERRORES[error] ?? "No se pudo iniciar sesión. Probá de nuevo."}
          </p>
        )}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: destino });
          }}
        >
          <button type="submit" className="btn btn--primario">
            Ingresar con Google
          </button>
        </form>
        <p className="login__acceso">
          Acceso exclusivo para cuentas habilitadas de Mindlin.
        </p>
      </div>
    </main>
  );
}
