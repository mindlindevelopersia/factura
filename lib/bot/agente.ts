import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ejecutar, HERRAMIENTAS, type ContextoBot } from "./herramientas";
import type { Turno } from "./historial";
import { INSTRUCCIONES_BOT } from "./instrucciones";

const MODELO = "claude-opus-5-5";
/** Vueltas de herramientas por mensaje (buscar, crear, avisar…): de sobra para un pedido normal. */
const MAX_VUELTAS = 8;

export interface RespuestaBot {
  texto: string;
  opciones: string[];
  acciones: string[];
}

/**
 * Un mensaje de Telegram: Claude lee la conversación, usa las herramientas que hagan falta (con
 * los permisos de quien escribe) y contesta, preguntando si falta algo.
 */
export async function conversar(o: { ctx: ContextoBot; contexto: string; historial: Turno[]; mensaje: string; client?: Anthropic }): Promise<RespuestaBot> {
  const client = o.client ?? new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [...o.historial.map((t) => ({ role: t.rol, content: t.texto })), { role: "user", content: o.mensaje }];
  const acciones: string[] = [];
  let opciones: string[] = [];
  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const r = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: INSTRUCCIONES_BOT, cache_control: { type: "ephemeral" } },
        { type: "text", text: o.contexto },
      ],
      tools: HERRAMIENTAS,
      messages,
    });
    if (r.stop_reason === "refusal") return { texto: "Con eso no te puedo ayudar.", opciones: [], acciones };
    // Todo lo que respondió vuelve tal cual (incluido lo que pensó), como pide la API.
    messages.push({ role: "assistant", content: r.content });
    const usos = r.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (r.stop_reason !== "tool_use" || !usos.length) {
      const texto = r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      return { texto: texto || "Listo.", opciones, acciones };
    }
    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const u of usos) {
      try {
        const res = await ejecutar(u.name, (u.input ?? {}) as Record<string, unknown>, o.ctx);
        if (res.accion) acciones.push(res.accion);
        if (res.opciones) opciones = res.opciones;
        resultados.push({ type: "tool_result", tool_use_id: u.id, content: res.contenido, is_error: res.error ?? false });
      } catch (e) {
        console.error(`bot: ${u.name}`, e);
        resultados.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify({ error: `Falló: ${e instanceof Error ? e.message : String(e)}` }), is_error: true });
      }
    }
    messages.push({ role: "user", content: resultados });
  }
  return { texto: "Me enredé con este pedido. ¿Me lo contás de nuevo más simple?", opciones: [], acciones };
}
