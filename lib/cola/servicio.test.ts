import { describe, expect, it } from "vitest";
import { CONSTRUCTORA, CUIT_MINDLIN, facturaDePrueba, invoiceDePrueba } from "../../test/fixtures";
import { ExtractionError, type ExtractionResult } from "../invoice/extract";
import type { Invoice } from "../invoice/schema";
import type { DatosFila } from "../sheets/columnas";
import type { Planilla } from "../sheets/planilla";
import { leerRegistros } from "../sheets/registros";
import type { Almacen, Destino } from "../storage/archivos";
import type { Cola } from "./hoja";
import { aFilaCola, deFilaCola, type ItemCola } from "./item";
import { aprobar, descartar, ErrorCola, ingresar, listar, reintentar, type Aviso, type Servicios } from "./servicio";

/** La cola en memoria, pasando por la misma conversión a filas que la planilla. */
class ColaEnMemoria implements Cola {
  filas: string[][] = [];
  async listar() {
    return this.filas.map((f) => deFilaCola(f)!);
  }
  async obtener(id: string) {
    return (await this.listar()).find((i) => i.id === id) ?? null;
  }
  async agregar(item: ItemCola) {
    this.filas.push(aFilaCola(item));
  }
  async guardar(item: ItemCola) {
    const i = this.filas.findIndex((f) => f[0] === item.id);
    this.filas[i] = aFilaCola(item);
  }
}

class AlmacenEnMemoria implements Almacen {
  archivos = new Map<string, { nombre: string; mediaType: string; data: Uint8Array; carpeta: string }>();
  movimientos: Destino[] = [];
  async guardarPendiente(a: { nombre: string; mediaType: string; data: Uint8Array }) {
    const id = `drive-${this.archivos.size + 1}`;
    this.archivos.set(id, { ...a, carpeta: "pendientes" });
    return { id, url: `https://drive/${id}` };
  }
  async leer(id: string) {
    const a = this.archivos.get(id)!;
    return { nombre: a.nombre, mediaType: a.mediaType, data: a.data };
  }
  async archivar(id: string, destino: Destino) {
    this.movimientos.push(destino);
    this.archivos.get(id)!.carpeta = `${destino.carpeta}/${destino.subcarpeta}`;
    return { url: `https://drive/${id}` };
  }
  async descartar(id: string) {
    this.archivos.get(id)!.carpeta = "papelera";
  }
}

class PlanillaEnMemoria implements Planilla {
  filas: DatosFila[] = [];
  constructor(private readonly egresos: string[][] = [], private readonly conIngresos = true) {}
  tiene(p: "egresos" | "ingresos") {
    return p === "egresos" || this.conIngresos;
  }
  async registros() {
    return leerRegistros(this.egresos, []);
  }
  async agregar(d: DatosFila) {
    this.filas.push(d);
    return { pestania: d.factura.categoria === "venta" ? "Ventas" : "Compras", fila: 229 + this.filas.length };
  }
}

function servicios(opciones: { leida?: Invoice; error?: Error; egresos?: string[][]; conIngresos?: boolean } = {}) {
  const avisos: { aviso: Aviso; id: string; duplicado: boolean }[] = [];
  const s = {
    cola: new ColaEnMemoria(),
    almacen: new AlmacenEnMemoria(),
    planilla: new PlanillaEnMemoria(opciones.egresos, opciones.conIngresos),
    extraer: async (): Promise<ExtractionResult> => {
      if (opciones.error) throw opciones.error;
      return { invoice: opciones.leida ?? invoiceDePrueba(), model: "m", fallback: false, usage: { input_tokens: 1, output_tokens: 1 } };
    },
    avisar: async (item: ItemCola, aviso: Aviso, { duplicado }: { duplicado: boolean }) => {
      avisos.push({ aviso, id: item.id, duplicado });
    },
    ahora: () => new Date("2026-10-29T15:00:00Z"),
  } satisfies Servicios;
  return { s, avisos };
}

const pdf = { nombre: "FC 25853.pdf", mediaType: "application/pdf", data: new Uint8Array([1, 2, 3]) };

describe("ingresar", () => {
  it("guarda el archivo en pendientes, lo encola y lo lee", async () => {
    const { s, avisos } = servicios();
    const item = await ingresar(s, { archivo: pdf, origen: "web", enviadaPor: "ana@x.com" });
    expect(item.estado).toBe("pendiente");
    expect(item.lectura?.factura).toMatchObject({ categoria: "compra", razon_social: "Corralón Ejemplo S.A." });
    expect(s.almacen.archivos.get(item.archivo.driveId)?.carpeta).toBe("pendientes");
    expect(await s.cola.obtener(item.id)).toEqual(item);
    expect(avisos).toEqual([{ aviso: "leida", id: item.id, duplicado: false }]);
  });

  it("si la IA falla, queda en error con el archivo guardado", async () => {
    const { s, avisos } = servicios({ error: new ExtractionError("La respuesta se cortó", "max_tokens") });
    const item = await ingresar(s, { archivo: pdf, origen: "telegram", enviadaPor: "@ana", telegram: { chat: 1, mensaje: 2 } });
    expect(item).toMatchObject({ estado: "error", error: "La respuesta se cortó", telegram: { chat: 1, mensaje: 2 } });
    expect(s.almacen.archivos.size).toBe(1);
    expect(avisos[0].aviso).toBe("error");
  });

  it("avisa si ya está cargada en la planilla", async () => {
    const egresos = [["Factura A", "00005-00025853", "Corralón", "Materiales", "33-69345023-9", "Cemento", "Lerma 439"]];
    const { s, avisos } = servicios({ egresos });
    await ingresar(s, { archivo: pdf, origen: "telegram", enviadaPor: "@ana" });
    expect(avisos[0].duplicado).toBe(true);
    expect((await listar(s)).pendientes[0].cargada).toEqual({ tipo: "duplicada", fila: 2 });
  });
});

describe("aprobar", () => {
  it("carga la fila, archiva en la subcarpeta del mes y pasa al historial", async () => {
    const { s, avisos } = servicios();
    const { id } = await ingresar(s, { archivo: pdf, origen: "web", enviadaPor: "ana@x.com" });
    const revisada = facturaDePrueba({ concepto: "Cemento x 5" });
    const item = await aprobar(s, id, revisada, "tadeo@x.com");

    expect(s.planilla.filas[0]).toEqual({ factura: revisada, link: `https://drive/${item.archivo.driveId}`, fechaRegistro: "2026-10-29" });
    expect(s.almacen.movimientos).toEqual([
      { carpeta: "compra", subcarpeta: "Facturas Compras Octubre 2026", nombre: "2026-10-01 Corralón Ejemplo S.A. - Factura A 00005-00025853.pdf" },
    ]);
    expect(item).toMatchObject({ estado: "aprobada", resueltaPor: "tadeo@x.com", resultado: { pestania: "Compras", fila: 230 } });
    expect(item.lectura?.factura.concepto).toBe("Cemento x 5");
    const { pendientes, historial } = await listar(s);
    expect(pendientes).toEqual([]);
    expect(historial.map((i) => i.id)).toEqual([id]);
    expect(avisos.map((a) => a.aviso)).toEqual(["leida", "aprobada"]);
  });

  it("no aprueba dos veces", async () => {
    const { s } = servicios();
    const { id } = await ingresar(s, { archivo: pdf, origen: "web", enviadaPor: "a" });
    await aprobar(s, id, facturaDePrueba(), "a");
    await expect(aprobar(s, id, facturaDePrueba(), "a")).rejects.toMatchObject({ status: 409 });
    expect(s.planilla.filas).toHaveLength(1);
  });

  it("rechaza un duplicado de la planilla sin mover el archivo", async () => {
    const egresos = [["Factura A", "00005-00025853", "Corralón", "Materiales", "33-69345023-9", "Cemento", "Lerma 439"]];
    const { s } = servicios({ egresos });
    const { id } = await ingresar(s, { archivo: pdf, origen: "web", enviadaPor: "a" });
    await expect(aprobar(s, id, facturaDePrueba(), "a")).rejects.toBeInstanceOf(ErrorCola);
    expect(s.almacen.movimientos).toEqual([]);
    expect((await s.cola.obtener(id))?.estado).toBe("pendiente");
  });

  it("una venta necesita la pestaña de ingresos", async () => {
    const leida = invoiceDePrueba({ cuit: CUIT_MINDLIN, cuit_receptor: CONSTRUCTORA.cuit, punto_venta: 2, numero: 6 });
    const { s } = servicios({ leida, conIngresos: false });
    const item = await ingresar(s, { archivo: pdf, origen: "web", enviadaPor: "a" });
    expect(item.lectura?.factura.categoria).toBe("venta");
    await expect(aprobar(s, item.id, item.lectura!.factura, "a")).rejects.toMatchObject({ status: 503 });
  });
});

describe("descartar y reintentar", () => {
  it("descartar manda el archivo a la papelera", async () => {
    const { s } = servicios();
    const { id, archivo } = await ingresar(s, { archivo: pdf, origen: "web", enviadaPor: "a" });
    const item = await descartar(s, id, "tadeo@x.com");
    expect(item).toMatchObject({ estado: "descartada", resueltaPor: "tadeo@x.com" });
    expect(s.almacen.archivos.get(archivo.driveId)?.carpeta).toBe("papelera");
    await expect(descartar(s, id, "x")).rejects.toMatchObject({ status: 409 });
  });

  it("reintentar vuelve a leer desde Drive", async () => {
    const { s } = servicios({ error: new Error("caído") });
    const { id } = await ingresar(s, { archivo: pdf, origen: "web", enviadaPor: "a" });
    s.extraer = async () => ({ invoice: invoiceDePrueba(), model: "m", fallback: true, usage: { input_tokens: 1, output_tokens: 1 } });
    const item = await reintentar(s, id);
    expect(item).toMatchObject({ estado: "pendiente", error: null, lectura: { fallback: true } });
  });

  it("una lectura que quedó colgada se muestra como error", async () => {
    const { s } = servicios();
    await s.cola.agregar({
      id: "x",
      recibida: "2026-10-29T14:00:00Z",
      origen: "web",
      enviadaPor: "a",
      archivo: { nombre: "a.pdf", mediaType: "application/pdf", driveId: "d", url: "u" },
      estado: "leyendo",
      lectura: null,
      error: null,
      resuelta: null,
      resueltaPor: null,
      resultado: null,
      telegram: null,
    });
    expect((await listar(s)).pendientes[0]).toMatchObject({ estado: "error", error: "La lectura no terminó. Reintentá." });
  });
});

describe("filas de la cola", () => {
  it("ida y vuelta sin perder nada", async () => {
    const { s } = servicios();
    const item = await ingresar(s, { archivo: pdf, origen: "telegram", enviadaPor: "@ana (ana@x.com)", telegram: { chat: 123, mensaje: 45 } });
    expect(deFilaCola(aFilaCola(item))).toEqual(item);
  });

  it("una fila sin ID se ignora y un estado desconocido pasa a error", () => {
    expect(deFilaCola(["", "x"])).toBeNull();
    expect(deFilaCola(["id", "", "web", "", "", "", "", "", "raro"])?.estado).toBe("error");
  });
});
