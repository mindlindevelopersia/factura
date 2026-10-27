import { signIn } from "@/auth";

const ERRORES: Record<string, string> = {
  AccessDenied: "Ese mail no está habilitado para usar la app. Pedile acceso al administrador.",
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
    <main>
      <h1>Lector de facturas de compra</h1>
      {error && <p role="alert">{ERRORES[error] ?? "No se pudo iniciar sesión. Probá de nuevo."}</p>}
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: destino });
        }}
      >
        <button type="submit">Ingresar con Google</button>
      </form>
    </main>
  );
}
