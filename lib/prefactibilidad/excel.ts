/**
 * La prefactibilidad en Excel, con fórmulas simples (sumas, multiplicaciones y SUMAR.SI) que
 * apuntan a celdas a la vista: para revisarla o seguir jugando con los números en el Excel.
 * Se arma en el navegador (exceljs se carga recién al exportar).
 */

import type { Prefactibilidad } from "./modelo";

type Celda = string | number | null | { formula: string };

export async function exportarPrefactibilidad(p: Prefactibilidad, extra: { uva: { valor: number; fecha: string } | null; mep: number | null }): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Hub Mindlin Developers";
  const d = p.datos;
  const negrita = { bold: true };
  const m2 = "#,##0.00";
  const pct = "0.0%";
  const pesos = '"$" #,##0';
  const usd = '"US$" #,##0';

  const hoja = (nombre: string, anchos: number[]) => {
    const ws = wb.addWorksheet(nombre);
    ws.columns = anchos.map((width) => ({ width }));
    return ws;
  };
  const fila = (ws: ReturnType<typeof hoja>, valores: Celda[], formatos: (string | null)[] = [], bold = false) => {
    const r = ws.addRow(valores);
    formatos.forEach((f, i) => {
      if (f) r.getCell(i + 1).numFmt = f;
    });
    if (bold) r.font = negrita;
    return r.number;
  };
  const titulo = (ws: ReturnType<typeof hoja>, texto: string) => {
    const r = ws.addRow([texto]);
    r.font = { bold: true, size: 14 };
  };

  // Lote y normativa.
  const lote = hoja("Lote", [34, 16, 16, 16]);
  titulo(lote, `${p.nombre} · Lote y normativa`);
  const nv = d.normativa;
  const datosLote: [string, Celda][] = [
    ["Dirección", d.direccion],
    ["Ciudad", d.ciudad],
    ["Fecha", d.fecha],
    ["Distrito", nv.distrito],
    ["Tipología edilicia", nv.tipologia],
    ["Zonificación", nv.zonificacion],
    ["Basamento", nv.basamento],
    ["FOT", nv.fot],
    ["FOS", nv.fos],
    ["Densidad", nv.densidad],
    ["Cochera obligatoria", nv.cocheraObligatoria],
    ["Premio", nv.premio],
    ["Altura máxima (m)", nv.alturaMaxima],
    ["Pisos máximos", nv.pisosMaximos],
    ["Retiros", nv.retiros],
    ["LFI", nv.lfi],
    ["Protección histórica", nv.proteccionHistorica],
    ["FOS del proyecto (m²)", d.fosProyecto],
    ["Carpeta de Drive", p.carpeta],
  ];
  let filaFot = 0;
  let filaFos = 0;
  for (const [k, v] of datosLote) {
    const n = fila(lote, [k, v]);
    if (k === "FOT") filaFot = n;
    if (k === "FOS") filaFos = n;
  }
  lote.addRow([]);
  fila(lote, ["Terreno", "Frente (m)", "Fondo (m)", "Superficie (m²)"], [], true);
  const iniT = lote.rowCount + 1;
  for (const t of d.terrenos) {
    const n = lote.rowCount + 1;
    fila(lote, [t.nombre, t.frente, t.fondo, { formula: `B${n}*C${n}` }], [null, m2, m2, m2]);
  }
  const filaTerreno = fila(lote, ["Superficie del terreno", null, null, { formula: `SUM(D${iniT}:D${lote.rowCount})` }], [null, null, null, m2], true);
  const refTerreno = `Lote!D${filaTerreno}`;
  fila(lote, ["FOS permitido (terreno × FOS)", null, null, { formula: `${refTerreno.split("!")[1]}*B${filaFos}` }], [null, null, null, m2]);
  fila(lote, ["Lo que permite el FOT (terreno × FOT)", null, null, { formula: `${refTerreno.split("!")[1]}*B${filaFot}` }], [null, null, null, m2]);

  // Descubiertas de lo construible (cada una con su %).
  const descC = hoja("Descubiertas construibles", [18, 22, 14, 12, 16]);
  fila(descC, ["Piso", "Descubierta", "m²", "% computa", "m² que computan"], [], true);
  for (const pi of d.pisos)
    for (const x of pi.descubiertas) {
      const n = descC.rowCount + 1;
      fila(descC, [pi.nombre, x.nombre, x.m2, x.computa, { formula: `C${n}*D${n}` }], [null, null, m2, pct, m2]);
    }

  // Construibles por piso.
  const cons = hoja("Construibles", [18, 14, 14, 18, 20, 10, 16]);
  fila(cons, ["Piso", "Cubierta", "Semicubierta", "Descubierta (100%)", "Descubierta que computa", "GCBA", "Total del piso"], [], true);
  const iniC = 2;
  for (const pi of d.pisos) {
    const n = cons.rowCount + 1;
    fila(
      cons,
      [pi.nombre, pi.cubierta, pi.semicubierta, { formula: `SUMIF('Descubiertas construibles'!A:A,A${n},'Descubiertas construibles'!C:C)` }, { formula: `SUMIF('Descubiertas construibles'!A:A,A${n},'Descubiertas construibles'!E:E)` }, pi.computaGcba ? "Sí" : "No", { formula: `B${n}+C${n}+E${n}` }],
      [null, m2, m2, m2, m2, null, m2],
    );
  }
  const finC = cons.rowCount;
  const filaTotC = fila(cons, ["Totales", { formula: `SUM(B${iniC}:B${finC})` }, { formula: `SUM(C${iniC}:C${finC})` }, { formula: `SUM(D${iniC}:D${finC})` }, { formula: `SUM(E${iniC}:E${finC})` }, null, { formula: `SUM(G${iniC}:G${finC})` }], [null, m2, m2, m2, m2, null, m2], true);
  cons.addRow([]);
  const filaGcba = fila(cons, ["Según GCBA (cubierta + semicubierta de los pisos con GCBA = Sí)", null, null, null, null, null, { formula: `SUMIF(F${iniC}:F${finC},"Sí",B${iniC}:B${finC})+SUMIF(F${iniC}:F${finC},"Sí",C${iniC}:C${finC})` }], [null, null, null, null, null, null, m2], true);
  const filaConDesc = fila(cons, ["Con las descubiertas a su %", null, null, null, null, null, { formula: `G${filaTotC}` }], [null, null, null, null, null, null, m2], true);
  fila(cons, ["Totales (todo al 100%)", null, null, null, null, null, { formula: `B${filaTotC}+C${filaTotC}+D${filaTotC}` }], [null, null, null, null, null, null, m2], true);

  // Descubiertas de lo vendible.
  const descV = hoja("Descubiertas vendibles", [12, 22, 14, 12, 16]);
  fila(descV, ["Unidad", "Descubierta", "m²", "% computa", "m² que computan"], [], true);
  d.unidades.forEach((u, i) => {
    for (const x of u.descubiertas) {
      const n = descV.rowCount + 1;
      fila(descV, [u.codigo || `Fila ${i + 1}`, x.nombre, x.m2, x.computa, { formula: `C${n}*D${n}` }], [null, null, m2, pct, m2]);
    }
  });

  // Vendibles por unidad.
  const vend = hoja("Vendibles", [10, 10, 16, 12, 14, 18, 14, 14, 30]);
  fila(vend, ["Unidad", "Piso", "Tipología", "Cubierta", "Semicubierta", "Descubiertas que computan", "Teórico", "Real", "Nota"], [], true);
  const iniV = 2;
  d.unidades.forEach((u, i) => {
    const n = vend.rowCount + 1;
    fila(
      vend,
      [u.codigo || `Fila ${i + 1}`, u.piso, u.tipologia, u.cubierta, u.semicubierta, { formula: `SUMIF('Descubiertas vendibles'!A:A,A${n},'Descubiertas vendibles'!E:E)` }, { formula: `D${n}+E${n}+F${n}` }, u.real ?? { formula: `G${n}` }, u.nota],
      [null, null, null, m2, m2, m2, m2, m2, null],
    );
  });
  const finV = vend.rowCount;
  const filaTotV = fila(vend, ["Totales", null, null, { formula: `SUM(D${iniV}:D${finV})` }, { formula: `SUM(E${iniV}:E${finV})` }, { formula: `SUM(F${iniV}:F${finV})` }, { formula: `SUM(G${iniV}:G${finV})` }, { formula: `SUM(H${iniV}:H${finV})` }], [null, null, null, m2, m2, m2, m2, m2], true);

  // Resumen.
  const res = hoja("Resumen", [44, 18]);
  titulo(res, `${p.nombre} · Resumen`);
  fila(res, ["Superficie del terreno", { formula: refTerreno }], [null, m2]);
  fila(res, ["Construible según GCBA", { formula: `Construibles!G${filaGcba}` }], [null, m2]);
  const filaResConDesc = fila(res, ["Construible con descubiertas a su %", { formula: `Construibles!G${filaConDesc}` }], [null, m2]);
  fila(res, ["Construible total (todo al 100%)", { formula: `Construibles!G${filaConDesc + 1}` }], [null, m2]);
  const filaResVend = fila(res, ["Vendible teórico", { formula: `Vendibles!G${filaTotV}` }], [null, m2]);
  fila(res, ["Vendible real", { formula: `Vendibles!H${filaTotV}` }], [null, m2]);
  fila(res, ["Comunes (construible con descubiertas − vendible teórico)", { formula: `B${filaResConDesc}-B${filaResVend}` }], [null, m2]);
  fila(res, ["% vendible (vendible teórico ÷ construible con descubiertas)", { formula: `B${filaResVend}/B${filaResConDesc}` }], [null, pct]);
  res.addRow([]);
  res.addRow([`Exportado del hub el ${new Date().toLocaleString("es-AR")}. Los números en azul son datos; el resto son fórmulas.`]);

  // Plusvalía.
  const pv = d.plusvalia;
  const pl = hoja("Plusvalía", [44, 18, 60]);
  titulo(pl, `${p.nombre} · Plusvalía (Ley 6062)`);
  const filas: Record<string, number> = {};
  const linea = (clave: string, nombre: string, valor: Celda, formato: string | null, nota: string, bold = false) => {
    filas[clave] = fila(pl, [nombre, valor, nota], [null, formato, null], bold);
  };
  linea("sup", "Superficie que computa el Gobierno (m²)", pv.superficieComputable ?? { formula: `Construibles!G${filaGcba}` }, m2, pv.superficieComputable != null ? "Cargada a mano (plano o permiso)." : "La construible según GCBA.");
  linea("ajuste", "Ajuste del Gobierno", pv.ajuste, pct, "Dato del Gobierno de la Ciudad.");
  linea("a1", "A1 = superficie × ajuste (m²)", { formula: `B${filas.sup}*B${filas.ajuste}` }, m2, "");
  linea("parcela", "Superficie de la parcela (m²)", pv.superficieParcela ?? { formula: refTerreno }, m2, pv.superficieParcela != null ? "Cargada a mano." : "La del terreno.");
  linea("fot", "FOT del distrito", pv.fot ?? { formula: `Lote!B${filaFot}` }, null, pv.fot != null ? "Cargado a mano." : "El de Lote.");
  linea("a2", "A2 = parcela × FOT (m²)", { formula: `B${filas.parcela}*B${filas.fot}` }, m2, "");
  linea("a", "A = A1 − A2 (m²; si da negativo, 0)", { formula: `MAX(0,B${filas.a1}-B${filas.a2})` }, m2, "", true);
  linea("inc", "Incidencia del suelo (UVA/m²)", pv.incidencia, null, "Ciudad 3D.");
  linea("ali", `Alícuota${pv.zona ? ` (${pv.zona})` : ""}`, pv.alicuota, pct, "Ciudad 3D.");
  linea("b", "B = incidencia × alícuota (UVA/m²)", { formula: `B${filas.inc}*B${filas.ali}` }, "#,##0.00", "");
  linea("base", "Base imponible = A × B (UVA)", { formula: `B${filas.a}*B${filas.b}` }, "#,##0.00", "", true);
  linea("uva", `Valor del UVA${extra.uva ? ` (${extra.uva.fecha})` : ""}`, extra.uva?.valor ?? null, "#,##0.00", "BCRA / ArgentinaDatos.");
  linea("total", "Plusvalía = base × UVA ($)", { formula: `B${filas.base}*B${filas.uva}` }, pesos, "", true);
  linea("desc", "Descuento de contado", pv.descuentoContado, pct, "");
  linea("contado", "De contado ($)", { formula: `B${filas.total}*(1-B${filas.desc})` }, pesos, "", true);
  linea("mep", "Dólar MEP de hoy", extra.mep, "#,##0.00", "");
  linea("usd", "En dólares (US$)", { formula: `B${filas.contado}/B${filas.mep}` }, usd, "");
  if (pv.pago) {
    pl.addRow([]);
    linea("pago", `Pagado el ${pv.pago.fecha} ($)`, pv.pago.monto, pesos, "De la caja.");
    linea("implicito", "Plusvalía sin descuento según el pago ($)", { formula: `B${filas.pago}/(1-B${filas.desc})` }, pesos, "");
    linea("uvaImpl", "UVA que surge del pago", { formula: `B${filas.implicito}/B${filas.base}` }, "#,##0.00", "Compararlo con el UVA oficial del día del pago.");
  }

  // Los datos (lo que se carga a mano) en azul, como se suele marcar en los Excel de análisis.
  for (const ws of wb.worksheets)
    ws.eachRow((r) =>
      r.eachCell((c) => {
        if (typeof c.value === "number") c.font = { ...(c.font ?? {}), color: { argb: "FF0050A0" } };
      }),
    );
  wb.views = [{ activeTab: wb.worksheets.indexOf(res), x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, visibility: "visible" }];
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
