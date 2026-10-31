/**
 * El dólar de hoy: oficial, blue y MEP, con compra y venta. Se lee en línea (DolarApi y, si falla,
 * ArgentinaDatos) y se usa para mostrar en dólares lo que está en pesos, al MEP del día.
 * Todo lo de acá es puro (sin red): la lectura está en lib/finanzas/fuente.ts.
 */

export type Casa = "oficial" | "blue" | "mep";

export interface Cotizacion {
  casa: Casa;
  nombre: string;
  compra: number | null;
  venta: number | null;
  /** Cuándo se actualizó en la fuente (ISO). */
  fecha: string | null;
  fuente: string;
}

export const CASAS: { casa: Casa; nombre: string; dolarApi: string; argentinaDatos: string }[] = [
  { casa: "oficial", nombre: "Dólar oficial", dolarApi: "oficial", argentinaDatos: "oficial" },
  { casa: "blue", nombre: "Dólar blue", dolarApi: "blue", argentinaDatos: "blue" },
  { casa: "mep", nombre: "Dólar MEP", dolarApi: "bolsa", argentinaDatos: "bolsa" },
];

export const FUENTES_DOLAR = {
  dolarApi: { url: "https://dolarapi.com/v1/dolares", nombre: "DolarApi" },
  argentinaDatos: { url: (casa: string) => `https://api.argentinadatos.com/v1/cotizaciones/dolares/${casa}`, nombre: "ArgentinaDatos" },
};

const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
const texto = (v: unknown) => (typeof v === "string" && v ? v : null);

/** DolarApi: [{ casa: "oficial", compra, venta, fechaActualizacion }, …]. */
export function deDolarApi(datos: unknown): Cotizacion[] {
  if (!Array.isArray(datos)) return [];
  return CASAS.flatMap((c) => {
    const d = datos.find((x) => x && typeof x === "object" && (x as { casa?: unknown }).casa === c.dolarApi) as Record<string, unknown> | undefined;
    if (!d || (numero(d.compra) == null && numero(d.venta) == null)) return [];
    return [{ casa: c.casa, nombre: c.nombre, compra: numero(d.compra), venta: numero(d.venta), fecha: texto(d.fechaActualizacion), fuente: FUENTES_DOLAR.dolarApi.nombre }];
  });
}

/** ArgentinaDatos: la historia de una casa [{ compra, venta, fecha: "2026-10-30" }, …]: se toma la última. */
export function deArgentinaDatos(casa: Casa, datos: unknown): Cotizacion | null {
  if (!Array.isArray(datos)) return null;
  const c = CASAS.find((x) => x.casa === casa)!;
  const ultimo = [...datos]
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && (numero((x as Record<string, unknown>).venta) != null || numero((x as Record<string, unknown>).compra) != null))
    .sort((a, b) => String(a.fecha ?? "").localeCompare(String(b.fecha ?? "")))
    .at(-1);
  if (!ultimo) return null;
  return { casa, nombre: c.nombre, compra: numero(ultimo.compra), venta: numero(ultimo.venta), fecha: texto(ultimo.fecha), fuente: FUENTES_DOLAR.argentinaDatos.nombre };
}

/** Pesos a dólares: al precio de venta (lo que cuesta comprar los dólares con esos pesos). */
export function aDolares(pesos: number, cotizacion: Pick<Cotizacion, "venta"> | null | undefined): number | null {
  return cotizacion?.venta ? pesos / cotizacion.venta : null;
}

/** La brecha del blue (o el MEP) contra el oficial, a precio de venta. */
export function brecha(de: Cotizacion | undefined, contra: Cotizacion | undefined): number | null {
  return de?.venta && contra?.venta ? de.venta / contra.venta - 1 : null;
}
