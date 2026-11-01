import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { persona } from "@/lib/equipo";
import { contextoDe } from "@/lib/oliver/contexto";
import { INSTRUCCIONES } from "@/lib/oliver/instrucciones";

/** El modelo más económico: alcanza para leer datos y explicarlos. */
const MODELO_OLIVER = "claude-haiku-5-5";
const MAX_MENSAJES = 20;
const MAX_LARGO = 2000;

export const maxDuration = 60;

interface Pedido {
  ruta?: unknown;
  mensajes?: unknown;
}

/**
 * Oliver: el chat de cada sección. Recibe la página en la que está la persona y la conversación, arma
 * los datos de esa sección en el servidor y devuelve la respuesta de a poco (texto plano).
 * No se guarda nada.
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Oliver todavía no está configurado: falta la variable ANTHROPIC_API_KEY en Vercel." }, { status: 503 });
  }

  const pedido = (await req.json().catch(() => ({}))) as Pedido;
  const ruta = typeof pedido.ruta === "string" && pedido.ruta.startsWith("/") ? pedido.ruta.slice(0, 200) : "/";
  const mensajes: Anthropic.MessageParam[] = (Array.isArray(pedido.mensajes) ? pedido.mensajes : [])
    .filter((m): m is { role: "user" | "assistant"; content: string } => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "")
    .slice(-MAX_MENSAJES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_LARGO) }));
  // La conversación tiene que empezar y terminar con la persona.
  while (mensajes.length && mensajes[0].role !== "user") mensajes.shift();
  if (!mensajes.length || mensajes.at(-1)!.role !== "user") return NextResponse.json({ error: "Falta la pregunta." }, { status: 400 });

  let contexto;
  try {
    contexto = await contextoDe(ruta);
  } catch (e) {
    console.error("oliver/contexto", e);
    return NextResponse.json({ error: `No pude leer los datos de esta sección. ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }

  const quien = persona(user.email, user.name);
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: MODELO_OLIVER,
    max_tokens: 16000,
    system: [
      { type: "text", text: INSTRUCCIONES },
      {
        type: "text",
        text: `Sección: ${contexto.seccion}. En esta sección sos especialista en ${contexto.especialidad}.\n\nDatos de la sección (JSON):\n${JSON.stringify(contexto.datos)}`,
        // Los datos se repiten en cada pregunta de la conversación: se cachean.
        cache_control: { type: "ephemeral" },
      },
      { type: "text", text: `Te escribe ${quien.nombre}; decile ${quien.apodo}.` },
    ],
    messages: mensajes,
  });

  const cuerpo = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") controller.enqueue(enc.encode(ev.delta.text));
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") controller.enqueue(enc.encode("\n\nNo puedo responder eso."));
        if (final.stop_reason === "max_tokens") controller.enqueue(enc.encode("\n\n(La respuesta quedó cortada: preguntame algo más puntual.)"));
        console.log("oliver", { ruta, uso: final.usage });
      } catch (e) {
        console.error("oliver", e);
        const mensaje =
          e instanceof Anthropic.RateLimitError
            ? "Hay muchas preguntas a la vez: probá de nuevo en un minuto."
            : e instanceof Anthropic.AuthenticationError
              ? "La clave de Anthropic no es válida (ANTHROPIC_API_KEY en Vercel)."
              : "No pude responder. Probá de nuevo.";
        controller.enqueue(enc.encode(`\n\n${mensaje}`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(cuerpo, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
