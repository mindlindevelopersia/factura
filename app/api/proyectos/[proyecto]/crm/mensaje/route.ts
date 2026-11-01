import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { unidadesDisponibles } from "@/lib/finanzas/fuente";
import { hoyBA, temperatura, unidadesPara } from "@/lib/crm/alarmas";
import { errorCrm, preparar } from "@/lib/crm/api";
import { leerCrm } from "@/lib/crm/fuente";

const MODELO = "claude-haiku-5-5";
export const maxDuration = 60;

const INSTRUCCIONES = `Escribís mensajes de seguimiento comercial para Mindlin Developers, una desarrolladora de Buenos Aires que vende departamentos en pozo con un modelo al costo (anticipo y cuotas en pesos ajustadas por CAC; algunos pagan de contado). Te dan la ficha de un contacto, su historial y las unidades que le pueden servir.

Escribí un mensaje para el próximo paso con ese contacto, que suene a una persona y no a un robot:
- Castellano rioplatense, con voseo, cálido y breve (WhatsApp: 2 a 5 líneas). Usá lo que sabemos del contacto y del historial; no repitas lo que ya se le dijo.
- Solo datos que estén en la ficha, el historial o las unidades. No inventes precios, unidades, fechas ni promesas.
- Un solo pedido concreto al final (una llamada, una fecha, una respuesta).
- Firmá con el nombre de quien escribe.

Respondé exactamente en este formato, sin nada más:
WHATSAPP:
<el mensaje>
ASUNTO:
<asunto del mail>
MAIL:
<el mail, un poco más completo que el WhatsApp, con saludo y firma>`;

/** Oliver propone un mensaje para un contacto, con su ficha, su historial y las unidades que le sirven. */
export async function POST(req: Request, { params }: { params: Promise<{ proyecto: string }> }) {
  const ctx = await preparar((await params).proyecto, "comercial/crm");
  if (ctx instanceof NextResponse) return ctx;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Falta la variable ANTHROPIC_API_KEY en Vercel para los mensajes con IA." }, { status: 503 });
  const { id, indicacion } = (await req.json().catch(() => ({}))) as { id?: string; indicacion?: string };
  try {
    const [{ contactos, actividad }, unidades] = await Promise.all([leerCrm(), unidadesDisponibles(ctx.proyecto.id)]);
    const c = contactos.find((x) => x.id === id);
    if (!c) return NextResponse.json({ error: "No se encontró el contacto." }, { status: 404 });
    const hoy = hoyBA();
    const datos = {
      hoy,
      proyecto: ctx.proyecto.nombre,
      escribe: ctx.nombre,
      contacto: { ...c, temperatura: temperatura(c, hoy) },
      historial: actividad.filter((a) => a.contactoId === c.id).slice(0, 15),
      unidadesQueLeSirven: unidadesPara(c, unidades).slice(0, 4),
      todasLasDisponibles: unidades,
    };
    const client = new Anthropic();
    const r = await client.messages.create({
      model: MODELO,
      max_tokens: 4000,
      system: INSTRUCCIONES,
      messages: [
        {
          role: "user",
          content: `Datos (JSON):\n${JSON.stringify(datos)}${indicacion?.trim() ? `\n\nIndicación de ${ctx.usuario}: ${indicacion.trim().slice(0, 500)}` : ""}`,
        },
      ],
    });
    if (r.stop_reason === "refusal") return NextResponse.json({ error: "No pude armar el mensaje." }, { status: 422 });
    const texto = r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const parte = (desde: string, hasta: string | null) => {
      const i = texto.indexOf(desde);
      if (i < 0) return "";
      const j = hasta ? texto.indexOf(hasta, i) : -1;
      return texto.slice(i + desde.length, j < 0 ? undefined : j).trim();
    };
    console.log("crm mensaje", { uso: r.usage });
    return NextResponse.json({ whatsapp: parte("WHATSAPP:", "ASUNTO:"), asunto: parte("ASUNTO:", "MAIL:"), mail: parte("MAIL:", null) });
  } catch (e) {
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: "No pude armar el mensaje con IA. Probá de nuevo." }, { status: 502 });
    return errorCrm(e, "crm mensaje");
  }
}
