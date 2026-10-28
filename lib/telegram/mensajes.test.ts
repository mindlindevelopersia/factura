import { describe, expect, it } from "vitest";
import { facturaDePrueba } from "../../test/fixtures";
import type { ItemCola } from "../cola/item";
import { secretoWebhook } from "./api";
import { adjuntoDe, codigoVinculo, emailDeCodigo, nombreDe, textoAviso } from "./mensajes";

const base = { message_id: 7, chat: { id: 1, type: "private" }, from: { id: 99, username: "tadeo" } };

describe("adjuntoDe", () => {
  it("acepta PDF e imágenes como documento", () => {
    expect(adjuntoDe({ ...base, document: { file_id: "f", file_name: "FC 1.pdf", mime_type: "application/pdf" } })).toEqual({
      fileId: "f",
      nombre: "FC 1.pdf",
      mediaType: "application/pdf",
    });
    expect(adjuntoDe({ ...base, document: { file_id: "f", mime_type: "image/png" } })).toMatchObject({ nombre: "factura-7.png" });
  });

  it("rechaza otros tipos y archivos de más de 20 MB", () => {
    expect(adjuntoDe({ ...base, document: { file_id: "f", mime_type: "application/zip" } })).toHaveProperty("error");
    expect(adjuntoDe({ ...base, document: { file_id: "f", mime_type: "application/pdf", file_size: 30_000_000 } })).toHaveProperty("error");
    expect(adjuntoDe({ ...base, document: { file_id: "f", mime_type: "image/jpeg", file_size: 6_000_000 } })).toHaveProperty("error");
    expect(adjuntoDe({ ...base, document: { file_id: "f", mime_type: "application/pdf", file_size: 6_000_000 } })).not.toHaveProperty("error");
  });

  it("de una foto, toma el tamaño más grande", () => {
    const photo = [
      { file_id: "chica", width: 90, height: 160 },
      { file_id: "grande", width: 1280, height: 2276 },
      { file_id: "media", width: 720, height: 1280 },
    ];
    expect(adjuntoDe({ ...base, photo })).toEqual({ fileId: "grande", nombre: "foto-7.jpg", mediaType: "image/jpeg" });
  });

  it("un mensaje de texto no trae comprobante", () => {
    expect(adjuntoDe({ ...base, text: "hola" })).toBeNull();
  });
});

describe("vinculación", () => {
  const emails = ["tadeo@mindlin.com", "ana@x.com"];
  it("el código identifica al mail y solo con el mismo secreto", () => {
    const codigo = codigoVinculo("Tadeo@Mindlin.com ", "secreto");
    expect(codigo).toMatch(/^[A-Za-z0-9_-]{32}$/); // lo que acepta el parámetro start de Telegram
    expect(emailDeCodigo(codigo, emails, "secreto")).toBe("tadeo@mindlin.com");
    expect(emailDeCodigo(codigo, emails, "otro")).toBeNull();
    expect(emailDeCodigo(codigo, ["ana@x.com"], "secreto")).toBeNull();
    expect(emailDeCodigo("corto", emails, "secreto")).toBeNull();
  });

  it("el secreto del webhook sale del token", () => {
    expect(secretoWebhook("123:abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(secretoWebhook("123:abc")).not.toBe(secretoWebhook("123:abd"));
  });

  it("nombre de quien manda", () => {
    expect(nombreDe(base)).toBe("@tadeo");
    expect(nombreDe({ ...base, from: { id: 1, first_name: "Ana", last_name: "Pérez" } })).toBe("Ana Pérez");
  });
});

describe("textoAviso", () => {
  const item: ItemCola = {
    id: "abc",
    recibida: "2026-10-29T15:00:00Z",
    origen: "telegram",
    enviadaPor: "@tadeo",
    archivo: { nombre: "FC.pdf", mediaType: "application/pdf", driveId: "d", url: "u" },
    estado: "pendiente",
    lectura: { factura: facturaDePrueba(), desde: null, fallback: false },
    error: null,
    resuelta: null,
    resueltaPor: null,
    resultado: { pestania: "Facturación de Egresos (Compras)", fila: 230, link: "u" },
    telegram: { chat: 1, mensaje: 7 },
  };

  it("resume la factura y deja el link para revisarla", () => {
    expect(textoAviso(item, "leida", "https://app", true)).toBe(
      "Leída: Corralón Ejemplo S.A. · Factura A 00005-00025853 · $45.140,27.\nOjo: parece que ya está cargada en la planilla.\nQuedó para revisar: https://app/?revisar=abc",
    );
  });

  it("avisa cuando se carga", () => {
    expect(textoAviso(item, "aprobada", "https://app")).toBe(
      "Cargada en la planilla: Corralón Ejemplo S.A. · Factura A 00005-00025853 · $45.140,27 (Facturación de Egresos (Compras), fila 230).",
    );
  });
});
