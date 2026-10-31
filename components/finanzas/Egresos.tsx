"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  egresosACsv,
  egresosPorMes,
  filtrarEgresos,
  filtrosEgresosAUrl,
  filtrosEgresosDeUrl,
  nombreRubro,
  porConcepto,
  porRubro,
  resumenInternos,
  RUBROS,
  SIN_CLASIFICAR,
  SIN_FILTROS_EGRESOS,
  totalesEgresos,
  type CajaEgresos,
  type Egreso,
  type FiltrosEgresos,
  type IdRubro,
} from "@/lib/finanzas/egresos";
import type { Moneda } from "@/lib/finanzas/ingresos";
import { leerJson } from "../formato";
import { Icono } from "../Icono";
import { Atajos, BarraLectura, descargar, GraficoMeses, MONEDAS, monto, nombreMoneda, opcionesDeMeses, redondo, Revisar, Selector } from "./comun";

interface Respuesta {
  caja: CajaEgresos;
  leido: string;
}

/** Egresos: filtros arriba (guardados en la URL), lo que hay que revisar, totales, rubros, meses, conceptos y el detalle. */
export function Egresos() {
  const params = useSearchParams();
  const router = useRouter();
  const ruta = usePathname();
  const filtros = useMemo(() => filtrosEgresosDeUrl(new URLSearchParams(params.toString())), [params]);
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async (fresco = false) => {
    setCargando(true);
    try {
      setDatos(await leerJson<Respuesta>(await fetch(`/api/finanzas/egresos${fresco ? "?fresco=1" : ""}`)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiar = useCallback(
    (parcial: Partial<FiltrosEgresos>) => {
      const q = filtrosEgresosAUrl({ ...filtros, ...parcial });
      router.replace(q ? `${ruta}?${q}` : ruta, { scroll: false });
    },
    [filtros, router, ruta],
  );

  const caja = datos?.caja;
  const egresos = useMemo(() => (caja ? filtrarEgresos(caja.egresos, filtros) : []), [caja, filtros]);
  const internos = useMemo(() => (caja ? filtrarEgresos(caja.internos, { ...filtros, rubro: null }) : []), [caja, filtros]);
  const monedas = MONEDAS.filter((m) => egresos.some((e) => e.moneda === m));

  return (
    <div className="ingresos">
      <BarraLectura leido={datos?.leido ?? null} cargando={cargando} actualizar={() => cargar(true)} />

      {error && (
        <p role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" size={18} />
          <span>{error}</span>
        </p>
      )}

      {caja && (
        <>
          <FiltrosVista caja={caja} filtros={filtros} cambiar={cambiar} />
          <Revisar
            avisos={caja.avisos.map((a) => ({
              ...a,
              donde: `${a.pestania} · ${a.filas.length === 1 ? `fila ${a.filas[0]}` : `filas ${a.filas.slice(0, 6).join(", ")}${a.filas.length > 6 ? "…" : ""}`}`,
            }))}
          />
          {egresos.length === 0 ? (
            <p className="card ingresos__vacio">No hay egresos con estos filtros.</p>
          ) : (
            <>
              <Resumen egresos={egresos} />
              {monedas.map((m) => (
                <Rubros key={m} egresos={egresos} moneda={m} elegido={filtros.rubro} elegir={(rubro) => cambiar({ rubro })} />
              ))}
              {monedas
                .filter((m) => egresos.some((e) => e.moneda === m && e.mes))
                .map((m) => (
                  <GraficoMeses
                    key={m}
                    titulo={`Gastos por mes en ${nombreMoneda(m)}`}
                    sub="Lo que se pagó cada mes, con los filtros de arriba. Pasá el mouse por un mes para ver el detalle y el acumulado."
                    moneda={m}
                    meses={egresosPorMes(egresos, m, filtros.desde, filtros.hasta)}
                    mesActual={caja.mesActual}
                  />
                ))}
              <div className="egresos__conceptos">
                {monedas.map((m) => (
                  <Conceptos key={m} egresos={egresos} moneda={m} buscar={(q) => cambiar({ q })} />
                ))}
              </div>
              <Detalle egresos={egresos} />
            </>
          )}
          <Internos internos={internos} />
        </>
      )}
    </div>
  );
}

function FiltrosVista({ caja, filtros, cambiar }: { caja: CajaEgresos; filtros: FiltrosEgresos; cambiar: (f: Partial<FiltrosEgresos>) => void }) {
  const opcionesMes = useMemo(() => opcionesDeMeses(caja.egresos.map((e) => e.mes)), [caja]);
  const proyectos = useMemo(() => [...new Set(caja.egresos.map((e) => e.proyecto))].sort((a, b) => a.localeCompare(b, "es")), [caja]);
  const rubros = useMemo(() => {
    const presentes = new Set(caja.egresos.map((e) => e.rubro));
    return [...RUBROS, SIN_CLASIFICAR].filter((r) => presentes.has(r.id)).map((r) => [r.id, r.nombre] as [string, string]);
  }, [caja]);
  // La búsqueda se aplica al rato de dejar de escribir, para no recargar con cada letra.
  const [texto, setTexto] = useState(filtros.q ?? "");
  useEffect(() => setTexto(filtros.q ?? ""), [filtros.q]);
  useEffect(() => {
    if ((filtros.q ?? "") === texto.trim()) return;
    const t = setTimeout(() => cambiar({ q: texto.trim() || null }), 350);
    return () => clearTimeout(t);
  }, [texto, filtros.q, cambiar]);
  const hayFiltros = Object.values(filtros).some(Boolean);

  return (
    <section className="card ingresos__filtros" aria-label="Filtros">
      <Atajos mesActual={caja.mesActual} desde={filtros.desde} hasta={filtros.hasta} cambiar={(desde, hasta) => cambiar({ desde, hasta })} futuro={false} />
      <div className="ingresos__campos">
        <Selector etiqueta="Desde" valor={filtros.desde} opciones={opcionesMes} cambiar={(v) => cambiar({ desde: v })} todos="El principio" />
        <Selector etiqueta="Hasta" valor={filtros.hasta} opciones={opcionesMes} cambiar={(v) => cambiar({ hasta: v })} todos="El final" />
        <Selector etiqueta="Moneda" valor={filtros.moneda} opciones={[["ARS", "Pesos"], ["USD", "Dólares"]]} cambiar={(v) => cambiar({ moneda: v as Moneda | null })} todos="Las dos" />
        <Selector etiqueta="Blanco o negro" valor={filtros.bn} opciones={[["blanco", "Blanco"], ["negro", "Negro"]]} cambiar={(v) => cambiar({ bn: v as FiltrosEgresos["bn"] })} todos="Todo" />
        <Selector etiqueta="Rubro" valor={filtros.rubro} opciones={rubros} cambiar={(v) => cambiar({ rubro: v as IdRubro | null })} todos="Todos" />
        <Selector etiqueta="Proyecto" valor={filtros.proyecto} opciones={proyectos.map((p) => [p, p] as [string, string])} cambiar={(v) => cambiar({ proyecto: v })} todos="Todos" />
        <label className="campo campo--filtro">
          Buscar en la descripción
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej.: Herpaco" />
        </label>
      </div>
      {hayFiltros && (
        <button type="button" className="btn btn--texto btn--chico" onClick={() => cambiar({ ...SIN_FILTROS_EGRESOS })}>
          <Icono nombre="cerrar" size={14} />
          Sacar los filtros
        </button>
      )}
    </section>
  );
}

function Resumen({ egresos }: { egresos: Egreso[] }) {
  const totales = totalesEgresos(egresos);
  return (
    <div className="ingresos__resumen">
      {MONEDAS.filter((m) => totales[m].cantidad > 0).map((m) => {
        const t = totales[m];
        return (
          <section key={m} className="ingresos__moneda" aria-label={m === "ARS" ? "Pesos" : "Dólares"}>
            <h2>{m === "ARS" ? "Pesos" : "Dólares"}</h2>
            <div className="ingresos__cifras">
              <div className="cifra cifra--destacada">
                <span className="cifra__titulo">Gastado</span>
                <span className="cifra__valor">{redondo(t.total, m)}</span>
                <span className="cifra__nota">{t.cantidad} pagos</span>
              </div>
              <div className="cifra">
                <span className="cifra__titulo">En blanco</span>
                <span className="cifra__valor">{redondo(t.blanco, m)}</span>
              </div>
              <div className="cifra">
                <span className="cifra__titulo">En negro</span>
                <span className="cifra__valor">{redondo(t.negro, m)}</span>
                {t.sinDato > 0 && <span className="cifra__nota">Y {redondo(t.sinDato, m)} sin dato</span>}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** En qué se va la plata: un renglón por rubro, de mayor a menor, con barra y porcentaje. */
function Rubros({ egresos, moneda, elegido, elegir }: { egresos: Egreso[]; moneda: Moneda; elegido: IdRubro | null; elegir: (r: IdRubro | null) => void }) {
  const filas = porRubro(egresos, moneda);
  const maximo = filas[0]?.total ?? 1;
  return (
    <section className="card grafico">
      <h2>¿En qué se va la plata? En {nombreMoneda(moneda)}</h2>
      <p className="grafico__sub">
        Lo gastado por rubro, con los filtros de arriba. Tocá un rubro para ver solo ese.
        {elegido && " Tocalo de nuevo para ver todos."}
      </p>
      <ul className="rubros">
        {filas.map((f) => (
          <li key={f.rubro}>
            <button
              type="button"
              className={`rubros__fila${elegido === f.rubro ? " rubros__fila--elegido" : ""}`}
              onClick={() => elegir(elegido === f.rubro ? null : f.rubro)}
              aria-pressed={elegido === f.rubro}
              title={`${f.nombre}: ${monto(f.total, moneda)} en ${f.cantidad} pagos (blanco ${monto(f.blanco, moneda)}, negro ${monto(f.negro, moneda)})`}
            >
              <span className="rubros__nombre">{f.nombre}</span>
              <span className="rubros__pista">
                <span className={`rubros__barra${f.rubro === "sin-clasificar" ? " rubros__barra--otros" : ""}`} style={{ width: `${(f.total / maximo) * 100}%` }} />
              </span>
              <span className="rubros__valor">
                {redondo(f.total, moneda)}
                <span className="rubros__parte">{(f.parte * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="egresos__presupuesto">
        <Icono nombre="reloj" size={16} />
        <span>
          <strong>Presupuesto y lo que falta:</strong> cuando exista la hoja de presupuestos, cada rubro va a mostrar lo presupuestado, lo gastado y lo que
          queda.
        </span>
      </p>
    </section>
  );
}

/** Los conceptos que más plata se llevaron (la descripción de la planilla). */
function Conceptos({ egresos, moneda, buscar }: { egresos: Egreso[]; moneda: Moneda; buscar: (q: string) => void }) {
  const { filas, otros } = porConcepto(egresos, moneda);
  const maximo = filas[0]?.total ?? 1;
  return (
    <section className="card grafico">
      <h2>Principales conceptos en {nombreMoneda(moneda)}</h2>
      <p className="grafico__sub">Según la descripción de la planilla. Tocá uno para buscarlo.</p>
      <ul className="rubros rubros--compacto">
        {[...filas, ...(otros ? [otros] : [])].map((f) => (
          <li key={f.descripcion}>
            <button
              type="button"
              className="rubros__fila"
              onClick={() => f !== otros && buscar(f.descripcion)}
              disabled={f === otros}
              title={`${f.descripcion}: ${monto(f.total, moneda)} en ${f.cantidad} pagos`}
            >
              <span className="rubros__nombre">{f.descripcion}</span>
              <span className="rubros__pista">
                <span className={`rubros__barra${f === otros ? " rubros__barra--otros" : ""}`} style={{ width: `${(f.total / maximo) * 100}%` }} />
              </span>
              <span className="rubros__valor">{redondo(f.total, moneda)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Internos({ internos }: { internos: CajaEgresos["internos"] }) {
  if (!internos.length) return null;
  const resumen = resumenInternos(internos);
  return (
    <details className="card egresos__internos">
      <summary>
        <strong>Movimientos internos ({internos.length})</strong>
        <span>No se cuentan como egreso: la plata cambia de forma o de cuenta, pero no sale de la empresa.</span>
      </summary>
      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              <th>Tipo</th>
              <th className="tabla__numero">Movimientos</th>
              <th className="tabla__numero">Total</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map((r) => (
              <tr key={`${r.tipo}-${r.moneda}`}>
                <td>{r.tipo}</td>
                <td className="tabla__numero">{r.cantidad}</td>
                <td className="tabla__numero">{monto(r.total, r.moneda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

type Orden = "fecha" | "descripcion" | "monto";
const LIMITE = 100;

function Detalle({ egresos }: { egresos: Egreso[] }) {
  const [orden, setOrden] = useState<{ por: Orden; asc: boolean }>({ por: "fecha", asc: false });
  const [todos, setTodos] = useState(false);
  const ordenados = useMemo(() => {
    const comparar: Record<Orden, (a: Egreso, b: Egreso) => number> = {
      fecha: (a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""),
      descripcion: (a, b) => a.descripcion.localeCompare(b.descripcion, "es"),
      monto: (a, b) => a.monto - b.monto,
    };
    const r = [...egresos].sort(comparar[orden.por]);
    return orden.asc ? r : r.reverse();
  }, [egresos, orden]);
  const visibles = todos ? ordenados : ordenados.slice(0, LIMITE);

  const encabezado = (por: Orden, texto: string, numero = false) => (
    <th className={numero ? "tabla__numero" : undefined} aria-sort={orden.por === por ? (orden.asc ? "ascending" : "descending") : undefined}>
      <button type="button" className="ingresos__orden" onClick={() => setOrden((o) => ({ por, asc: o.por === por ? !o.asc : por !== "monto" }))}>
        {texto}
        {orden.por === por ? (orden.asc ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
  const fecha = (f: string | null) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : "Sin fecha");

  return (
    <section className="card ingresos__seccion">
      <div className="ingresos__titulo">
        <h2>Detalle de egresos ({egresos.length})</h2>
        <button type="button" className="btn btn--borde btn--chico" onClick={() => descargar("egresos.csv", egresosACsv(ordenados))}>
          <Icono nombre="archivo" size={16} />
          Descargar CSV
        </button>
      </div>
      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              {encabezado("fecha", "Fecha")}
              {encabezado("descripcion", "Descripción")}
              <th>Rubro</th>
              {encabezado("monto", "Monto", true)}
            </tr>
          </thead>
          <tbody>
            {visibles.map((e) => (
              <tr key={`${e.pestania}-${e.fila}`}>
                <td>{fecha(e.fecha)}</td>
                <td>
                  {e.descripcion || "(sin descripción)"}
                  <span className="tabla__sub">
                    {[e.proyecto, e.bn === "blanco" ? "Blanco" : e.bn === "negro" ? "Negro" : "Sin blanco/negro", e.forma].filter(Boolean).join(" · ")}
                  </span>
                </td>
                <td>
                  {nombreRubro(e.rubro)}
                  <span className="tabla__sub">Fila {e.fila}</span>
                </td>
                <td className="tabla__numero">{monto(e.monto, e.moneda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!todos && ordenados.length > LIMITE && (
        <button type="button" className="btn btn--texto btn--chico ingresos__mas" onClick={() => setTodos(true)}>
          Mostrar los {ordenados.length} egresos
        </button>
      )}
    </section>
  );
}
