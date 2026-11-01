/**
 * Exportar una tabla del hub a Excel: una hoja por tabla, con los títulos en negrita, los datos tal
 * cual (en azul) y, abajo, los totales como fórmulas SUMA a la vista. Nada de fórmulas raras: lo
 * que se exporta es lo que se ve, para revisarlo o seguir trabajando en el Excel. Se arma en el
 * navegador (exceljs se carga recién al exportar).
 */

export type Formato = "texto" | "numero" | "pesos" | "usd" | "m2" | "pct" | "fecha";

export interface Columna {
  titulo: string;
  formato?: Formato;
  ancho?: number;
  /** Sumar esta columna al final (SUMA de toda la columna). */
  total?: boolean;
}

export interface Hoja {
  nombre: string;
  titulo?: string;
  columnas: Columna[];
  filas: (string | number | null | undefined)[][];
}

const FORMATOS: Record<Formato, string | undefined> = {
  texto: undefined,
  numero: "#,##0.##",
  pesos: '"$" #,##0;[Red]-"$" #,##0',
  usd: '"US$" #,##0;[Red]-"US$" #,##0',
  m2: "#,##0.00",
  pct: "0.0%",
  fecha: "dd/mm/yyyy",
};

const letra = (i: number) => {
  let s = "";
  let x = i + 1;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
};

/** Una fecha "2026-03-14" pasa a fecha de Excel (para poder ordenar y filtrar); el resto, tal cual. */
const valor = (v: string | number | null | undefined, f: Formato | undefined) => {
  if (v === null || v === undefined || v === "") return null;
  if (f === "fecha" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(`${v.slice(0, 10)}T12:00:00Z`);
  return v;
};

export async function exportarTablas(hojas: Hoja[]): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Hub Mindlin Developers";
  for (const h of hojas) {
    // Excel no acepta algunos caracteres en el nombre de la hoja y lo corta en 31.
    const ws = wb.addWorksheet(h.nombre.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
    ws.columns = h.columnas.map((c) => ({ width: c.ancho ?? (c.formato && c.formato !== "texto" ? 15 : 22) }));
    let inicio = 1;
    if (h.titulo) {
      ws.addRow([h.titulo]).font = { bold: true, size: 14 };
      ws.addRow([`Exportado del hub el ${new Date().toLocaleString("es-AR")}.`]);
      ws.addRow([]);
      inicio = 4;
    }
    const enc = ws.addRow(h.columnas.map((c) => c.titulo));
    enc.font = { bold: true };
    enc.alignment = { wrapText: true, vertical: "middle" };
    for (const f of h.filas) {
      const r = ws.addRow(h.columnas.map((c, i) => valor(f[i], c.formato)));
      h.columnas.forEach((c, i) => {
        const cel = r.getCell(i + 1);
        const fmt = c.formato ? FORMATOS[c.formato] : undefined;
        if (fmt) cel.numFmt = fmt;
        if (typeof cel.value === "number") cel.font = { color: { argb: "FF0050A0" } };
      });
    }
    const desde = inicio + 1;
    const hasta = inicio + h.filas.length;
    if (h.columnas.some((c) => c.total) && h.filas.length) {
      const t = ws.addRow(h.columnas.map((c, i) => (i === 0 ? "Total" : c.total ? { formula: `SUM(${letra(i)}${desde}:${letra(i)}${hasta})` } : null)));
      t.font = { bold: true };
      h.columnas.forEach((c, i) => {
        const fmt = c.formato ? FORMATOS[c.formato] : undefined;
        if (c.total && fmt) t.getCell(i + 1).numFmt = fmt;
      });
    }
    ws.views = [{ state: "frozen", ySplit: inicio, xSplit: 1 }];
    if (h.filas.length) ws.autoFilter = { from: { row: inicio, column: 1 }, to: { row: hasta, column: h.columnas.length } };
  }
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** Baja el archivo en el navegador. */
export function descargar(blob: Blob, nombre: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre.endsWith(".xlsx") ? nombre : `${nombre}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
