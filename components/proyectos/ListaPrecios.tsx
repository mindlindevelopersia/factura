"use client";

import { useState } from "react";
import { precioSimulado } from "@/lib/proyectos/comercial";
import { Icono } from "../Icono";
import { BarraLectura } from "../finanzas/comun";
import { ExportarExcel } from "../ExportarExcel";
import { hojaUnidades } from "./excelUnidades";
import { m2, pct, useComercial, usd } from "./datos";
import { Origen } from "./Origen";

/** La lista de precios vigente de las unidades libres, con un simulador de precio por m² y aumento por piso. */
export function ListaPrecios() {
  const { datos, error, cargando, actualizar } = useComercial();
  const c = datos?.comercial;
  const [base, setBase] = useState<string>("");
  const [aumento, setAumento] = useState<string>("");
  const baseActual = c?.precioBaseM2 ?? 0;
  const aumentoActual = c?.aumentoPorPiso ?? 0;
  const baseSim = Number(base.replace(",", ".")) || baseActual;
  const aumentoSim = aumento ? Number(aumento.replace(",", ".")) / 100 : aumentoActual;
  const libres = (c?.unidades ?? []).filter((u) => u.estado === "libre");
  const reventas = (c?.unidades ?? []).filter((u) => u.reventa);
  const totalActual = libres.reduce((s, u) => s + u.precioLista, 0);
  const totalSim = libres.reduce((s, u) => s + precioSimulado(u, baseSim, aumentoSim), 0);
  const simulando = baseSim !== baseActual || aumentoSim !== aumentoActual;

  return (
    <div className="ingresos">
      <BarraLectura
        leido={datos?.leido ?? null}
        cargando={cargando}
        actualizar={actualizar}
        extra={c && <ExportarExcel nombre="Lista de precios" hojas={() => [hojaUnidades(libres, "Lista de precios: unidades libres", simulando ? (u) => precioSimulado(u, baseSim, aumentoSim) : undefined)]} />}
      />
      {error && (
        <p role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" size={18} />
          <span>{error}</span>
        </p>
      )}
      {c && (
        <>
          <div className="ingresos__cifras">
            <div className="cifra cifra--destacada">
              <span className="cifra__titulo">Precio vigente en el piso 1</span>
              <span className="cifra__valor">{usd(baseActual)}/m²</span>
              <span className="cifra__nota">+{pct(aumentoActual)} por cada piso de altura</span>
              <Origen texto='Deducido de "Lista de precios": (precio − aumento por altura) ÷ (m² de venta + amenities), y "Aumento por altura". En la planilla, EE.RR M56 y J77.' />
            </div>
            <div className="cifra">
              <span className="cifra__titulo">Lo que falta vender, a lista</span>
              <span className="cifra__valor">{usd(totalActual)}</span>
              <span className="cifra__nota">
                {libres.length} unidades · {m2(libres.reduce((s, u) => s + u.supTotal, 0), 1)}
              </span>
            </div>
            <div className="cifra">
              <span className="cifra__titulo">{simulando ? "Con el precio simulado" : "Simulador"}</span>
              <span className="cifra__valor">{simulando ? usd(totalSim) : "—"}</span>
              <span className="cifra__nota">{simulando ? `${totalSim >= totalActual ? "+" : ""}${usd(totalSim - totalActual)} contra la lista vigente` : "Cambiá el precio por m² abajo"}</span>
            </div>
          </div>

          <section className="card ingresos__filtros" aria-label="Simulador">
            <h2 className="lista__titulo">Simular otra lista</h2>
            <div className="ingresos__campos">
              <label className="campo campo--filtro">
                Precio por m² en el piso 1 (US$)
                <input inputMode="decimal" value={base} placeholder={String(Math.round(baseActual))} onChange={(e) => setBase(e.target.value)} />
              </label>
              <label className="campo campo--filtro">
                Aumento por piso (%)
                <input inputMode="decimal" value={aumento} placeholder={(aumentoActual * 100).toLocaleString("es-AR")} onChange={(e) => setAumento(e.target.value)} />
              </label>
              <div className="ingresos__atajos lista__atajos">
                {[2700, 2800, 3000].map((v) => (
                  <button key={v} type="button" className={`btn btn--chico ${baseSim === v ? "btn--primario" : "btn--borde"}`} onClick={() => setBase(String(v))}>
                    US$ {v.toLocaleString("es-AR")}
                  </button>
                ))}
                {simulando && (
                  <button
                    type="button"
                    className="btn btn--texto btn--chico"
                    onClick={() => {
                      setBase("");
                      setAumento("");
                    }}
                  >
                    Volver a la vigente
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="card ingresos__seccion">
            <h2>Unidades libres</h2>
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Unidad</th>
                    <th className="tabla__numero">m² (venta + amenities)</th>
                    <th className="tabla__numero">Precio de lista</th>
                    {simulando && <th className="tabla__numero">Simulado</th>}
                  </tr>
                </thead>
                <tbody>
                  {libres.map((u) => (
                    <tr key={u.codigo}>
                      <td data-etiqueta="Unidad">
                        <strong>{u.codigo}</strong>
                        <span className="tabla__sub">
                          {u.tipologia} · {u.orientacion}
                        </span>
                      </td>
                      <td data-etiqueta="m²" className="tabla__numero">
                        {m2(u.supVenta + u.supAmenities)}
                        <span className="tabla__sub">total {m2(u.supTotal)}</span>
                      </td>
                      <td data-etiqueta="Precio de lista" className="tabla__numero">
                        {usd(u.precioLista)}
                        {u.precioM2Lista && <span className="tabla__sub">{usd(u.precioM2Lista)}/m²</span>}
                      </td>
                      {simulando && (
                        <td data-etiqueta="Simulado" className="tabla__numero">
                          <strong>{usd(precioSimulado(u, baseSim, aumentoSim))}</strong>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ficha__nota">
              Precio = (m² de venta + amenities) × precio por m² × (1 + aumento por piso × pisos por encima del primero). Las terrazas se cuentan al porcentaje de la columna
              &quot;Ajuste m2 x terraza&quot;.
            </p>
          </section>

          {reventas.length > 0 && (
            <section className="card ingresos__seccion">
              <h2>En reventa</h2>
              <p className="ficha__nota">Ya están vendidas: las revende su dueño. No suman a lo que falta vender del proyecto, pero también están disponibles.</p>
              <div className="tabla-contenedor">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Unidad</th>
                      <th className="tabla__numero">Sup. total</th>
                      <th className="tabla__numero">Precio de reventa</th>
                      <th className="tabla__numero">Lista vigente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reventas.map((u) => (
                      <tr key={u.codigo}>
                        <td data-etiqueta="Unidad">
                          <strong>{u.codigo}</strong>
                          <span className="tabla__sub">
                            {u.tipologia} · {u.orientacion}
                          </span>
                        </td>
                        <td data-etiqueta="Sup. total" className="tabla__numero">
                          {m2(u.supTotal)}
                        </td>
                        <td data-etiqueta="Precio de reventa" className="tabla__numero">
                          <strong>{usd(u.reventa)}</strong>
                          {u.supPromedio > 0 && <span className="tabla__sub">{usd(u.reventa! / u.supPromedio)}/m²</span>}
                        </td>
                        <td data-etiqueta="Lista vigente" className="tabla__numero">
                          {usd(u.precioLista)}
                          <span className="tabla__sub">para comparar</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Origen texto="Precio que pidió el dueño, confirmado el 31/10/2026 (cargado en el hub). La lista vigente es la de la planilla, para comparar." />
            </section>
          )}
        </>
      )}
    </div>
  );
}
