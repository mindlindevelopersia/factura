import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { hoyBA } from "@/lib/crm/alarmas";
import { toOutputSchema } from "@/lib/invoice/json-schema";
import { exigir } from "@/lib/permisos/api";
import { aCambios, esquemaDictado, INSTRUCCIONES_DICTADO, pedidoDictado, sinIa } from "@/lib/tareas/dictado";

const MODELO = "claude-opus-5-5";
export const maxDuration = 60;

/**
 * Una tarea dictada → sus campos (título, responsable, fecha, prioridad, subtareas…), para revisar
 * antes de crearla. No guarda nada. Sin ANTHROPIC_API_KEY, devuelve el dictado tal cual.
 */
export async function POST(req: Request) {
  const permiso = await exigir();
  if (permiso instanceof NextResponse) return permiso;
  const body = (await req.json().catch(() => null)) as { texto?: unknown; equipo?: unknown } | null;
  const texto = typeof body?.texto === "string" ? body.texto.trim().slice(0, 4000) : "";
  if (!texto) return NextResponse.json({ error: "No llegó nada dictado." }, { status: 400 });
  const equipo = Array.isArray(body?.equipo) ? body.equipo.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 40)).slice(0, 40) : [];
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ tarea: sinIa(texto), conIa: false });

  const esquema = esquemaDictado(equipo);
  try {
    const r = await new Anthropic().beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: toOutputSchema(esquema) } },
      system: INSTRUCCIONES_DICTADO,
      messages: [{ role: "user", content: pedidoDictado(texto, hoyBA(), equipo) }],
    });
    if (r.stop_reason === "refusal" || r.stop_reason === "max_tokens") return NextResponse.json({ tarea: sinIa(texto), conIa: false });
    const salida = r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = esquema.safeParse(JSON.parse(salida));
    if (!parsed.success) return NextResponse.json({ tarea: sinIa(texto), conIa: false });
    console.log("tarea dictada", { uso: r.usage });
    return NextResponse.json({ tarea: aCambios(parsed.data), conIa: true });
  } catch (e) {
    if (e instanceof SyntaxError || e instanceof Anthropic.APIError) {
      console.error("tarea dictada", e);
      return NextResponse.json({ tarea: sinIa(texto), conIa: false });
    }
    throw e;
  }
}
