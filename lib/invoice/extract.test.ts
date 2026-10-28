import { invoiceDePrueba } from "../../test/fixtures";
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { ExtractionError, extractInvoice } from "./extract";
import type { Invoice } from "./schema";

const invoice: Invoice = invoiceDePrueba({ punto_venta: 3, numero: 1234, razon_social: "Corralón Ejemplo S.A.", cuit_receptor: null, concepto: "Cemento", neto_gravado: 1000, iva_21: 210, total: 1210, cae: null, cae_vencimiento: null, corresponde_a: null });

/** Cliente con un fetch simulado que guarda el pedido y devuelve `respuesta`. */
function fakeClient(respuesta: object) {
  const pedidos: { headers: Headers; body: any }[] = [];
  const client = new Anthropic({
    apiKey: "test",
    maxRetries: 0,
    fetch: async (_url, init) => {
      pedidos.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify(respuesta), { headers: { "content-type": "application/json" } });
    },
  });
  return { client, pedidos };
}

function mensaje(extra: object) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [{ type: "text", text: JSON.stringify(invoice) }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 3000, output_tokens: 400 },
    ...extra,
  };
}

const pdf = { name: "f.pdf", mediaType: "application/pdf", data: new Uint8Array([37, 80, 68, 70]) };

describe("extractInvoice", () => {
  it("manda el PDF con salida estructurada, esfuerzo bajo y fallback", async () => {
    const { client, pedidos } = fakeClient(mensaje({}));
    const r = await extractInvoice(pdf, { client, rubros: ["Materiales", "Honorarios"] });

    expect(r.invoice).toEqual(invoice);
    expect(r.fallback).toBe(false);
    const { headers, body } = pedidos[0];
    expect(headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.fallbacks).toBe("default");
    expect(body.output_config.effort).toBe("low");
    expect(body.output_config.format.type).toBe("json_schema");
    const schema = body.output_config.format.schema;
    expect(schema.properties.rubro.anyOf[0].enum).toEqual(["Materiales", "Honorarios"]);
    expect(schema.additionalProperties).toBe(false);
    expect(JSON.stringify(schema)).not.toMatch(/"(minimum|maximum|\$schema)"/);
    expect(body.messages[0].content[0]).toMatchObject({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: "JVBERg==" },
    });
  });

  it("falla con un error claro si el modelo rechaza", async () => {
    const { client } = fakeClient(
      mensaje({ content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: null, explanation: null } }),
    );
    await expect(extractInvoice(pdf, { client })).rejects.toMatchObject({ reason: "refusal" });
  });

  it("rechaza tipos de archivo no soportados", async () => {
    const { client } = fakeClient(mensaje({}));
    await expect(extractInvoice({ ...pdf, mediaType: "image/heic" }, { client })).rejects.toBeInstanceOf(ExtractionError);
  });
});
