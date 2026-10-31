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
  sumarMeses,
  totalesPorMoneda,
  type Aviso,
  type Filtros,
  type FlujoIngresos,
  type Moneda,
  type Pago,
} from "@/lib/finanzas/ingresos";
import { fechaHora, importe, leerJson } from "../formato";
import { Icono } from "../Icono";

interface Respuesta {
  flujo: FlujoIngresos;
  leido: string;
}

const MONEDAS: Moneda[] = ["ARS", "USD"];
const compacto = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });
const corto = (n: number, moneda: Moneda) => `${moneda === "ARS" ? "$" : "US$"} ${compacto.format(n)}`;
const monto = (n: number, moneda: Moneda) => importe(n, moneda === "USD" ? "US$" : "ARS");
/** Sin centavos, para las cifras grandes del resumen. */
const redondo = (n: number, moneda: Moneda) => `${moneda === "ARS" ? "$" : "US$"}\u00a0${Math.round(n).toLocaleString("es-AR")}`;

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
      <div className="ingresos__barra">
        <span className="ingresos__leido">{datos ? `Planilla leída a las ${fechaHora(datos.leido)}` : cargando ? "Leyendo la planilla…" : ""}</span>
        <button type="button" className="btn btn--borde btn--chico" onClick={() => cargar(true)} disabled={cargando}>
          <Icono nombre="recargar" size={16} className={cargando ? "girando" : undefined} />
          Actualizar
        </button>
      </div>

      {error && (
        <p role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" size={18} />
          <span>{error}</span>
        </p>
      )}

      {flujo && (
        <>
          <FiltrosIngresos flujo={flujo} filtros={filtros} cambiar={cambiar} />
          <Revisar avisos={flujo.avisos} />
          {pagos.length === 0 ? (
            <p className="card ingresos__vacio">No hay pagos con estos filtros.</p>
          ) : (
            <>
              <Resumen pagos={pagos} />
              {MONEDAS.filter((m) => pagos.some((p) => p.moneda === m && p.mes)).map((m) => (
                <GraficoMeses key={m} pagos={pagos} moneda={m} filtros={filtros} mesActual={flujo.mesActual} />
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
  const hoy = flujo.mesActual;
  const anio = hoy.slice(0, 4);
  const meses = useMemo(() => {
    const todos = flujo.pagos.map((p) => p.mes).filter((m): m is string => !!m).sort();
    if (!todos.length) return [];
    const r: string[] = [];
    for (let m = todos[0]; m <= todos.at(-1)!; m = sumarMeses(m, 1)) r.push(m);
    return r;
  }, [flujo]);
  const inversores = useMemo(() => [...new Set(flujo.pagos.map((p) => p.inversor))].sort((a, b) => a.localeCompare(b, "es")), [flujo]);

  const atajos: { texto: string; desde: string | null; hasta: string | null }[] = [
    { texto: "Todo", desde: null, hasta: null },
    { texto: "Este mes", desde: hoy, hasta: hoy },
    { texto: "Próximo mes", desde: sumarMeses(hoy, 1), hasta: sumarMeses(hoy, 1) },
    { texto: "Próximos 6 meses", desde: sumarMeses(hoy, 1), hasta: sumarMeses(hoy, 6) },
    { texto: "Este año", desde: `${anio}-01`, hasta: `${anio}-12` },
    { texto: "Desde hoy", desde: hoy, hasta: null },
  ];
  const hayFiltros = Object.values(filtros).some(Boolean);

  const selector = (etiqueta: string, valor: string | null, opciones: [string, string][], alCambiar: (v: string | null) => void, todos: string) => (
    <label className="campo campo--filtro">
      {etiqueta}
      <select value={valor ?? ""} onChange={(e) => alCambiar(e.target.value || null)}>
        <option value="">{todos}</option>
        {opciones.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
  const opcionesMes = meses.map((m) => [m, nombreMes(m)] as [string, string]);

  return (
    <section className="card ingresos__filtros" aria-label="Filtros">
      <div className="ingresos__atajos" role="group" aria-label="Rango de fechas">
        {atajos.map((a) => {
          const activo = filtros.desde === a.desde && filtros.hasta === a.hasta;
          return (
            <button
              key={a.texto}
              type="button"
              className={`btn btn--chico ${activo ? "btn--primario" : "btn--borde"}`}
              aria-pressed={activo}
              onClick={() => cambiar({ desde: a.desde, hasta: a.hasta })}
            >
              {a.texto}
            </button>
          );
        })}
      </div>
      <div className="ingresos__campos">
        {selector("Desde", filtros.desde, opcionesMes, (v) => cambiar({ desde: v }), "El principio")}
        {selector("Hasta", filtros.hasta, opcionesMes, (v) => cambiar({ hasta: v }), "El final")}
        {selector("Moneda", filtros.moneda, [["ARS", "Pesos"], ["USD", "Dólares"]], (v) => cambiar({ moneda: v as Moneda | null }), "Las dos")}
        {selector("Blanco o negro", filtros.bn, [["blanco", "Blanco"], ["negro", "Negro"]], (v) => cambiar({ bn: v as Filtros["bn"] }), "Todo")}
        {selector("Estado", filtros.estado, [["cobrado", "Cobrado"], ["a-cobrar", "A cobrar"]], (v) => cambiar({ estado: v as Filtros["estado"] }), "Todos")}
        {selector("Tipo", filtros.tipo, [["anticipo", "Anticipos"], ["cuota", "Cuotas"], ["refuerzo", "Refuerzos"]], (v) => cambiar({ tipo: v as Filtros["tipo"] }), "Todos")}
        {selector("Inversor", filtros.inversor, inversores.map((i) => [i, i] as [string, string]), (v) => cambiar({ inversor: v }), "Todos")}
      </div>
      {hayFiltros && (
        <button
          type="button"
          className="btn btn--texto btn--chico"
          onClick={() => cambiar({ desde: null, hasta: null, moneda: null, inversor: null, bn: null, tipo: null, estado: null })}
        >
          <Icono nombre="cerrar" size={14} />
          Sacar los filtros
        </button>
      )}
    </section>
  );
}

function Revisar({ avisos }: { avisos: Aviso[] }) {
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
              <span className="revisar__quien">
                {[a.inversor, a.unidad && `UF ${a.unidad}`, `fila ${a.fila}`].filter(Boolean).join(" · ")}
              </span>
              <p>{a.detalle}</p>
            </div>
            {a.monto != null && a.moneda && <span className="revisar__monto">{monto(a.monto, a.moneda)}</span>}
          </li>
        ))}
      </ul>
    </details>
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

/** Un máximo redondo para el eje y sus marcas: 0, 1/4, 1/2, 3/4 y el máximo. */
function escala(maximo: number): number[] {
  if (maximo <= 0) return [0, 1];
  const paso = 10 ** Math.floor(Math.log10(maximo / 4));
  const tope = Math.ceil(maximo / 4 / paso) * paso * 4;
  return [0, tope / 4, tope / 2, (tope * 3) / 4, tope];
}

function GraficoMeses({ pagos, moneda, filtros, mesActual }: { pagos: Pago[]; moneda: Moneda; filtros: Filtros; mesActual: string }) {
  const [activo, setActivo] = useState<number | null>(null);
  const meses = porMes(pagos, moneda, filtros.desde, filtros.hasta);
  const marcas = escala(Math.max(...meses.map((m) => m.total), 0));
  const tope = marcas.at(-1)!;
  const alto = (n: number) => `${(Math.max(n, 0) / tope) * 100}%`;
  // Con muchos meses, una etiqueta cada tanto para que no se pisen.
  const cada = Math.ceil(meses.length / 14);
  const hoy = meses.findIndex((m) => m.mes === mesActual);
  const conEtiqueta = (i: number) => i === hoy || (i % cada === 0 && (hoy < 0 || Math.abs(i - hoy) > 1));
  const nombre = moneda === "ARS" ? "pesos" : "dólares";

  return (
    <figure className="card grafico">
      <figcaption>
        <h2>¿Con cuánto cuento? En {nombre}</h2>
        <p className="grafico__sub">
          Lo que entra cada mes, con los filtros de arriba. Pasá el mouse por un mes para ver el detalle y el acumulado.
        </p>
      </figcaption>
      <ul className="leyenda">
        <li>
          <span className="leyenda__marca leyenda__marca--blanco" /> Blanco
        </li>
        <li>
          <span className="leyenda__marca leyenda__marca--negro" /> Negro
        </li>
      </ul>
      <div className="ingresos__desplazable">
        <div
          className="columnas"
          style={{ minWidth: `${94 + meses.length * 22}px` }}
          role="img"
          aria-label={`Ingresos en ${nombre} por mes. El detalle está en la tabla de abajo.`}
        >
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
                    {m.negro > 0 && <span className="columnas__tramo columnas__tramo--negro" style={{ flexGrow: m.negro }} />}
                    {m.blanco > 0 && <span className="columnas__tramo columnas__tramo--blanco" style={{ flexGrow: m.blanco }} />}
                  </span>
                </div>
                {conEtiqueta(i) && (
                  <span className="columnas__mes">{m.mes === mesActual ? "hoy" : nombreMes(m.mes, true)}</span>
                )}
                {activo === i && (
                  <div className={`tooltip${i < 3 ? " tooltip--izq" : i > meses.length - 4 ? " tooltip--der" : ""}`} role="tooltip">
                    <strong>{nombreMes(m.mes)}</strong>
                    <span>
                      <i className="leyenda__marca leyenda__marca--blanco" /> Blanco {monto(m.blanco, moneda)}
                    </span>
                    <span>
                      <i className="leyenda__marca leyenda__marca--negro" /> Negro {monto(m.negro, moneda)}
                    </span>
                    <span>Total del mes {monto(m.total, moneda)}</span>
                    <span>
                      Cobrado {monto(m.cobrado, moneda)} · a cobrar {monto(m.aCobrar, moneda)}
                    </span>
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
                <th className="tabla__numero">Total</th>
                <th className="tabla__numero">A cobrar</th>
                <th className="tabla__numero">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes}>
                  <td>{nombreMes(m.mes)}</td>
                  <td className="tabla__numero">{monto(m.blanco, moneda)}</td>
                  <td className="tabla__numero">{monto(m.negro, moneda)}</td>
                  <td className="tabla__numero">{monto(m.total, moneda)}</td>
                  <td className="tabla__numero">{monto(m.aCobrar, moneda)}</td>
                  <td className="tabla__numero">{monto(m.acumulado, moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
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
                <td>
                  <button type="button" className="ingresos__enlace" onClick={() => elegir(f.inversor)} title="Ver solo este inversor">
                    {f.inversor}
                  </button>
                  {f.unidades.length > 0 && <span className="tabla__sub">UF {f.unidades.join(", ")}</span>}
                </td>
                <td className="tabla__numero">{porMoneda(f.totales, "cobrado")}</td>
                <td className="tabla__numero">{porMoneda(f.totales, "aCobrar")}</td>
                <td>
                  {f.proximo ? (
                    <>
                      {monto(f.proximo.monto, f.proximo.moneda)}
                      <span className="tabla__sub">{nombreMes(f.proximo.mes)}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="tabla__numero">{f.atrasados > 0 ? <span className="ingresos__vencido">{f.atrasados}</span> : "—"}</td>
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

  const descargar = () => {
    const url = URL.createObjectURL(new Blob([aCsv(ordenados)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "ingresos-lerma.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <button type="button" className="btn btn--borde btn--chico" onClick={descargar}>
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
                <td>{p.mes ? nombreMes(p.mes) : "Sin mes"}</td>
                <td>
                  {p.inversor}
                  {p.unidad && <span className="tabla__sub">UF {p.unidad}</span>}
                </td>
                <td>
                  {p.detalle}
                  <span className="tabla__sub">{p.bn === "blanco" ? "Blanco" : "Negro"}</span>
                </td>
                <td className="tabla__numero">{monto(p.monto, p.moneda)}</td>
                <td>
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
