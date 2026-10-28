import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { archivoDeFormulario } from "@/lib/invoice/archivo";
import { ExtractionError, extractInvoice } from "@/lib/invoice/extract";
import { claveDuplicado } from "@/lib/invoice/tipos";
import { planillaDesdeEnv } from "@/lib/sheets/planilla";
import { validateInvoice } from "@/lib/validation";

// Leer una factura con la IA tarda entre 10 y 40 segundos.
export const maxDuration = 120;

/** Lee una factura con la IA y devuelve los datos para revisar. No guarda nada. */
export async function POST(req: Request) {
  if (!(await getUser())) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta configurar ANTHROPIC_API_KEY en el servidor." }, { status: 503 });
  }

  const archivo = await archivoDeFormulario(await req.formData());
  if ("error" in archivo) return NextResponse.json(archivo, { status: 400 });

  try {
    const { invoice, fallback } = await extractInvoice(archivo);
    const validacion = validateInvoice(invoice);
    const clave = claveDuplicado(invoice);
    const planilla = planillaDesdeEnv();
    const duplicado = clave && planilla ? await planilla.existe(clave) : false;
    return NextResponse.json({ invoice, validacion, duplicado, fallback });
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
