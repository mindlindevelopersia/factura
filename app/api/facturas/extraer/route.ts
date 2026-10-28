import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { archivoDeFormulario } from "@/lib/invoice/archivo";
import { completarFactura } from "@/lib/invoice/completar";
import { ExtractionError, extractInvoice } from "@/lib/invoice/extract";
import { claveDuplicado } from "@/lib/invoice/tipos";
import { planillaDesdeEnv } from "@/lib/sheets/planilla";
import type { Registros } from "@/lib/sheets/registros";
import { validateInvoice } from "@/lib/validation";

// Leer una factura con la IA tarda entre 10 y 40 segundos.
export const maxDuration = 120;

/**
 * Lee un comprobante con la IA, lo clasifica (compra, honorarios o venta), completa lo que
 * sale de la carga anterior de la misma contraparte y se fija si ya está en la planilla.
 * No guarda nada.
 */
export async function POST(req: Request) {
  if (!(await getUser())) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta configurar ANTHROPIC_API_KEY en el servidor." }, { status: 503 });
  }

  const archivo = await archivoDeFormulario(await req.formData());
  if ("error" in archivo) return NextResponse.json(archivo, { status: 400 });

  try {
    const planilla = planillaDesdeEnv();
    const [{ invoice, fallback }, registros] = await Promise.all([
      extractInvoice(archivo),
      planilla?.registros().catch((e): Registros | null => {
        // Sin la planilla se puede revisar igual: sin historial y sin control de duplicados.
        console.error("No se pudo leer la planilla", e);
        return null;
      }) ?? null,
    ]);
    const { factura, desde } = completarFactura(invoice, registros?.historial ?? null);
    const validacion = validateInvoice(factura);
    const clave = claveDuplicado(factura);
    const duplicado = clave && registros ? registros.claves.has(clave) : false;
    return NextResponse.json({ factura, validacion, duplicado, desde, fallback });
  } catch (e) {
    if (e instanceof ExtractionError) return NextResponse.json({ error: e.message }, { status: 422 });
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Demasiadas facturas a la vez. Esperá un minuto y reintentá." }, { status: 429 });
    }
    if (e instanceof Anthropic.APIError) {
      console.error("Error de la API de Claude", e.status, e.message);
      return NextResponse.json({ error: "El servicio de IA falló. Reintentá en un rato." }, { status: 502 });
    }
    throw e;
  }
}
