import { describe, expect, it } from "vitest";
import { TelegramApi } from "./api";
import { reaccionDeAviso } from "./mensajes";

function api(respuestas: (Response | Error)[]) {
  const pedidos: string[] = [];
  const t = new TelegramApi("T", (async (url: string) => {
    pedidos.push(url.split("/").at(-1)!);
    const r = respuestas.shift()!;
    if (r instanceof Error) throw r;
    return r;
  }) as typeof fetch);
  t.esperar = async () => {};
  return { t, pedidos };
}

const json = (cuerpo: object, status = 200) => new Response(JSON.stringify(cuerpo), { status });

describe("TelegramApi", () => {
  it("si Telegram pide esperar (429), espera y manda el mensaje una vez", async () => {
    const { t, pedidos } = api([json({ ok: false, parameters: { retry_after: 1 } }, 429), json({ ok: true, result: {} })]);
    await t.enviar(1, "hola");
    expect(pedidos).toEqual(["sendMessage", "sendMessage"]);
  });

  it("un corte de red no repite un mensaje (podría llegar dos veces), pero sí una reacción", async () => {
    const { t } = api([new Error("ECONNRESET")]);
    await expect(t.enviar(1, "hola")).rejects.toThrow("ECONNRESET");
    const r = api([new Error("ECONNRESET"), json({ ok: true, result: true })]);
    await r.t.reaccionar(1, 2, "👍");
    expect(r.pedidos).toEqual(["setMessageReaction", "setMessageReaction"]);
  });
});

describe("reacciones sobre el mensaje de la factura", () => {
  it("dicen en qué quedó", () => {
    expect(reaccionDeAviso("leida")).toBe("👌");
    expect(reaccionDeAviso("leida", { duplicado: true, repetida: null })).toBe("🤔");
    expect(reaccionDeAviso("error")).toBe("🤔");
    expect(reaccionDeAviso("aprobada")).toBe("👍");
    expect(reaccionDeAviso("descartada")).toBeNull();
  });
});
