import { describe, expect, it } from "vitest";
import { facturaDePrueba } from "../../test/fixtures";
import type { ItemCola } from "../cola/item";
import { secretoWebhook } from "./api";
import { adjuntoDe, audioDe, codigoVinculo, emailDeCodigo, nombreDe, TEXTOS, textoAviso } from "./mensajes";

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

  it("reconoce notas de voz y archivos de audio", () => {
    expect(audioDe({ ...base, voice: { file_id: "v", mime_type: "audio/ogg", duration: 12 } })).toEqual({
      fileId: "v",
      nombre: "audio-7.ogg",
      mediaType: "audio/ogg",
    });
    expect(audioDe({ ...base, audio: { file_id: "a", mime_type: "audio/mpeg", file_name: "explicacion.mp3" } })).toMatchObject({
      nombre: "explicacion.mp3",
    });
    expect(audioDe({ ...base, text: "hola" })).toBeNull();
  });
});

describe("vinculación", () => {
  const emails = ["tadeo@mindlin.com", "ana@x.com"];
  it("el código identifica al mail, solo con el mismo secreto y por una hora", () => {
    const ahora = new Date("2026-10-29T15:00:00Z");
    const codigo = codigoVinculo("Tadeo@Mindlin.com ", "secreto", ahora);
    expect(codigo).toMatch(/^[A-Za-z0-9_-]{1,64}$/); // lo que acepta el parámetro start de Telegram
    expect(emailDeCodigo(codigo, emails, "secreto", ahora)).toBe("tadeo@mindlin.com");
    expect(emailDeCodigo(codigo, emails, "secreto", new Date("2026-10-29T15:59:00Z"))).toBe("tadeo@mindlin.com");
    expect(emailDeCodigo(codigo, emails, "secreto", new Date("2026-10-29T16:01:00Z"))).toBeNull();
    expect(emailDeCodigo(codigo, emails, "otro", ahora)).toBeNull();
    expect(emailDeCodigo(codigo, ["ana@x.com"], "secreto", ahora)).toBeNull();
    expect(emailDeCodigo("corto", emails, "secreto", ahora)).toBeNull();
    // No se puede estirar el vencimiento: la firma lo incluye.
    const firmaOriginal = codigo.slice(codigo.indexOf("_") + 1); // la firma también puede tener "_"
    const estirado = `${(Math.floor(ahora.getTime() / 1000) + 86400).toString(36)}_${firmaOriginal}`;
    expect(emailDeCodigo(estirado, emails, "secreto", ahora)).toBeNull();
  });

  it("el secreto del webhook sale del token", () => {
    expect(secretoWebhook("123:abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(secretoWebhook("123:abc")).not.toBe(secretoWebhook("123:abd"));
  });

  it("a quien no está conectado le explica cómo hacerlo, con el link a la web", () => {
    expect(TEXTOS.noVinculado("https://mindlin-developers.vercel.app")).toContain('https://mindlin-developers.vercel.app/proyectos/lerma-439/administracion/facturas , pestaña "Subir"');
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
    huella: "h",
    notas: [],
  };

  it("resume la factura y deja el link para revisarla", () => {
    expect(textoAviso(item, "leida", "https://app", { duplicado: true, repetida: null })).toBe(
      "Leída: Corralón Ejemplo S.A. · Factura A 00005-00025853 · $45.140,27.\nOjo: parece que ya está cargada en la planilla.\nQuedó para revisar: https://app/proyectos/lerma-439/administracion/facturas?revisar=abc",
    );
  });

  it("avisa si ya la habían mandado", () => {
    const antes = { ...item, id: "otra", enviadaPor: "@juan", recibida: "2026-10-29T13:00:00Z" };
    expect(textoAviso(item, "leida", "https://app", { duplicado: false, repetida: antes })).toContain(
      "Ojo: esta factura ya la habían mandado: llegó el 29/10, 10:00 (lo mandó @juan) y está para revisar.",
    );
    expect(TEXTOS.repetida({ ...antes, estado: "aprobada", resultado: { pestania: "x", fila: 230, link: null } })).toBe(
      "Esta factura ya la tengo: ya está cargado en la fila 230 (lo mandó @juan). No la cargo de nuevo.",
    );
  });

  it("avisa cuando se carga", () => {
    expect(textoAviso(item, "aprobada", "https://app")).toBe(
      "Cargada en la planilla: Corralón Ejemplo S.A. · Factura A 00005-00025853 · $45.140,27 (Facturación de Egresos (Compras), fila 230).",
    );
  });
});
