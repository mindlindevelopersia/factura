"use client";

import { DUDAS_HQ, sumarHq, type DudaHq, type GastoHq, type MontoHq } from "@/lib/proyectos/management";
import { Icono } from "../Icono";
import { Origen } from "./Origen";

const plata = (x: MontoHq) =>
  [x.ARS ? `$ ${Math.round(x.ARS).toLocaleString("es-AR")}` : null, x.USD ? `US$ ${Math.round(x.USD).toLocaleString("es-AR")}` : null].filter(Boolean).join(" y ") || "—";

const monto = (moneda: "ARS" | "USD", n: number) => `${moneda === "USD" ? "US$" : "$"} ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;

const fecha = (f: string | null) => (f ? f.split("-").reverse().join("/") : "sin fecha");

/** Los grupos que se muestran abiertos; los del banco son cientos de filas chicas: van cerrados. */
const ABIERTOS: DudaHq[] = ["obra", "prestamo", "grande"];

/** Baja la lista como CSV para abrir en Excel (separado por ";" y con coma decimal, como lo espera Excel en castellano). */
function descargar(hq: GastoHq) {
  const celda = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const filas = [
    ["Qué revisar", "Pestaña", "Fila", "Fecha", "Descripción", "Rubro", "Moneda", "Monto", "Qué hacer"],
    ...hq.revisar.map((e) => [
      DUDAS_HQ[e.duda].titulo,
      e.pestania,
      String(e.fila),
      fecha(e.fecha),
      e.descripcion,
      e.rubro,
      e.moneda,
      e.monto.toLocaleString("es-AR", { maximumFractionDigits: 2, useGrouping: false }),
      DUDAS_HQ[e.duda].queHacer,
    ]),
  ];
  const csv = "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "HQ para revisar.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** Los egresos marcados como HQ que están en duda, agrupados por qué, para que Tadeo los revise en el Excel. */
export function RevisionHq({ hq }: { hq: GastoHq }) {
  const grupos = (Object.keys(DUDAS_HQ) as DudaHq[]).map((d) => ({ duda: d, filas: hq.revisar.filter((e) => e.duda === d) })).filter((g) => g.filas.length);
  if (!grupos.length) return null;
  return (
    <section className="card ingresos__seccion hq" aria-label="HQ para revisar">
      <div className="ingresos__titulo cuentas__controles">
        <div>
          <h2>HQ para revisar con Tadeo</h2>
          <p className="ficha__nota">
            {hq.revisar.length} de {hq.movimientos} egresos marcados como HQ están en duda. Quedan {hq.oficina.movimientos} de oficina ({plata(hq.oficina)}). Cada fila dice en qué pestaña y fila del Excel
            está.
          </p>
        </div>
        <button type="button" className="btn btn--borde btn--chico" onClick={() => descargar(hq)}>
          <Icono nombre="archivo" size={16} />
          Descargar para Excel
        </button>
      </div>
      {grupos.map((g) => (
        <details key={g.duda} className="hq__grupo" open={ABIERTOS.includes(g.duda)}>
          <summary>
            <strong>{DUDAS_HQ[g.duda].titulo}</strong>
            <span>
              {g.filas.length} · {plata(sumarHq(g.filas))}
            </span>
          </summary>
          <p className="hq__que-hacer">{DUDAS_HQ[g.duda].queHacer}</p>
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Dónde</th>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th className="tabla__numero">Monto</th>
                </tr>
              </thead>
              <tbody>
                {g.filas.map((e) => (
                  <tr key={`${e.pestania}-${e.fila}`}>
                    <td data-etiqueta="Dónde">
                      Fila {e.fila}
                      <span className="tabla__sub">{e.pestania}</span>
                    </td>
                    <td data-etiqueta="Fecha">{fecha(e.fecha)}</td>
                    <td data-etiqueta="Descripción">{e.descripcion || "—"}</td>
                    <td data-etiqueta="Monto" className="tabla__numero">
                      {monto(e.moneda, e.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
      <Origen texto='Pestañas de caja ("Caja Flujos en Pesos" y "Caja Flujos en Dólares Global") → filas con "Corresponde" = HQ. El grupo sale del rubro de cada egreso (el mismo de Finanzas → Egresos).' />
    </section>
  );
}
