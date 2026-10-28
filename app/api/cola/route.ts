import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { respuestaDeError, serviciosDesdeEnv } from "@/lib/cola/env";
import { ingresar, listar } from "@/lib/cola/servicio";
import { archivoDeFormulario } from "@/lib/invoice/archivo";

// Subir incluye leer con la IA: entre 10 y 40 segundos.
export const maxDuration = 120;

/** Lo que espera revisión y el historial. */
export async function GET(req: Request) {
  if (!(await getUser())) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  try {
    return NextResponse.json(await listar(serviciosDesdeEnv(new URL(req.url).origin)));
  } catch (e) {
    return respuestaDeError(e);
  }
}

/** Sube un comprobante desde la web: se guarda, entra en la cola y se lee con la IA. */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  const form = await req.formData();
  const archivo = await archivoDeFormulario(form);
  if ("error" in archivo) return NextResponse.json(archivo, { status: 400 });
  const comentario = String(form.get("comentario") ?? "").trim() || undefined;
  try {
    const s = serviciosDesdeEnv(new URL(req.url).origin);
    const item = await ingresar(s, {
      archivo: { nombre: archivo.name, mediaType: archivo.mediaType, data: archivo.data },
      origen: "web",
      enviadaPor: user.email,
      comentario,
    });
    return NextResponse.json({ item });
  } catch (e) {
    return respuestaDeError(e);
  }
}
