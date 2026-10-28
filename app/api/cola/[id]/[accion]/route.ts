import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { respuestaDeError, serviciosDesdeEnv } from "@/lib/cola/env";
import { aprobar, descartar, ErrorCola, reintentar } from "@/lib/cola/servicio";
import { FacturaSchema } from "@/lib/invoice/schema";

// Reintentar vuelve a leer con la IA.
export const maxDuration = 120;

type Contexto = { params: Promise<{ id: string; accion: string }> };

const RESPUESTA_MAXIMA = 4_000_000;

/**
 * GET /api/cola/<id>/archivo: el PDF o la foto, para la vista previa de la ficha.
 * GET /api/cola/<id>/nota?n=<índice>: un comentario en audio.
 */
export async function GET(req: Request, { params }: Contexto) {
  if (!(await getUser())) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  const { id, accion } = await params;
  if (accion !== "archivo" && accion !== "nota") return NextResponse.json({ error: "No existe." }, { status: 404 });
  try {
    const s = serviciosDesdeEnv(new URL(req.url).origin);
    const item = await s.cola.obtener(id);
    if (!item) throw new ErrorCola("Ese comprobante no está en la cola.", 404);
    // Solo se sirven el comprobante y los audios de sus comentarios: nunca un ID de Drive que venga en el pedido.
    const audio = accion === "nota" ? item.notas[Number(new URL(req.url).searchParams.get("n"))]?.audio : undefined;
    if (accion === "nota" && !audio) throw new ErrorCola("Ese comentario no existe.", 404);
    const pedido = audio ?? item.archivo;
    const archivo = await s.almacen.leer(pedido.driveId);
    // Vercel no devuelve más de 4,5 MB: un PDF grande (puede llegar por Telegram) se ve en Drive.
    if (archivo.data.byteLength > RESPUESTA_MAXIMA && pedido.url) return NextResponse.redirect(pedido.url);
    return new Response(Buffer.from(archivo.data), {
      headers: {
        "Content-Type": pedido.mediaType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(pedido.nombre)}`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return respuestaDeError(e);
  }
}

/** POST /api/cola/<id>/aprobar (con la factura revisada), /descartar o /reintentar. */
export async function POST(req: Request, { params }: Contexto) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  const { id, accion } = await params;
  try {
    const s = serviciosDesdeEnv(new URL(req.url).origin);
    if (accion === "aprobar") {
      const parsed = FacturaSchema.safeParse((await req.json().catch(() => null))?.factura);
      if (!parsed.success) throw new ErrorCola(`Datos de la factura inválidos: ${parsed.error.message}`, 400);
      return NextResponse.json({ item: await aprobar(s, id, parsed.data, user.email) });
    }
    if (accion === "descartar") return NextResponse.json({ item: await descartar(s, id, user.email) });
    if (accion === "reintentar") return NextResponse.json({ item: await reintentar(s, id) });
    return NextResponse.json({ error: "No existe." }, { status: 404 });
  } catch (e) {
    return respuestaDeError(e);
  }
}
