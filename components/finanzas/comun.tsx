"use client";

import { useState } from "react";
import { nombreMes, sumarMeses, type Moneda } from "@/lib/finanzas/ingresos";
import { fechaHora, importe } from "../formato";
import { Icono } from "../Icono";

/** Piezas que comparten los módulos de Finanzas: formatos, filtros, "Para revisar" y el gráfico por mes. */

export const MONEDAS: Moneda[] = ["ARS", "USD"];
const compacto = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });
export const corto = (n: number, moneda: Moneda) => `${moneda === "ARS" ? "$" : "US$"} ${compacto.format(n)}`;
export const monto = (n: number, moneda: Moneda) => importe(n, moneda === "USD" ? "US$" : "ARS");
/** Sin centavos, para las cifras grandes del resumen. */
export const redondo = (n: number, moneda: Moneda) => `${moneda === "ARS" ? "$" : "US$"} ${Math.round(n).toLocaleString("es-AR")}`;
export const nombreMoneda = (m: Moneda) => (m === "ARS" ? "pesos" : "dólares");

/** Un máximo redondo para el eje y sus marcas: 0, 1/4, 1/2, 3/4 y el máximo. */
export function escala(maximo: number): number[] {
  if (maximo <= 0) return [0, 1];
  const paso = 10 ** Math.floor(Math.log10(maximo / 4));
  const tope = Math.ceil(maximo / 4 / paso) * paso * 4;
  return [0, tope / 4, tope / 2, (tope * 3) / 4, tope];
}

/** La hora de la última lectura y el botón para volver a leer la planilla. */
export function BarraLectura({ leido, cargando, actualizar }: { leido: string | null; cargando: boolean; actualizar: () => void }) {
  return (
    <div className="ingresos__barra">
      <span className="ingresos__leido">{leido ? `Planilla leída a las ${fechaHora(leido)}` : cargando ? "Leyendo la planilla…" : ""}</span>
      <button type="button" className="btn btn--borde btn--chico" onClick={actualizar} disabled={cargando}>
        <Icono nombre="recargar" size={16} className={cargando ? "girando" : undefined} />
        Actualizar
      </button>
    </div>
  );
}

/** Atajos de rango de fechas, relativos al mes actual. */
export function Atajos({
  mesActual,
  desde,
  hasta,
  cambiar,
  futuro = true,
}: {
  mesActual: string;
  desde: string | null;
  hasta: string | null;
  cambiar: (desde: string | null, hasta: string | null) => void;
  /** Ingresos mira para adelante; egresos, para atrás. */
  futuro?: boolean;
}) {
  const anio = mesActual.slice(0, 4);
  const atajos: { texto: string; desde: string | null; hasta: string | null }[] = futuro
    ? [
        { texto: "Todo", desde: null, hasta: null },
        { texto: "Este mes", desde: mesActual, hasta: mesActual },
        { texto: "Próximo mes", desde: sumarMeses(mesActual, 1), hasta: sumarMeses(mesActual, 1) },
        { texto: "Próximos 6 meses", desde: sumarMeses(mesActual, 1), hasta: sumarMeses(mesActual, 6) },
        { texto: "Este año", desde: `${anio}-01`, hasta: `${anio}-12` },
        { texto: "Desde hoy", desde: mesActual, hasta: null },
      ]
    : [
        { texto: "Todo", desde: null, hasta: null },
        { texto: "Este mes", desde: mesActual, hasta: mesActual },
        { texto: "Mes pasado", desde: sumarMeses(mesActual, -1), hasta: sumarMeses(mesActual, -1) },
        { texto: "Últimos 6 meses", desde: sumarMeses(mesActual, -5), hasta: mesActual },
        { texto: "Este año", desde: `${anio}-01`, hasta: `${anio}-12` },
        { texto: "Año pasado", desde: `${Number(anio) - 1}-01`, hasta: `${Number(anio) - 1}-12` },
      ];
  return (
    <div className="ingresos__atajos" role="group" aria-label="Rango de fechas">
      {atajos.map((a) => {
        const activo = desde === a.desde && hasta === a.hasta;
        return (
          <button
            key={a.texto}
            type="button"
            className={`btn btn--chico ${activo ? "btn--primario" : "btn--borde"}`}
            aria-pressed={activo}
            onClick={() => cambiar(a.desde, a.hasta)}
          >
            {a.texto}
          </button>
        );
      })}
    </div>
  );
}

export function Selector({
  etiqueta,
  valor,
  opciones,
  cambiar,
  todos,
}: {
  etiqueta: string;
  valor: string | null;
  opciones: [string, string][];
  cambiar: (v: string | null) => void;
  todos: string;
}) {
  return (
    <label className="campo campo--filtro">
      {etiqueta}
      <select value={valor ?? ""} onChange={(e) => cambiar(e.target.value || null)}>
        <option value="">{todos}</option>
        {opciones.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Los meses de un rango, para los selectores "Desde" y "Hasta". */
export function opcionesDeMeses(meses: (string | null)[]): [string, string][] {
  const todos = meses.filter((m): m is string => !!m).sort();
  if (!todos.length) return [];
  const r: [string, string][] = [];
  for (let m = todos[0]; m <= todos.at(-1)!; m = sumarMeses(m, 1)) r.push([m, nombreMes(m)]);
  return r;
}

export interface AvisoVista {
  titulo: string;
  detalle: string;
  /** Dónde está: inversor, unidad, pestaña, fila. */
  donde: string;
  monto: number | null;
  moneda: Moneda | null;
}

export function Revisar({ avisos }: { avisos: AvisoVista[] }) {
  if (!avisos.length) return null;
  return (
    <details className="card revisar" open={avisos.length <= 6}>
      <summary>
        <Icono nombre="alerta" size={18} />
        <strong>Para revisar en la planilla</strong>
        <span className="revisar__cantidad">{avisos.length}</span>
      </summary>
      <ul className="revisar__lista">
        {avisos.map((a, i) => (
          <li key={i}>
            <div>
              <strong>{a.titulo}</strong>
              <span className="revisar__quien">{a.donde}</span>
              <p>{a.detalle}</p>
            </div>
            {a.monto != null && a.moneda && <span className="revisar__monto">{monto(a.monto, a.moneda)}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

export interface FilaMes {
  mes: string;
  blanco: number;
  negro: number;
  /** Lo que no dice si es blanco o negro. */
  sinDato?: number;
  total: number;
  acumulado: number;
}

/** Columnas por mes, con blanco y negro apilados, tooltip con el detalle y la vista de tabla. */
export function GraficoMeses<T extends FilaMes>({
  titulo,
  sub,
  moneda,
  meses,
  mesActual,
  extra,
}: {
  titulo: string;
  sub: string;
  moneda: Moneda;
  meses: T[];
  mesActual: string;
  /** Renglones de más para el tooltip y columnas de más para la tabla. */
  extra?: { titulo: string; valor: (m: T) => number }[];
}) {
  const [activo, setActivo] = useState<number | null>(null);
  const marcas = escala(Math.max(...meses.map((m) => m.total), 0));
  const tope = marcas.at(-1)!;
  const alto = (n: number) => `${(Math.max(n, 0) / tope) * 100}%`;
  // Con muchos meses, una etiqueta cada tanto para que no se pisen.
  const cada = Math.ceil(meses.length / 14);
  const hoy = meses.findIndex((m) => m.mes === mesActual);
  const conEtiqueta = (i: number) => i === hoy || (i % cada === 0 && (hoy < 0 || Math.abs(i - hoy) > 1));
  const haySinDato = meses.some((m) => (m.sinDato ?? 0) > 0);

  return (
    <figure className="card grafico">
      <figcaption>
        <h2>{titulo}</h2>
        <p className="grafico__sub">{sub}</p>
      </figcaption>
      <ul className="leyenda">
        <li>
          <span className="leyenda__marca leyenda__marca--blanco" /> Blanco
        </li>
        <li>
          <span className="leyenda__marca leyenda__marca--negro" /> Negro
        </li>
        {haySinDato && (
          <li>
            <span className="leyenda__marca leyenda__marca--sin-dato" /> Sin dato
          </li>
        )}
      </ul>
      <div className="ingresos__desplazable">
        <div className="columnas" style={{ minWidth: `${94 + meses.length * 22}px` }} role="img" aria-label={`${titulo}. El detalle está en la tabla de abajo.`}>
          <div className="columnas__eje" aria-hidden="true">
            {marcas.map((m) => (
              <span key={m} style={{ bottom: alto(m) }}>
                {m === 0 ? "0" : corto(m, moneda)}
              </span>
            ))}
          </div>
          <div className="columnas__area" style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` }}>
            {marcas.map((m) => (
              <span key={m} className="columnas__linea" style={{ bottom: alto(m) }} aria-hidden="true" />
            ))}
            {meses.map((m, i) => (
              <div
                key={m.mes}
                className={`columnas__grupo${activo === i ? " columnas__grupo--activo" : ""}${m.mes === mesActual ? " columnas__grupo--hoy" : ""}`}
                tabIndex={0}
                onMouseEnter={() => setActivo(i)}
                onMouseLeave={() => setActivo(null)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
                aria-label={`${nombreMes(m.mes)}: ${monto(m.total, moneda)}, acumulado ${monto(m.acumulado, moneda)}`}
              >
                <div className="columnas__barras">
                  <span className="columnas__pila" style={{ height: alto(m.total) }}>
                    {(m.sinDato ?? 0) > 0 && <span className="columnas__tramo columnas__tramo--sin-dato" style={{ flexGrow: m.sinDato }} />}
                    {m.negro > 0 && <span className="columnas__tramo columnas__tramo--negro" style={{ flexGrow: m.negro }} />}
                    {m.blanco > 0 && <span className="columnas__tramo columnas__tramo--blanco" style={{ flexGrow: m.blanco }} />}
                  </span>
                </div>
                {conEtiqueta(i) && <span className="columnas__mes">{i === hoy ? "hoy" : nombreMes(m.mes, true)}</span>}
                {activo === i && (
                  <div className={`tooltip${i < 3 ? " tooltip--izq" : i > meses.length - 4 ? " tooltip--der" : ""}`} role="tooltip">
                    <strong>{nombreMes(m.mes)}</strong>
                    <span>
                      <i className="leyenda__marca leyenda__marca--blanco" /> Blanco {monto(m.blanco, moneda)}
                    </span>
                    <span>
                      <i className="leyenda__marca leyenda__marca--negro" /> Negro {monto(m.negro, moneda)}
                    </span>
                    {(m.sinDato ?? 0) > 0 && (
                      <span>
                        <i className="leyenda__marca leyenda__marca--sin-dato" /> Sin dato {monto(m.sinDato!, moneda)}
                      </span>
                    )}
                    <span>Total del mes {monto(m.total, moneda)}</span>
                    {extra?.map((e) => (
                      <span key={e.titulo}>
                        {e.titulo} {monto(e.valor(m), moneda)}
                      </span>
                    ))}
                    <span>Acumulado {monto(m.acumulado, moneda)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <details className="grafico__tabla">
        <summary>Ver como tabla</summary>
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th>Mes</th>
                <th className="tabla__numero">Blanco</th>
                <th className="tabla__numero">Negro</th>
                {haySinDato && <th className="tabla__numero">Sin dato</th>}
                <th className="tabla__numero">Total</th>
                {extra?.map((e) => (
                  <th key={e.titulo} className="tabla__numero">
                    {e.titulo}
                  </th>
                ))}
                <th className="tabla__numero">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes}>
                  <td data-etiqueta="Mes">{nombreMes(m.mes)}</td>
                  <td data-etiqueta="Blanco" className="tabla__numero">{monto(m.blanco, moneda)}</td>
                  <td data-etiqueta="Negro" className="tabla__numero">{monto(m.negro, moneda)}</td>
                  {haySinDato && <td data-etiqueta="Sin dato" className="tabla__numero">{monto(m.sinDato ?? 0, moneda)}</td>}
                  <td data-etiqueta="Total" className="tabla__numero">{monto(m.total, moneda)}</td>
                  {extra?.map((e) => (
                    <td key={e.titulo} data-etiqueta={e.titulo} className="tabla__numero">
                      {monto(e.valor(m), moneda)}
                    </td>
                  ))}
                  <td data-etiqueta="Acumulado" className="tabla__numero">{monto(m.acumulado, moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Descarga un texto como archivo, desde el navegador. */
export function descargar(nombre: string, contenido: string, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
