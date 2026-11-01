"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { GRUPOS, totales, type Movimiento, type Partida } from "@/lib/finanzas/cashflow";
import type { RespuestaCashFlow } from "@/lib/finanzas/cashflowFuente";
import { nombreMes } from "@/lib/finanzas/ingresos";
import { leerJson } from "../formato";
import { Icono } from "../Icono";
import { useProyectoId } from "../proyectos/datos";

type Vista = "proyectado" | "real" | "actualizado" | "comparacion";
type Moneda = "USD" | "ARS";

const VISTAS: { v: Vista; nombre: string; ayuda: string }[] = [
  { v: "proyectado", nombre: "Proyectado", ayuda: 'El plan: la pestaña "Cash Flow" del Excel madre.' },
  { v: "real", nombre: "Real", ayuda: "Lo cobrado (Pagos por Inversor) y lo pagado (las cajas del proyecto)." },
  { v: "actualizado", nombre: "Real + proyectado", ayuda: "Real hasta el mes pasado y proyectado de este mes en adelante: con qué caja se termina la obra." },
  { v: "comparacion", nombre: "Proyectado vs real", ayuda: "Mes a mes, lo que se esperaba contra lo que pasó, y la diferencia." },
];

const formato = (moneda: Moneda) => (n: number | undefined) => {
  if (!n || Math.abs(n) < 0.5) return "—";
  const s = Math.round(Math.abs(n)).toLocaleString("es-AR");
  return `${n < 0 ? "−" : ""}${moneda === "USD" ? "US$ " : "$ "}${s}`;
};

/** El cash flow del proyecto: proyectado, real, real + proyectado y la comparación; resumido o desglosado; en dólares o en pesos. */
export function CashFlow() {
  const id = useProyectoId();
  const [datos, setDatos] = useState<RespuestaCashFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [vista, setVista] = useState<Vista>("actualizado");
  const [desglosado, setDesglosado] = useState(false);
  const [moneda, setMoneda] = useState<Moneda>("USD");
  const [anio, setAnio] = useState<string>("todo");
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [detalle, setDetalle] = useState<{ partida: Partida; mes: string } | null>(null);

  const cargar = useCallback(
    async (fresco = false) => {
      setCargando(true);
      try {
        setDatos(await leerJson<RespuestaCashFlow>(await fetch(`/api/proyectos/${id}/cash-flow${fresco ? "?fresco=1" : ""}`)));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setCargando(false);
      }
    },
    [id],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const anios = useMemo(() => [...new Set((datos?.meses ?? []).map((m) => m.slice(0, 4)))], [datos]);
  if (error && !datos) return <p className="alerta alerta--error">{error}</p>;
  if (!datos) return <p className="ficha__nota">Armando el cash flow (Excel madre, cobros, cajas y MEP)…</p>;

  const fmt = formato(moneda);
  const campo = moneda === "USD" ? "usd" : "ars";
  const todosMeses = datos.meses.filter((m) => anio === "todo" || m.startsWith(anio));
  // En la comparación, solo hasta el mes de hoy (lo que viene todavía no tiene real).
  const meses = vista === "comparacion" ? todosMeses.filter((m) => m <= datos.mesActual) : todosMeses;
  const partidas = vista === "proyectado" ? datos.proyectado : vista === "real" ? datos.real : datos.actualizado;
  // La caja acumulada arranca en el primer mes (aunque se mire un año): se calcula sobre todos.
  const tTodos = totales(partidas, datos.meses, moneda);
  const t = totales(partidas, meses, moneda);
  const tp = totales(datos.proyectado, meses, moneda);
  const tr = totales(datos.real, meses, moneda);
  const sumaFila = (r: Record<string, number>) => meses.reduce((s, m) => s + (r[m] ?? 0), 0);
  const grupos = (tipo: "ingreso" | "egreso", lista: Partida[]) => GRUPOS.filter((g) => g.tipo === tipo && lista.some((p) => p.grupo === g.clave));
  const alternar = (clave: string) => {
    const s = new Set(abiertos);
    if (s.has(clave)) s.delete(clave);
    else s.add(clave);
    setAbiertos(s);
  };

  const celdas = (r: Record<string, number>, clase = "", partida?: Partida) =>
    meses.map((m) => {
      const v = r[m];
      const puedeVer = partida?.movimientos?.some((x) => x.fecha.startsWith(m));
      return (
        <td key={m} className={`tabla__numero ${clase}${vista === "actualizado" && m < datos.mesActual ? " cf__real" : ""}`}>
          {puedeVer ? (
            <button type="button" className="cf__celda-boton" onClick={() => setDetalle({ partida: partida!, mes: m })} title="Ver los movimientos">
              {fmt(v)}
            </button>
          ) : (
            fmt(v)
          )}
        </td>
      );
    });

  const filaTotal = (nombre: string, r: Record<string, number>, clase: string, total?: number, extra?: React.ReactNode) => (
    <tr className={clase}>
      <th scope="row">
        {extra}
        {nombre}
      </th>
      {celdas(r)}
      <td className="tabla__numero cf__total">{total === undefined ? "" : fmt(total)}</td>
    </tr>
  );

  const bloque = (tipo: "ingreso" | "egreso") => {
    const nombre = tipo === "ingreso" ? "Ingresos" : "Egresos";
    const total = tipo === "ingreso" ? t.ingresos : t.egresos;
    return (
      <>
        {filaTotal(nombre.toUpperCase(), total, `cf__fila-${tipo}`, sumaFila(total))}
        {desglosado &&
          grupos(tipo, partidas).map((g) => {
            const abierto = abiertos.has(g.clave);
            const items = partidas.filter((p) => p.grupo === g.clave);
            return (
              <Fragment key={g.clave}>
                <tr className="cf__fila-grupo">
                  <th scope="row">
                    <button type="button" className="cf__abrir" onClick={() => alternar(g.clave)} aria-expanded={abierto}>
                      <span className={abierto ? "cf__flecha cf__flecha--abierta" : "cf__flecha"}>›</span> {g.nombre}
                    </button>
                  </th>
                  {celdas(t.porGrupo[g.clave] ?? {})}
                  <td className="tabla__numero cf__total">{fmt(sumaFila(t.porGrupo[g.clave] ?? {}))}</td>
                </tr>
                {abierto &&
                  items.map((p) => (
                    <tr key={p.clave} className="cf__fila-item">
                      <th scope="row">{p.nombre}</th>
                      {celdas(p[campo], "", p)}
                      <td className="tabla__numero cf__total">{fmt(sumaFila(p[campo]))}</td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
      </>
    );
  };

  // Comparación: por cada línea, proyectado / real / diferencia.
  const trio = (nombre: string, p: Record<string, number>, r: Record<string, number>, clase: string, signo: 1 | -1) => (
    <Fragment key={nombre}>
      <tr className={clase}>
        <th scope="row" rowSpan={1}>
          {nombre} <small>proyectado</small>
        </th>
        {celdas(p)}
        <td className="tabla__numero cf__total">{fmt(sumaFila(p))}</td>
      </tr>
      <tr className="cf__fila-item">
        <th scope="row">
          <small>real</small>
        </th>
        {celdas(r)}
        <td className="tabla__numero cf__total">{fmt(sumaFila(r))}</td>
      </tr>
      <tr className="cf__fila-desvio">
        <th scope="row">
          <small>diferencia</small>
        </th>
        {meses.map((m) => {
          const d = (r[m] ?? 0) - (p[m] ?? 0);
          const bueno = d * signo >= 0;
          return (
            <td key={m} className={`tabla__numero ${Math.abs(d) < 0.5 ? "" : bueno ? "cf__bien" : "cf__mal"}`}>
              {fmt(d)}
            </td>
          );
        })}
        <td className="tabla__numero cf__total">{fmt(sumaFila(r) - sumaFila(p))}</td>
      </tr>
    </Fragment>
  );

  const descargar = () => {
    const filas: string[][] = [["Concepto", ...meses.map((m) => nombreMes(m)), "Total"]];
    const agregar = (nombre: string, r: Record<string, number>) => filas.push([nombre, ...meses.map((m) => String(Math.round(r[m] ?? 0))), String(Math.round(sumaFila(r)))]);
    if (vista === "comparacion") {
      agregar("Ingresos proyectados", tp.ingresos);
      agregar("Ingresos reales", tr.ingresos);
      agregar("Egresos proyectados", tp.egresos);
      agregar("Egresos reales", tr.egresos);
      agregar("Flujo neto proyectado", tp.neto);
      agregar("Flujo neto real", tr.neto);
    } else {
      for (const tipo of ["ingreso", "egreso"] as const) {
        agregar(tipo === "ingreso" ? "INGRESOS" : "EGRESOS", tipo === "ingreso" ? t.ingresos : t.egresos);
        for (const g of grupos(tipo, partidas)) {
          agregar(`  ${g.nombre}`, t.porGrupo[g.clave] ?? {});
          for (const p of partidas.filter((x) => x.grupo === g.clave)) agregar(`    ${p.nombre}`, p[campo]);
        }
      }
      agregar("FLUJO NETO", t.neto);
      agregar("CAJA ACUMULADA", tTodos.acumulado);
    }
    const csv = filas.map((f) => f.map((x) => (/[",;\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    a.download = `cash-flow-${id}-${vista}-${moneda.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const final = tTodos.acumulado[datos.meses[datos.meses.length - 1]] ?? 0;
  const minimo = Math.min(0, ...datos.meses.map((m) => tTodos.acumulado[m] ?? 0));
  const mesMinimo = datos.meses.find((m) => (tTodos.acumulado[m] ?? 0) === minimo);

  return (
    <div className="cf">
      <div className="cf__barra">
        <div className="crm__pestanias" role="tablist" aria-label="Vista">
          {VISTAS.map((x) => (
            <button key={x.v} type="button" role="tab" aria-selected={vista === x.v} className={`crm__pestania cf__pestania${vista === x.v ? " crm__pestania--activa" : ""}`} onClick={() => setVista(x.v)} title={x.ayuda}>
              {x.nombre}
            </button>
          ))}
        </div>
        <div className="cf__opciones">
          <div className="cf__selector" role="group" aria-label="Detalle">
            <button type="button" className={!desglosado ? "activo" : undefined} onClick={() => setDesglosado(false)}>
              Resumido
            </button>
            <button type="button" className={desglosado ? "activo" : undefined} onClick={() => setDesglosado(true)}>
              Desglosado
            </button>
          </div>
          <div className="cf__selector" role="group" aria-label="Moneda">
            {(["USD", "ARS"] as const).map((m) => (
              <button key={m} type="button" className={moneda === m ? "activo" : undefined} onClick={() => setMoneda(m)}>
                {m === "USD" ? "US$" : "$"}
              </button>
            ))}
          </div>
          <select value={anio} onChange={(e) => setAnio(e.target.value)} aria-label="Año">
            <option value="todo">Toda la obra</option>
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn--texto btn--chico" onClick={() => void cargar(true)} disabled={cargando}>
            <Icono nombre="recargar" size={14} /> {cargando ? "Actualizando…" : "Actualizar"}
          </button>
          <button type="button" className="btn btn--borde btn--chico" onClick={descargar}>
            Descargar CSV
          </button>
        </div>
      </div>
      <p className="crm-ficha__sub">
        {VISTAS.find((x) => x.v === vista)!.ayuda} {moneda === "ARS" ? "Pesos: lo real al MEP del día de cada pago; lo proyectado al MEP de cada mes (los que vienen, al de hoy)." : "Dólares: lo real pagado en pesos, al MEP del día de cada pago."}
        {datos.mepHoy ? ` MEP de hoy: $ ${Math.round(datos.mepHoy).toLocaleString("es-AR")}.` : ""}
      </p>
      {datos.avisos.map((a) => (
        <p key={a} className="alerta alerta--aviso">
          {a}
        </p>
      ))}

      {vista !== "comparacion" && (
        <div className="cf__resumen">
          <div>
            <span>Ingresos</span>
            <strong>{fmt(sumaFila(t.ingresos))}</strong>
          </div>
          <div>
            <span>Egresos</span>
            <strong>{fmt(sumaFila(t.egresos))}</strong>
          </div>
          <div>
            <span>Flujo neto</span>
            <strong className={sumaFila(t.neto) < 0 ? "cf__mal" : undefined}>{fmt(sumaFila(t.neto))}</strong>
          </div>
          <div>
            <span>Caja al final de la obra</span>
            <strong className={final < 0 ? "cf__mal" : undefined}>{fmt(final)}</strong>
            {minimo < 0 && mesMinimo && (
              <small>
                Lo más bajo: {fmt(minimo)} en {nombreMes(mesMinimo).toLowerCase()}
              </small>
            )}
          </div>
        </div>
      )}

      <div className="cf__tabla-contenedor">
        <table className="cf__tabla">
          <thead>
            <tr>
              <th scope="col">
                {desglosado && vista !== "comparacion" && (
                  <button
                    type="button"
                    className="cf__abrir-todo"
                    onClick={() => setAbiertos(abiertos.size ? new Set() : new Set(GRUPOS.map((g) => g.clave)))}
                    title={abiertos.size ? "Cerrar todo" : "Abrir todo"}
                  >
                    {abiertos.size ? "Cerrar todo" : "Abrir todo"}
                  </button>
                )}
                Concepto
              </th>
              {meses.map((m) => (
                <th key={m} scope="col" className={`tabla__numero${m === datos.mesActual ? " cf__hoy" : ""}`}>
                  {nombreMes(m, true)}
                  {vista === "actualizado" && <small>{m < datos.mesActual ? "real" : "proy."}</small>}
                </th>
              ))}
              <th scope="col" className="tabla__numero cf__total">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {vista === "comparacion" ? (
              <>
                {trio("Ingresos", tp.ingresos, tr.ingresos, "cf__fila-ingreso", 1)}
                {desglosado && grupos("ingreso", [...datos.proyectado, ...datos.real]).map((g) => trio(g.nombre, tp.porGrupo[g.clave] ?? {}, tr.porGrupo[g.clave] ?? {}, "cf__fila-grupo", 1))}
                {trio("Egresos", tp.egresos, tr.egresos, "cf__fila-egreso", -1)}
                {desglosado && grupos("egreso", [...datos.proyectado, ...datos.real]).map((g) => trio(g.nombre, tp.porGrupo[g.clave] ?? {}, tr.porGrupo[g.clave] ?? {}, "cf__fila-grupo", -1))}
                {trio("Flujo neto", tp.neto, tr.neto, "cf__fila-neto", 1)}
              </>
            ) : (
              <>
                {bloque("ingreso")}
                {bloque("egreso")}
                {filaTotal("FLUJO NETO", t.neto, "cf__fila-neto", sumaFila(t.neto))}
                {filaTotal("CAJA ACUMULADA", tTodos.acumulado, "cf__fila-caja")}
              </>
            )}
          </tbody>
        </table>
      </div>
      {detalle && <Detalle {...detalle} moneda={moneda} cerrar={() => setDetalle(null)} />}
    </div>
  );
}

function Detalle({ partida, mes, moneda, cerrar }: { partida: Partida; mes: string; moneda: Moneda; cerrar: () => void }) {
  const fmt = formato(moneda);
  const lista: Movimiento[] = (partida.movimientos ?? []).filter((x) => x.fecha.startsWith(mes));
  return (
    <div className="crm-ficha__fondo" onClick={cerrar}>
      <aside className="crm-ficha" aria-label={`${partida.nombre} de ${nombreMes(mes)}`} onClick={(e) => e.stopPropagation()}>
        <header className="crm-ficha__encabezado">
          <div>
            <h2>{partida.nombre}</h2>
            <span className="crm-ficha__sub">
              {nombreMes(mes)} · {lista.length} {lista.length === 1 ? "movimiento" : "movimientos"} · {fmt(lista.reduce((s, x) => s + (moneda === "USD" ? x.usd : x.ars), 0))}
            </span>
          </div>
          <button type="button" className="oliver__accion crm-ficha__cerrar" onClick={cerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" size={18} />
          </button>
        </header>
        <div className="crm-ficha__cuerpo">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Detalle</th>
                <th className="tabla__numero">Monto</th>
                <th className="tabla__numero">{moneda === "USD" ? "En US$" : "En $"}</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((x, i) => (
                <tr key={i}>
                  <td>{x.fecha.split("-").reverse().join("/")}</td>
                  <td>{x.texto}</td>
                  <td className="tabla__numero">
                    {x.moneda === "USD" ? "US$" : "$"} {Math.round(x.monto).toLocaleString("es-AR")}
                  </td>
                  <td className="tabla__numero">{fmt(moneda === "USD" ? x.usd : x.ars)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}
