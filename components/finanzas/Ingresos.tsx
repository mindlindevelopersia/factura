"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  aCsv,
  filtrar,
  filtrosAUrl,
  filtrosDeUrl,
  nombreMes,
  porInversor,
  porMes,
  SIN_FILTROS,
  totalesPorMoneda,
  type Filtros,
  type FlujoIngresos,
  type Moneda,
  type Pago,
} from "@/lib/finanzas/ingresos";
import { leerJson } from "../formato";
import { Icono } from "../Icono";
import { Atajos, BarraLectura, descargar, GraficoMeses, MONEDAS, monto, nombreMoneda, opcionesDeMeses, redondo, Revisar, Selector } from "./comun";

interface Respuesta {
  flujo: FlujoIngresos;
  leido: string;
}

/** Ingresos: filtros arriba (guardados en la URL), lo que hay que revisar, totales, por mes, por inversor y el detalle. */
export function Ingresos() {
  const params = useSearchParams();
  const router = useRouter();
  const ruta = usePathname();
  const filtros = useMemo(() => filtrosDeUrl(new URLSearchParams(params.toString())), [params]);
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async (fresco = false) => {
    setCargando(true);
    try {
      setDatos(await leerJson<Respuesta>(await fetch(`/api/finanzas/ingresos${fresco ? "?fresco=1" : ""}`)));
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

  const cambiar = (parcial: Partial<Filtros>) => {
    const q = filtrosAUrl({ ...filtros, ...parcial });
    router.replace(q ? `${ruta}?${q}` : ruta, { scroll: false });
  };

  const flujo = datos?.flujo;
  const pagos = useMemo(() => (flujo ? filtrar(flujo.pagos, filtros) : []), [flujo, filtros]);

  return (
    <div className="ingresos">
      <BarraLectura leido={datos?.leido ?? null} cargando={cargando} actualizar={() => cargar(true)} />

      {error && (
        <p role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" size={18} />
          <span>{error}</span>
        </p>
      )}

      {flujo && (
        <>
          <FiltrosIngresos flujo={flujo} filtros={filtros} cambiar={cambiar} />
          <Revisar
            avisos={flujo.avisos.map((a) => ({ ...a, donde: [a.inversor, a.unidad && `UF ${a.unidad}`, `fila ${a.fila}`].filter(Boolean).join(" · ") }))}
          />
          {pagos.length === 0 ? (
            <p className="card ingresos__vacio">No hay pagos con estos filtros.</p>
          ) : (
            <>
              <Resumen pagos={pagos} />
              {MONEDAS.filter((m) => pagos.some((p) => p.moneda === m && p.mes)).map((m) => (
                <GraficoMeses
                  key={m}
                  titulo={`¿Con cuánto cuento? En ${nombreMoneda(m)}`}
                  sub="Lo que entra cada mes, con los filtros de arriba. Pasá el mouse por un mes para ver el detalle y el acumulado."
                  moneda={m}
                  meses={porMes(pagos, m, filtros.desde, filtros.hasta)}
                  mesActual={flujo.mesActual}
                  extra={[
                    { titulo: "Cobrado", valor: (x) => x.cobrado },
                    { titulo: "A cobrar", valor: (x) => x.aCobrar },
                  ]}
                />
              ))}
              <TablaInversores pagos={pagos} mesActual={flujo.mesActual} elegir={(inversor) => cambiar({ inversor })} />
              <Detalle pagos={pagos} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function FiltrosIngresos({ flujo, filtros, cambiar }: { flujo: FlujoIngresos; filtros: Filtros; cambiar: (f: Partial<Filtros>) => void }) {
  const opcionesMes = useMemo(() => opcionesDeMeses(flujo.pagos.map((p) => p.mes)), [flujo]);
  const inversores = useMemo(() => [...new Set(flujo.pagos.map((p) => p.inversor))].sort((a, b) => a.localeCompare(b, "es")), [flujo]);
  const hayFiltros = Object.values(filtros).some(Boolean);

  return (
    <section className="card ingresos__filtros" aria-label="Filtros">
      <Atajos mesActual={flujo.mesActual} desde={filtros.desde} hasta={filtros.hasta} cambiar={(desde, hasta) => cambiar({ desde, hasta })} />
      <div className="ingresos__campos">
        <Selector etiqueta="Desde" valor={filtros.desde} opciones={opcionesMes} cambiar={(v) => cambiar({ desde: v })} todos="El principio" />
        <Selector etiqueta="Hasta" valor={filtros.hasta} opciones={opcionesMes} cambiar={(v) => cambiar({ hasta: v })} todos="El final" />
        <Selector etiqueta="Moneda" valor={filtros.moneda} opciones={[["ARS", "Pesos"], ["USD", "Dólares"]]} cambiar={(v) => cambiar({ moneda: v as Moneda | null })} todos="Las dos" />
        <Selector etiqueta="Blanco o negro" valor={filtros.bn} opciones={[["blanco", "Blanco"], ["negro", "Negro"]]} cambiar={(v) => cambiar({ bn: v as Filtros["bn"] })} todos="Todo" />
        <Selector etiqueta="Estado" valor={filtros.estado} opciones={[["cobrado", "Cobrado"], ["a-cobrar", "A cobrar"]]} cambiar={(v) => cambiar({ estado: v as Filtros["estado"] })} todos="Todos" />
        <Selector etiqueta="Tipo" valor={filtros.tipo} opciones={[["anticipo", "Anticipos"], ["cuota", "Cuotas"], ["refuerzo", "Refuerzos"]]} cambiar={(v) => cambiar({ tipo: v as Filtros["tipo"] })} todos="Todos" />
        <Selector etiqueta="Inversor" valor={filtros.inversor} opciones={inversores.map((i) => [i, i] as [string, string])} cambiar={(v) => cambiar({ inversor: v })} todos="Todos" />
      </div>
      {hayFiltros && (
        <button type="button" className="btn btn--texto btn--chico" onClick={() => cambiar({ ...SIN_FILTROS })}>
          <Icono nombre="cerrar" size={14} />
          Sacar los filtros
        </button>
      )}
    </section>
  );
}

function Resumen({ pagos }: { pagos: Pago[] }) {
  const totales = totalesPorMoneda(pagos);
  return (
    <div className="ingresos__resumen">
      {MONEDAS.filter((m) => totales[m].cantidad > 0).map((m) => {
        const t = totales[m];
        return (
          <section key={m} className="ingresos__moneda" aria-label={m === "ARS" ? "Pesos" : "Dólares"}>
            <h2>{m === "ARS" ? "Pesos" : "Dólares"}</h2>
            <div className="ingresos__cifras">
              <div className="cifra">
                <span className="cifra__titulo">Cobrado</span>
                <span className="cifra__valor">{redondo(t.cobrado, m)}</span>
              </div>
              <div className="cifra cifra--destacada">
                <span className="cifra__titulo">A cobrar</span>
                <span className="cifra__valor">{redondo(t.aCobrar, m)}</span>
                {t.atrasado > 0 && <span className="cifra__nota">Incluye {redondo(t.atrasado, m)} vencido sin cobrar</span>}
              </div>
              <div className="cifra">
                <span className="cifra__titulo">Total</span>
                <span className="cifra__valor">{redondo(t.total, m)}</span>
                <span className="cifra__nota">{t.cantidad} pagos</span>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TablaInversores({ pagos, mesActual, elegir }: { pagos: Pago[]; mesActual: string; elegir: (inversor: string) => void }) {
  const filas = porInversor(pagos, mesActual);
  const porMoneda = (t: Record<Moneda, { cobrado: number; aCobrar: number }>, campo: "cobrado" | "aCobrar") =>
    MONEDAS.filter((m) => t[m][campo] > 0).map((m) => (
      <span key={m} className="ingresos__linea">
        {monto(t[m][campo], m)}
      </span>
    ));

  return (
    <section className="card ingresos__seccion">
      <h2>Por inversor</h2>
      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              <th>Inversor</th>
              <th className="tabla__numero">Cobrado</th>
              <th className="tabla__numero">A cobrar</th>
              <th>Próximo pago</th>
              <th className="tabla__numero">Vencidos</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.inversor}>
                <td data-etiqueta="Inversor">
                  <button type="button" className="ingresos__enlace" onClick={() => elegir(f.inversor)} title="Ver solo este inversor">
                    {f.inversor}
                  </button>
                  {f.unidades.length > 0 && <span className="tabla__sub">UF {f.unidades.join(", ")}</span>}
                </td>
                <td data-etiqueta="Cobrado" className="tabla__numero">{porMoneda(f.totales, "cobrado")}</td>
                <td data-etiqueta="A cobrar" className="tabla__numero">{porMoneda(f.totales, "aCobrar")}</td>
                <td data-etiqueta="Próximo pago">
                  {f.proximo ? (
                    <>
                      {monto(f.proximo.monto, f.proximo.moneda)}
                      <span className="tabla__sub">{nombreMes(f.proximo.mes)}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td data-etiqueta="Vencidos" className="tabla__numero">{f.atrasados > 0 ? <span className="ingresos__vencido">{f.atrasados}</span> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type Orden = "mes" | "inversor" | "monto";
const LIMITE = 100;

function Detalle({ pagos }: { pagos: Pago[] }) {
  const [orden, setOrden] = useState<{ por: Orden; asc: boolean }>({ por: "mes", asc: true });
  const [todos, setTodos] = useState(false);
  const ordenados = useMemo(() => {
    const comparar: Record<Orden, (a: Pago, b: Pago) => number> = {
      mes: (a, b) => (a.mes ?? "").localeCompare(b.mes ?? ""),
      inversor: (a, b) => a.inversor.localeCompare(b.inversor, "es"),
      monto: (a, b) => a.monto - b.monto,
    };
    const r = [...pagos].sort(comparar[orden.por]);
    return orden.asc ? r : r.reverse();
  }, [pagos, orden]);
  const visibles = todos ? ordenados : ordenados.slice(0, LIMITE);


  const encabezado = (por: Orden, texto: string, numero = false) => (
    <th className={numero ? "tabla__numero" : undefined} aria-sort={orden.por === por ? (orden.asc ? "ascending" : "descending") : undefined}>
      <button type="button" className="ingresos__orden" onClick={() => setOrden((o) => ({ por, asc: o.por === por ? !o.asc : true }))}>
        {texto}
        {orden.por === por ? (orden.asc ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <section className="card ingresos__seccion">
      <div className="ingresos__titulo">
        <h2>Detalle de pagos ({pagos.length})</h2>
        <button type="button" className="btn btn--borde btn--chico" onClick={() => descargar("ingresos-lerma.csv", aCsv(ordenados))}>
          <Icono nombre="archivo" size={16} />
          Descargar CSV
        </button>
      </div>
      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              {encabezado("mes", "Mes")}
              {encabezado("inversor", "Inversor")}
              <th>Tipo</th>
              {encabezado("monto", "Monto", true)}
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => (
              <tr key={p.celda}>
                <td data-etiqueta="Mes">{p.mes ? nombreMes(p.mes) : "Sin mes"}</td>
                <td data-etiqueta="Inversor">
                  {p.inversor}
                  {p.unidad && <span className="tabla__sub">UF {p.unidad}</span>}
                </td>
                <td data-etiqueta="Tipo">
                  {p.detalle}
                  <span className="tabla__sub">{p.bn === "blanco" ? "Blanco" : "Negro"}</span>
                </td>
                <td data-etiqueta="Monto" className="tabla__numero">{monto(p.monto, p.moneda)}</td>
                <td data-etiqueta="Estado">
                  <span className={`estado-pago estado-pago--${p.atrasado ? "vencido" : p.estado}`}>
                    {p.estado === "cobrado" ? "Cobrado" : p.atrasado ? "Vencido" : "A cobrar"}
                  </span>
                  <span className="tabla__sub">Celda {p.celda}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!todos && ordenados.length > LIMITE && (
        <button type="button" className="btn btn--texto btn--chico ingresos__mas" onClick={() => setTodos(true)}>
          Mostrar los {ordenados.length} pagos
        </button>
      )}
    </section>
  );
}
