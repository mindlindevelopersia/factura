/**
 * Las fichas de cada operación, debajo de la tabla de "Ventas" en el Excel madre: nombre, "Base cac
 * MAYO 2025", unidad funcional, monto de la operación y el cuadro "Concepto | USD | ARS | %" con el
 * valor estimado y los aportes blanco y negro (o formal e informal). Tienen formas algo distintas
 * entre sí: se lee por etiquetas en la columna A. Todo lo de acá es puro (sin red).
 */

import type { Celda } from "../finanzas/ingresos";

export interface FichaVenta {
  nombre: string;
  unidad: string | null;
  /** "2025-05". */
  mesBase: string | null;
  costoUsd: number | null;
  /** El valor estimado en pesos del contrato (solo en las fichas más nuevas). */
  costoArs: number | null;
  formalUsd: number | null;
  informalUsd: number | null;
  /** Fila del "Valor estimado" (desde 1). */
  fila: number;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function normalizar(t: unknown): string {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
const num = (c: Celda | undefined) => (typeof c?.valor === "number" ? c.valor : null);
/** La columna de pesos: en las fichas viejas ahí va el porcentaje (1, 0,65…), que no es un monto. */
const pesos = (c: Celda | undefined) => {
  const n = num(c);
  return n != null && n > 1000 ? n : null;
};

export function mesDeBaseCac(texto: string): string | null {
  const m = normalizar(texto).match(/base cac\s+([a-z]+)\s+(\d{4})/);
  if (!m) return null;
  const i = MESES.indexOf(m[1]);
  return i < 0 ? null : `${m[2]}-${String(i + 1).padStart(2, "0")}`;
}

export function leerFichasVentas(filas: Celda[][]): FichaVenta[] {
  const fichas: FichaVenta[] = [];
  // Las fichas empiezan después de la primera línea "-----" (antes está la tabla de Ventas).
  let r = filas.findIndex((f) => /^-{5,}/.test(String(f[0]?.valor ?? "").trim()));
  if (r < 0) return fichas;
  let nombre = "";
  let unidad: string | null = null;
  let mesBase: string | null = null;
  let esperoNombre = true;
  for (r = r + 1; r < filas.length; r++) {
    const f = filas[r];
    const a = String(f[0]?.valor ?? "").trim();
    if (!a) continue;
    const n = normalizar(a);
    if (/^-{5,}/.test(a)) {
      esperoNombre = true;
      unidad = null;
      mesBase = null;
      continue;
    }
    if (esperoNombre && !a.startsWith("-") && !n.startsWith("unidad funcional")) {
      // Lo que sigue a "CAIDOS:" son operaciones que no se hicieron.
      if (n.startsWith("caidos")) break;
      nombre = a;
      esperoNombre = false;
      continue;
    }
    const base = mesDeBaseCac(a);
    if (base) {
      mesBase = base;
      continue;
    }
    if (n.startsWith("unidad funcional")) {
      const siguiente = filas.slice(r + 1).find((x) => String(x[0]?.valor ?? "").trim());
      unidad = siguiente ? String(siguiente[0]?.valor ?? "").trim().toUpperCase() : null;
      continue;
    }
    if (n.startsWith("valor estimado")) {
      const fila = (etiqueta: RegExp) => {
        for (let k = r + 1; k < Math.min(filas.length, r + 4); k++) if (etiqueta.test(normalizar(filas[k][0]?.valor))) return filas[k];
        return undefined;
      };
      const formal = fila(/^(aporte (blanco|formal)|valor blanco|aporte a)$/);
      const informal = fila(/^(aporte (en )?negro|aporte informal|aporte b)$/);
      fichas.push({
        nombre,
        unidad,
        mesBase,
        costoUsd: num(f[1]),
        costoArs: pesos(f[2]),
        formalUsd: num(formal?.[1]),
        informalUsd: num(informal?.[1]),
        fila: r + 1,
      });
      // Si en la misma ficha hay otro cuadro (una variante), sin unidad propia no se usa.
      unidad = null;
    }
  }
  return fichas.filter((x) => x.costoUsd != null);
}
