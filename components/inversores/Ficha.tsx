"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { nombreMes } from "@/lib/finanzas/ingresos";
import { conAcumulado, resumenCuenta, type Cuenta } from "@/lib/inversores/cuentas";
import { avanceEnPesos, type IndicesCac } from "@/lib/inversores/pesos";
import { Origen } from "../proyectos/Origen";
import { Icono } from "../Icono";
import { useBaseProyecto } from "../proyecto";
import { BarraLectura, monto, redondo } from "../finanzas/comun";
import { fechaCorta, pct, usd, useCuentas } from "./datos";

/**
 * La cuenta corriente de un inversor. Con "Imprimir" se arma el estado de cuenta para mandarle
 * (lo de pantalla, sin los comentarios internos ni los avisos). "Incluir informal" decide si
 * entra lo informal.
 */
export function Ficha({ id }: { id: string }) {
  const { datos, error, cargando, actualizar } = useCuentas();
  const [informal, setInformal] = useState(true);
  const cuenta = datos?.cuentas.cuentas.find((c) => c.id === id);
  const base = useBaseProyecto();

  return (
    <div className="ingresos ficha">
      <div className="ficha__barra solo-pantalla">
        <Link href={`${base}/inversores/cuentas-corrientes`} className="btn btn--texto btn--chico">
          <Icono nombre="volver" size={16} />
          Todas las cuentas
        </Link>
        <BarraLectura leido={datos?.leido ?? null} cargando={cargando} actualizar={actualizar} />
      </div>
      {error && (
        <p role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" size={18} />
          <span>{error}</span>
        </p>
      )}
      {datos && !cuenta && <p className="card ingresos__vacio">No se encontró esta cuenta. Puede que haya cambiado el nombre o la unidad en la planilla.</p>}
      {datos && cuenta && <Contenido c={cuenta} mesActual={datos.cuentas.mesActual} cac={datos.cac ?? null} errorCac={datos.errorCac ?? null} informal={informal} setInformal={setInformal} />}
    </div>
  );
}

function Contenido({
  c,
  mesActual,
  cac,
  errorCac,
  informal,
  setInformal,
}: {
  c: Cuenta;
  mesActual: string;
  cac: IndicesCac | null;
  errorCac: string | null;
  informal: boolean;
  setInformal: (v: boolean) => void;
}) {
  const r = resumenCuenta(c, mesActual, informal);
  const ep = avanceEnPesos(c, cac, mesActual, informal);
  const pagos = conAcumulado(informal ? c.pagos : c.pagos.filter((p) => p.formal === true), r.baseUsd);
  const pendientes = informal ? c.pendientes : c.pendientes.filter((p) => p.bn === "blanco");
  const hoy = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

  return (
    <>
      <div className="solo-impresion ficha__membrete">
        <Image src="/brand/mindlin-logo.png" alt="Mindlin Developers" width={631} height={219} className="ficha__logo" />
        <span>Estado de cuenta al {hoy}</span>
      </div>

      <section className="card ficha__datos">
        <div>
          <span className="eyebrow">{c.emprendimiento || "MIND Lerma 439"}</span>
          <h2 className="ficha__nombre">{c.inversor}</h2>
        </div>
        <dl>
          <div>
            <dt>Unidad</dt>
            <dd>{c.unidad}</dd>
          </div>
          {c.cuit && (
            <div>
              <dt>CUIT</dt>
              <dd>{c.cuit}</dd>
            </div>
          )}
          {c.telefono && (
            <div>
              <dt>Teléfono</dt>
              <dd>{c.telefono}</dd>
            </div>
          )}
          <div>
            <dt>Mes base CAC</dt>
            <dd>{c.mesBaseCac ? nombreMes(c.mesBaseCac) : "—"}</dd>
          </div>
        </dl>
        <div className="ficha__acciones solo-pantalla">
          <label className="cuentas__check">
            <input type="checkbox" checked={informal} onChange={(e) => setInformal(e.target.checked)} />
            Incluir informal
          </label>
          <button type="button" className="btn btn--primario btn--chico" onClick={() => window.print()}>
            <Icono nombre="imprimir" size={16} />
            Estado de cuenta (imprimir o PDF)
          </button>
        </div>
      </section>

      {c.avisos.length > 0 && (
        <div className="alerta alerta--aviso solo-pantalla" role="note">
          <Icono nombre="alerta" size={18} />
          <div>
            <strong>Para revisar en la planilla</strong>
            <ul>
              {c.avisos.map((a, i) => (
                <li key={i}>
                  <strong>{a.titulo}.</strong> {a.detalle}
                  {a.filas.length > 0 && ` (${a.filas.length === 1 ? "fila" : "filas"} ${a.filas.join(", ")}${c.columna ? `, bloque en la columna ${c.columna}` : ""})`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="ingresos__cifras">
        <div className="cifra">
          <span className="cifra__titulo">{informal ? "Costo estimado del departamento" : "Monto total formal"}</span>
          <span className="cifra__valor">{usd(r.baseUsd)}</span>
          {c.precioArs != null && informal && <span className="cifra__nota">{redondo(c.precioArs, "ARS")}</span>}
        </div>
        <div className="cifra cifra--destacada">
          <span className="cifra__titulo">Pagado</span>
          <span className="cifra__valor">{usd(r.pagadoUsd)}</span>
          <span className="cifra__nota">{pct(r.avance)} del total</span>
        </div>
        <div className="cifra">
          <span className="cifra__titulo">Saldo</span>
          <span className="cifra__valor">{usd(r.saldoUsd)}</span>
          {r.ultimoMes && <span className="cifra__nota">Termina de pagar en {nombreMes(r.ultimoMes).toLowerCase()}</span>}
        </div>
      </div>

      <section className="ficha__pesos" aria-label="En pesos ajustados por CAC">
        <h2 className="ficha__pesos-titulo">
          En pesos ajustados por CAC
          {ep && <span> · a valores de {nombreMes(ep.mesCac).toLowerCase()}</span>}
        </h2>
        {ep && ep.costoHoy == null && ep.pagadoHoy === 0 ? (
          <p className="ficha__nota">{ep.falta}: no se puede llevar a pesos de hoy. Si es a precio cerrado en dólares, no hace falta.</p>
        ) : ep ? (
          <div className="ingresos__cifras">
            <div className="cifra">
              <span className="cifra__titulo">{informal ? "Costo de hoy" : "Monto formal de hoy"}</span>
              <span className="cifra__valor">{ep.costoHoy != null ? redondo(ep.costoHoy, "ARS") : "—"}</span>
              <span className="cifra__nota">
                {ep.costoContrato != null ? `${redondo(ep.costoContrato, "ARS")} del contrato${c.mesBaseCac ? ` (${nombreMes(c.mesBaseCac).toLowerCase()})` : ""}` : ep.falta}
              </span>
            </div>
            <div className="cifra cifra--destacada">
              <span className="cifra__titulo">Pagado, en pesos de hoy</span>
              <span className="cifra__valor">{redondo(ep.pagadoHoy, "ARS")}</span>
              <span className="cifra__nota">
                {pct(ep.avance)} del total{ep.sinAjustar > 0 && ` · ${ep.sinAjustar} ${ep.sinAjustar === 1 ? "pago sin fecha no suma" : "pagos sin fecha no suman"}`}
              </span>
            </div>
            <div className="cifra">
              <span className="cifra__titulo">Saldo, en pesos de hoy</span>
              <span className="cifra__valor">{ep.saldoHoy != null ? redondo(ep.saldoHoy, "ARS") : "—"}</span>
              <Origen
                texto={`Todo llevado al CAC de ${nombreMes(ep.mesCac).toLowerCase()}. Costo: costo en pesos del contrato × CAC ${nombreMes(ep.mesCac, true)} ÷ CAC del mes anterior al mes base. Cada pago en pesos: × CAC ${nombreMes(ep.mesCac, true)} ÷ CAC del mes anterior al pago. Los pagos en dólares, al tipo de cambio del contrato (${ep.tipoCambioContrato ? `$ ${Math.round(ep.tipoCambioContrato).toLocaleString("es-AR")}` : "—"}) y ajustados desde el mes base, como el costo.`}
              />
            </div>
          </div>
        ) : (
          <p className="ficha__nota">{errorCac ? `No se pudo leer el índice CAC: ${errorCac}` : "Sin índice CAC para ajustar."}</p>
        )}
      </section>

      {r.baseUsd != null && (
        <section className="card grafico">
          <h2>Avance de pago</h2>
          <BarraAvance titulo={informal ? "Formal" : "Total formal"} pagado={r.formal.pagado} objetivo={r.formal.objetivo} clase="formal" />
          {informal && <BarraAvance titulo="Informal" pagado={r.informal.pagado} objetivo={r.informal.objetivo} clase="informal" />}
        </section>
      )}

      <section className="card ingresos__seccion">
        <h2>Pagos realizados ({pagos.length})</h2>
        {pagos.length === 0 ? (
          <p className="ficha__vacio">Todavía no hay pagos cargados en "Pagos por Inversor".</p>
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th className="tabla__numero">Monto</th>
                  <th className="tabla__numero">Tipo de cambio</th>
                  <th className="tabla__numero">En dólares</th>
                  {ep && <th className="tabla__numero">En pesos de hoy</th>}
                  <th className="tabla__numero">Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.fila}>
                    <td data-etiqueta="Fecha">{p.fecha ? fechaCorta(p.fecha) : <span className="ingresos__vencido">{p.fechaTexto || "Sin fecha"}</span>}</td>
                    <td data-etiqueta="Concepto">
                      {[p.concepto, p.numero && `n.º ${p.numero}`].filter(Boolean).join(" · ") || "—"}
                      {informal && <span className="tabla__sub">{p.formal === true ? "Formal" : p.formal === false ? "Informal" : "Sin dato"}</span>}
                    </td>
                    <td data-etiqueta="Monto" className="tabla__numero">{monto(p.monto, p.moneda)}</td>
                    <td data-etiqueta="Tipo de cambio" className="tabla__numero">{p.moneda === "ARS" && p.tipoCambio ? `$ ${p.tipoCambio.toLocaleString("es-AR")}` : "—"}</td>
                    <td data-etiqueta="En dólares" className="tabla__numero">{p.usd != null ? monto(p.usd, "USD") : "—"}</td>
                    {ep && (
                      <td data-etiqueta="En pesos de hoy" className="tabla__numero">
                        {ep.pagos[p.fila]?.hoy != null ? redondo(ep.pagos[p.fila].hoy!, "ARS") : "—"}
                        {ep.pagos[p.fila]?.factor != null && ep.pagos[p.fila].factor !== 1 && (
                          <span className="tabla__sub">× {ep.pagos[p.fila].factor!.toLocaleString("es-AR", { maximumFractionDigits: 3 })} CAC</span>
                        )}
                      </td>
                    )}
                    <td data-etiqueta="Acumulado" className="tabla__numero">
                      {usd(p.acumuladoUsd)}
                      <span className="tabla__sub">{pct(p.avance)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card ingresos__seccion">
        <h2>Pagos que faltan</h2>
        {pendientes.length === 0 ? (
          <p className="ficha__vacio">No hay pagos pendientes en el Flujo de fondos.</p>
        ) : (
          <>
            <p className="ficha__nota">
              Según el Flujo de fondos. Los montos en pesos se ajustan por CAC; los de meses futuros son una estimación.
              {r.vencidos.length > 0 && ` Hay ${r.vencidos.length} vencidos sin cobrar.`}
            </p>
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Concepto</th>
                    <th className="tabla__numero">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((p) => (
                    <tr key={p.celda} className={p.atrasado ? "ficha__vencido" : undefined}>
                      <td data-etiqueta="Mes">
                        {p.mes ? nombreMes(p.mes) : "—"}
                        {p.atrasado && <span className="tabla__sub ingresos__vencido">Vencido</span>}
                      </td>
                      <td data-etiqueta="Concepto">
                        {p.detalle}
                        {informal && <span className="tabla__sub">{p.bn === "blanco" ? "Formal" : "Informal"}</span>}
                      </td>
                      <td data-etiqueta="Monto" className="tabla__numero">{monto(p.monto, p.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>
                      <strong>Total que falta</strong>
                    </td>
                    <td data-etiqueta="Total que falta" className="tabla__numero">
                      <strong>{[r.pendienteFlujo.ARS && redondo(r.pendienteFlujo.ARS, "ARS"), r.pendienteFlujo.USD && redondo(r.pendienteFlujo.USD, "USD")].filter(Boolean).join(" + ")}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>

      {c.notas.length > 0 && (
        <section className="ficha__notas">
          {c.notas.map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </section>
      )}

      {c.comentarios.length > 0 && (
        <section className="card ingresos__seccion solo-pantalla">
          <h2>Comentarios internos</h2>
          <div className="ficha__comentarios">
            {c.comentarios.map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function BarraAvance({ titulo, pagado, objetivo, clase }: { titulo: string; pagado: number; objetivo: number | null; clase: "formal" | "informal" }) {
  const avance = objetivo ? pagado / objetivo : null;
  return (
    <div className="ficha__avance">
      <div className="ficha__avance-texto">
        <strong>{titulo}</strong>
        <span>
          {usd(pagado)} de {usd(objetivo)} · <strong>{pct(avance)}</strong>
        </span>
      </div>
      <span className="avance avance--grande">
        <span className={`avance__tramo avance__tramo--${clase}`} style={{ width: `${Math.min(100, (avance ?? 0) * 100)}%` }} />
      </span>
    </div>
  );
}
