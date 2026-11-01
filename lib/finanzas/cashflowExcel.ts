/**
 * El cash flow en Excel, con fórmulas simples a la vista: cada partida con sus valores por mes, los
 * grupos y los totales con SUMA, el flujo neto (ingresos − egresos) y la caja acumulada (la del mes
 * anterior + el flujo del mes). En lo real, una hoja con cada movimiento. Se arma en el navegador.
 */

import { GRUPOS, type Partida } from "./cashflow";
import { nombreMes } from "./ingresos";

export async function exportarCashFlow(o: {
  titulo: string;
  vista: string;
  moneda: "USD" | "ARS";
  meses: string[];
  partidas: Partida[];
  /** La caja acumulada antes del primer mes exportado (si se exporta un año, lo que venía de antes). */
  cajaInicial: number;
  /** En "Proyectado vs real": las dos listas. */
  comparar?: { proyectado: Partida[]; real: Partida[] };
}): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Hub Mindlin Developers";
  const campo = o.moneda === "USD" ? "usd" : "ars";
  const formato = o.moneda === "USD" ? '"US$" #,##0;[Red]-"US$" #,##0' : '"$" #,##0;[Red]-"$" #,##0';
  const n = o.meses.length;
  const col = (i: number) => {
    let s = "";
    let x = i + 1;
    while (x > 0) {
      const r = (x - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      x = Math.floor((x - 1) / 26);
    }
    return s;
  };
  // Columna A: concepto; B…: meses; la última: total.
  const cMes = (i: number) => col(i + 1);
  const cTotal = col(n + 1);

  const ws = wb.addWorksheet("Cash flow");
  ws.columns = [{ width: 42 }, ...o.meses.map(() => ({ width: 14 })), { width: 16 }];
  ws.addRow([`${o.titulo} · ${o.vista} · ${o.moneda === "USD" ? "en dólares" : "en pesos"}`]).font = { bold: true, size: 14 };
  ws.addRow([`Exportado del hub el ${new Date().toLocaleString("es-AR")}. Los números en azul son datos; los totales, el flujo y la caja son fórmulas.`]);
  const enc = ws.addRow(["Concepto", ...o.meses.map((m) => nombreMes(m, true)), "Total"]);
  enc.font = { bold: true };

  const valores = (r: Record<string, number>) => o.meses.map((m) => Math.round((r[m] ?? 0) * 100) / 100);
  const filaDatos = (nombre: string, r: Record<string, number>, sangria = 2) => {
    const fila = ws.addRow([`${" ".repeat(sangria)}${nombre}`, ...valores(r)]);
    const k = fila.number;
    fila.getCell(n + 2).value = { formula: `SUM(B${k}:${cMes(n - 1)}${k})` };
    for (let i = 0; i < n; i++) fila.getCell(i + 2).font = { color: { argb: "FF0050A0" } };
    return k;
  };
  const filaSuma = (nombre: string, filas: number[], bold = true) => {
    const fila = ws.addRow([nombre]);
    const k = fila.number;
    for (let i = 0; i < n; i++) fila.getCell(i + 2).value = { formula: filas.length ? filas.map((x) => `${cMes(i)}${x}`).join("+") : "0" };
    fila.getCell(n + 2).value = { formula: `SUM(B${k}:${cMes(n - 1)}${k})` };
    if (bold) fila.font = { bold: true };
    return k;
  };

  const bloque = (tipo: "ingreso" | "egreso", lista: Partida[], nombre: string) => {
    const grupos: number[] = [];
    for (const g of GRUPOS.filter((x) => x.tipo === tipo && lista.some((p) => p.grupo === x.clave))) {
      const items = lista.filter((p) => p.grupo === g.clave).map((p) => filaDatos(p.nombre, p[campo], 4));
      grupos.push(filaSuma(`  ${g.nombre}`, items));
    }
    return filaSuma(nombre.toUpperCase(), grupos);
  };

  if (o.comparar) {
    const ip = bloque("ingreso", o.comparar.proyectado, "Ingresos proyectados");
    const ir = bloque("ingreso", o.comparar.real, "Ingresos reales");
    const ep = bloque("egreso", o.comparar.proyectado, "Egresos proyectados");
    const er = bloque("egreso", o.comparar.real, "Egresos reales");
    ws.addRow([]);
    const dif = (nombre: string, a: number, b: number) => {
      const fila = ws.addRow([nombre]);
      for (let i = 0; i < n; i++) fila.getCell(i + 2).value = { formula: `${cMes(i)}${b}-${cMes(i)}${a}` };
      fila.getCell(n + 2).value = { formula: `${cTotal}${b}-${cTotal}${a}` };
      fila.font = { bold: true };
    };
    dif("Diferencia en ingresos (real − proyectado)", ip, ir);
    dif("Diferencia en egresos (real − proyectado)", ep, er);
  } else {
    const ing = bloque("ingreso", o.partidas, "Ingresos");
    const egr = bloque("egreso", o.partidas, "Egresos");
    ws.addRow([]);
    const neto = ws.addRow(["FLUJO NETO (ingresos − egresos)"]);
    for (let i = 0; i < n; i++) neto.getCell(i + 2).value = { formula: `${cMes(i)}${ing}-${cMes(i)}${egr}` };
    neto.getCell(n + 2).value = { formula: `${cTotal}${ing}-${cTotal}${egr}` };
    neto.font = { bold: true };
    const ini = ws.addRow(["Caja al inicio", Math.round(o.cajaInicial * 100) / 100]);
    ini.getCell(2).font = { color: { argb: "FF0050A0" } };
    const caja = ws.addRow(["CAJA ACUMULADA (la del mes anterior + el flujo del mes)"]);
    for (let i = 0; i < n; i++) caja.getCell(i + 2).value = { formula: i === 0 ? `B${ini.number}+B${neto.number}` : `${cMes(i - 1)}${caja.number}+${cMes(i)}${neto.number}` };
    caja.font = { bold: true };
  }
  ws.eachRow((r, k) => {
    if (k > 3) for (let i = 2; i <= n + 2; i++) r.getCell(i).numFmt = formato;
  });
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 3 }];

  // Los movimientos de lo real (de dónde sale cada número).
  const movs = (o.comparar?.real ?? o.partidas).flatMap((p) => (p.movimientos ?? []).filter((x) => o.meses.includes(x.fecha.slice(0, 7))).map((x) => ({ ...x, partida: p.nombre })));
  if (movs.length) {
    const wm = wb.addWorksheet("Movimientos");
    wm.columns = [{ width: 12 }, { width: 30 }, { width: 50 }, { width: 8 }, { width: 16 }, { width: 16 }, { width: 16 }];
    wm.addRow(["Fecha", "Partida", "Detalle", "Moneda", "Monto", "En US$", "En $"]).font = { bold: true };
    for (const x of movs.sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      const r = wm.addRow([x.fecha, x.partida, x.texto, x.moneda, x.monto, Math.round(x.usd * 100) / 100, Math.round(x.ars)]);
      r.getCell(5).numFmt = "#,##0.00";
      r.getCell(6).numFmt = '"US$" #,##0';
      r.getCell(7).numFmt = '"$" #,##0';
    }
    wm.views = [{ state: "frozen", ySplit: 1 }];
  }
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
