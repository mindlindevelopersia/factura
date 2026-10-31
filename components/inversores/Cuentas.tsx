"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { nombreMes } from "@/lib/finanzas/ingresos";
import { resumenCuenta, totalesCuentas, type Cuenta, type ResumenCuenta } from "@/lib/inversores/cuentas";
import { Icono } from "../Icono";
import { useBaseProyecto } from "../proyecto";
import { BarraLectura, monto, redondo, Revisar } from "../finanzas/comun";
import { fechaCorta, pct, usd, useCuentas } from "./datos";
import { aDolares } from "@/lib/indicadores/dolar";
import { useDolarHoy } from "../indicadores/Dolar";
import { Origen } from "../proyectos/Origen";

type Orden = "unidad" | "avance" | "saldo" | "ultimo";

/** El listado de cuentas corrientes: totales, lo que hay que revisar y una fila por inversor. */
export function Cuentas() {
  const { datos, error, cargando, actualizar } = useCuentas();
  const mep = useDolarHoy().de("mep");
  const [buscar, setBuscar] = useState("");
  const [orden, setOrden] = useState<Orden>("unidad");
  const [soloVencidos, setSoloVencidos] = useState(false);
  const cc = datos?.cuentas;

  const filas = useMemo(() => {
    if (!cc) return [];
    const q = buscar
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    const r = cc.cuentas
      .map((c) => ({ c, r: resumenCuenta(c, cc.mesActual) }))
      .filter(({ c }) => !q || `${c.inversor} ${c.unidad}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q))
      .filter(({ r }) => !soloVencidos || r.vencidos.length > 0);
    const comparar: Record<Orden, (a: (typeof r)[0], b: (typeof r)[0]) => number> = {
      unidad: () => 0,
      avance: (a, b) => (a.r.avance ?? -1) - (b.r.avance ?? -1),
      saldo: (a, b) => (b.r.saldoUsd ?? -1) - (a.r.saldoUsd ?? -1),
      ultimo: (a, b) => (b.r.ultimoPago?.fecha ?? "").localeCompare(a.r.ultimoPago?.fecha ?? ""),
    };
    return [...r].sort(comparar[orden]);
  }, [cc, buscar, orden, soloVencidos]);

  const totales = cc ? totalesCuentas(cc.cuentas, cc.mesActual) : null;

  return (
    <div className="ingresos">
      <BarraLectura leido={datos?.leido ?? null} cargando={cargando} actualizar={actualizar} />
      {error && (
        <p role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" size={18} />
          <span>{error}</span>
        </p>
      )}
      {cc && totales && (
        <>
          <Revisar
            avisos={cc.cuentas.flatMap((c) =>
              c.avisos.map((a) => ({
                titulo: a.titulo,
                detalle: a.detalle,
                donde: [`UF ${c.unidad}`, c.inversor, a.filas.length ? `${a.filas.length === 1 ? "fila" : "filas"} ${a.filas.join(", ")}` : null, c.columna && `bloque en la columna ${c.columna}`]
                  .filter(Boolean)
                  .join(" · "),
                monto: null,
                moneda: null,
              })),
            )}
          />
          <div className="ingresos__cifras cuentas__cifras">
            <div className="cifra">
              <span className="cifra__titulo">Vendido (costo estimado)</span>
              <span className="cifra__valor">{usd(totales.precio)}</span>
              <span className="cifra__nota">{totales.cuentas} cuentas</span>
            </div>
            <div className="cifra cifra--destacada">
              <span className="cifra__titulo">Pagado</span>
              <span className="cifra__valor">{usd(totales.pagado)}</span>
              <span className="cifra__nota">{pct(totales.avance)} del total</span>
            </div>
            <div className="cifra">
              <span className="cifra__titulo">Saldo</span>
              <span className="cifra__valor">{usd(totales.saldo)}</span>
              {totales.sinPrecio.length > 0 && <span className="cifra__nota">Sin contar {totales.sinPrecio.join(", ")}: no tiene precio en su bloque</span>}
              <Origen texto='Vendido menos pagado, en dólares. Cada pago en pesos se pasa a dólares con el tipo de cambio de ese pago ("Pagos por Inversor"), no con el de hoy.' />
            </div>
            <div className="cifra">
              <span className="cifra__titulo">A cobrar según el Flujo</span>
              <span className="cifra__valor">{redondo(totales.pendiente.ARS, "ARS")}</span>
              {mep?.venta && (
                <span className="cifra__nota">
                  ≈ <strong>{usd(aDolares(totales.pendiente.ARS, mep))}</strong> al MEP de hoy ({`$\u00a0${mep.venta.toLocaleString("es-AR")}`})
                </span>
              )}
              <span className="cifra__nota">{totales.conVencidos} cuentas con pagos vencidos</span>
              <Origen texto="Las cuotas en pesos que faltan cobrar según el Flujo de fondos, sin actualizar por CAC. No se suma al saldo: es lo mismo que falta, medido en pesos. Los dólares, al MEP de hoy (precio de venta)." />
            </div>
          </div>

          <section className="card ingresos__seccion">
            <div className="ingresos__titulo cuentas__controles">
              <h2>Cuentas ({filas.length})</h2>
              <label className="campo campo--filtro">
                <span className="sr-only">Buscar inversor o unidad</span>
                <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar inversor o unidad" />
              </label>
              <label className="campo campo--filtro">
                <span className="sr-only">Ordenar</span>
                <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
                  <option value="unidad">Por unidad</option>
                  <option value="avance">Menos avance primero</option>
                  <option value="saldo">Más saldo primero</option>
                  <option value="ultimo">Último pago más reciente</option>
                </select>
              </label>
              <label className="cuentas__check">
                <input type="checkbox" checked={soloVencidos} onChange={(e) => setSoloVencidos(e.target.checked)} />
                Solo con vencidos
              </label>
            </div>
            <ul className="leyenda cuentas__leyenda">
              <li>
                <span className="leyenda__marca leyenda__marca--blanco" /> Pagado formal
              </li>
              <li>
                <span className="leyenda__marca leyenda__marca--negro" /> Pagado informal
              </li>
            </ul>
            <div className="tabla-contenedor">
              <table className="tabla cuentas__tabla">
                <thead>
                  <tr>
                    <th>Inversor</th>
                    <th>Avance</th>
                    <th className="tabla__numero">Pagado</th>
                    <th className="tabla__numero">Saldo</th>
                    <th>Último pago</th>
                    <th>Próximo pago</th>
                    <th className="tabla__numero">Vencidos</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(({ c, r }) => (
                    <FilaCuenta key={c.id} c={c} r={r} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function FilaCuenta({ c, r }: { c: Cuenta; r: ResumenCuenta }) {
  const base = useBaseProyecto();
  const ancho = (n: number) => (c.precioUsd ? `${Math.min(100, (n / c.precioUsd) * 100)}%` : "0%");
  return (
    <tr>
      <td data-etiqueta="Inversor">
        <Link href={`${base}/inversores/cuentas-corrientes/${c.id}`} className="ingresos__enlace">
          {c.inversor}
        </Link>
        <span className="tabla__sub">
          UF {c.unidad}
          {c.avisos.length > 0 && (
            <span className="cuentas__aviso" title={c.avisos.map((a) => a.titulo).join(" · ")}>
              {" "}
              · <Icono nombre="alerta" size={12} /> {c.avisos.length === 1 ? "1 aviso" : `${c.avisos.length} avisos`}
            </span>
          )}
        </span>
      </td>
      <td data-etiqueta="Avance" className="cuentas__avance">
        {c.precioUsd ? (
          <>
            <span className="avance" title={`Formal ${usd(r.formal.pagado)} · Informal ${usd(r.informal.pagado)}`}>
              <span className="avance__tramo avance__tramo--formal" style={{ width: ancho(r.formal.pagado) }} />
              <span className="avance__tramo avance__tramo--informal" style={{ width: ancho(r.informal.pagado) }} />
            </span>
            <span className="cuentas__pct">{pct(r.avance)}</span>
          </>
        ) : (
          <span className="tabla__sub">Sin precio</span>
        )}
      </td>
      <td data-etiqueta="Pagado" className="tabla__numero">{usd(r.pagadoUsd)}</td>
      <td data-etiqueta="Saldo" className="tabla__numero">{usd(r.saldoUsd)}</td>
      <td data-etiqueta="Último pago">
        {r.ultimoPago ? (
          <>
            {fechaCorta(r.ultimoPago.fecha)}
            <span className="tabla__sub">{monto(r.ultimoPago.monto, r.ultimoPago.moneda)}</span>
          </>
        ) : (
          "—"
        )}
      </td>
      <td data-etiqueta="Próximo pago">
        {r.proximo ? (
          <>
            {nombreMes(r.proximo.mes)}
            <span className="tabla__sub">{r.proximo.montos.map((m) => redondo(m.monto, m.moneda)).join(" + ")}</span>
          </>
        ) : (
          "—"
        )}
      </td>
      <td data-etiqueta="Vencidos" className="tabla__numero">{r.vencidos.length ? <span className="ingresos__vencido">{r.vencidos.length}</span> : "—"}</td>
    </tr>
  );
}
