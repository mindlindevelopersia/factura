"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MODALIDADES, type Unidad } from "@/lib/proyectos/comercial";
import { Icono } from "../Icono";
import { BarraLectura } from "../finanzas/comun";
import { m2, useComercial, useProyectoId, usd } from "./datos";
import { Origen } from "./Origen";
import { Supuestos } from "./Supuestos";

type Filtro = "todas" | "vendida" | "libre";

/** Las unidades del proyecto: el edificio piso por piso, la tabla y el detalle de cada una. */
export function Unidades() {
  const { datos, error, cargando, actualizar } = useComercial();
  const id = useProyectoId();
  const [elegida, setElegida] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const c = datos?.comercial;
  const conConflicto = useMemo(() => new Set((c?.supuestos ?? []).filter((s) => s.tipo !== "confirmado").map((s) => s.titulo.split(":")[0].trim())), [c]);
  const pisos = useMemo(() => {
    const m = new Map<number, Unidad[]>();
    for (const u of c?.unidades ?? []) if (!u.esCochera) m.set(u.nivel, [...(m.get(u.nivel) ?? []), u]);
    return [...m].sort(([a], [b]) => b - a);
  }, [c]);
  const u = c?.unidades.find((x) => x.codigo === elegida) ?? null;
  const lista = (c?.unidades ?? []).filter((x) => filtro === "todas" || x.estado === filtro);

  return (
    <div className="ingresos">
      <BarraLectura leido={datos?.leido ?? null} cargando={cargando} actualizar={actualizar} />
      {error && (
        <p role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" size={18} />
          <span>{error}</span>
        </p>
      )}
      {c && (
        <>
          <div className="unidades__arriba">
            <section className="card grafico edificio" aria-label="El edificio piso por piso">
              <h2>El edificio</h2>
              <ul className="leyenda">
                <li>
                  <span className="leyenda__marca edificio__marca--vendida" /> Vendida
                </li>
                <li>
                  <span className="leyenda__marca edificio__marca--libre" /> Libre
                </li>
                <li>
                  <span className="leyenda__marca edificio__marca--reventa" /> En reventa
                </li>
                <li>
                  <span className="leyenda__marca edificio__marca--revisar" /> Revisar
                </li>
              </ul>
              <div className="edificio__pisos">
                {pisos.map(([nivel, us]) => (
                  <div key={nivel} className="edificio__piso">
                    <span className="edificio__nivel">{nivel === 0 ? "PB" : `${nivel}°`}</span>
                    <div className="edificio__unidades">
                      {us
                        .sort((a, b) => a.letra.localeCompare(b.letra))
                        .map((x) => (
                          <button
                            key={x.codigo}
                            type="button"
                            className={`edificio__unidad edificio__unidad--${x.estado}${x.reventa ? " edificio__unidad--reventa" : ""}${conConflicto.has(x.codigo) ? " edificio__unidad--revisar" : ""}${elegida === x.codigo ? " edificio__unidad--elegida" : ""}`}
                            style={{ flexGrow: Math.max(1, x.supTotal) }}
                            onClick={() => setElegida(elegida === x.codigo ? null : x.codigo)}
                            aria-pressed={elegida === x.codigo}
                            title={`${x.codigo} · ${x.tipologia} · ${m2(x.supTotal, 1)} · ${x.estado === "vendida" ? x.inversor : "libre"}${x.reventa ? " · en reventa" : ""}`}
                          >
                            <strong>{x.codigo}</strong>
                            <span>{m2(x.supTotal, 0)}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
                <div className="edificio__piso edificio__piso--cocheras">
                  <span className="edificio__nivel">Coch.</span>
                  <div className="edificio__unidades">
                    {c.unidades
                      .filter((x) => x.esCochera)
                      .map((x) => (
                        <button key={x.codigo} type="button" className={`edificio__unidad edificio__unidad--${x.estado}`} onClick={() => setElegida(x.codigo)} title={`${x.codigo} · ${x.inversor}`}>
                          <strong>{x.codigo}</strong>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
              <Origen texto='Excel madre → "Lista de precios": una fila por unidad (Piso, Letra, Estado, Sup Total). El ancho de cada unidad es proporcional a sus m².' />
            </section>
            <Detalle u={u} base={`/proyectos/${id}`} />
          </div>

          <section className="card ingresos__seccion">
            <div className="ingresos__titulo cuentas__controles">
              <h2>Unidades ({lista.length})</h2>
              <div className="ingresos__atajos" role="group" aria-label="Filtrar">
                {(
                  [
                    ["todas", "Todas"],
                    ["vendida", "Vendidas"],
                    ["libre", "Libres"],
                  ] as const
                ).map(([f, t]) => (
                  <button key={f} type="button" className={`btn btn--chico ${filtro === f ? "btn--primario" : "btn--borde"}`} aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Unidad</th>
                    <th>Estado</th>
                    <th className="tabla__numero">Sup. total</th>
                    <th className="tabla__numero">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((x) => (
                    <tr key={x.codigo}>
                      <td data-etiqueta="Unidad">
                        <button type="button" className="ingresos__enlace" onClick={() => setElegida(x.codigo)}>
                          {x.codigo}
                        </button>
                        <span className="tabla__sub">
                          {x.tipologia}
                          {x.orientacion && ` · ${x.orientacion}`}
                        </span>
                      </td>
                      <td data-etiqueta="Estado">
                        {x.estado === "vendida" ? "Vendida" : x.estado === "libre" ? "Libre" : x.estadoTexto}
                        {x.inversor && <span className="tabla__sub">{x.inversor}</span>}
                        {(x.modalidad || x.contrato || x.reventa) && (
                          <span className="tabla__sub">{[modalidad(x), x.contrato && x.modalidad !== "canje" && "Pagada con contrato", x.reventa && "En reventa"].filter(Boolean).join(" · ")}</span>
                        )}
                        {conConflicto.has(x.codigo) && (
                          <span className="tabla__sub cuentas__aviso">
                            <Icono nombre="alerta" size={12} /> revisar
                          </span>
                        )}
                      </td>
                      <td data-etiqueta="Sup. total" className="tabla__numero">
                        {x.esCochera ? "—" : m2(x.supTotal)}
                      </td>
                      <td data-etiqueta="Precio" className="tabla__numero">
                        <Precio u={x} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <Supuestos supuestos={c.supuestos.filter((s) => s.tipo !== "confirmado")} titulo="Unidades a revisar" />
        </>
      )}
    </div>
  );
}

function Detalle({ u, base }: { u: Unidad | null; base: string }) {
  if (!u) {
    return (
      <aside className="card grafico unidad__detalle unidad__detalle--vacio">
        <Icono nombre="flecha" size={18} />
        <p>Tocá una unidad del edificio para ver sus superficies, su precio y su venta.</p>
      </aside>
    );
  }
  const v = u.venta;
  return (
    <aside className="card grafico unidad__detalle" aria-label={`Unidad ${u.codigo}`}>
      <span className="eyebrow">{u.esCochera ? "Cochera" : `Piso ${u.piso} · ${u.orientacion}`}</span>
      <h2>
        {u.codigo} {!u.esCochera && <span className="unidad__tipo">{u.tipologia}</span>}
      </h2>
      <p className={`unidad__estado unidad__estado--${u.estado}`}>
        {u.estado === "vendida" ? `Vendida · ${u.inversor}` : u.estado === "libre" ? "Libre" : u.estadoTexto}
        {u.contrato && " · pagada con contrato"}
      </p>
      {u.modalidad && (
        <p className={`unidad__modalidad unidad__modalidad--${u.modalidad}`}>
          {modalidad(u)}
          <span>
            {u.modalidad === "costo"
              ? u.tope != null
                ? ` · al final paga la diferencia del costo real, hasta un ${(u.tope * 100).toLocaleString("es-AR")}% más`
                : " · al final se ajusta al costo real × su coeficiente"
              : u.modalidad === "cerrado"
                ? " · no se ajusta al final de la obra"
                : " · se pagó con obra"}
          </span>
        </p>
      )}
      {u.ajuste && (
        <p className="unidad__ajuste">
          <Icono nombre="alerta" size={14} />
          <span>{u.ajuste}</span>
        </p>
      )}
      {!u.esCochera && (
        <dl className="unidad__datos">
          <div>
            <dt>Cubierta</dt>
            <dd>{m2(u.supCubierta)}</dd>
          </div>
          <div>
            <dt>Semicubierta</dt>
            <dd>{m2(u.supSemicubierta)}</dd>
          </div>
          <div>
            <dt>Descubierta</dt>
            <dd>{m2(u.supDescubierta)}</dd>
          </div>
          <div>
            <dt>Propia de venta</dt>
            <dd>{m2(u.supVenta)}</dd>
          </div>
          <div>
            <dt>Amenities</dt>
            <dd>{m2(u.supAmenities)}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>
              <strong>{m2(u.supTotal)}</strong>
            </dd>
          </div>
          <div>
            <dt>Coeficiente</dt>
            <dd>{(u.coeficiente * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%</dd>
          </div>
        </dl>
      )}
      <dl className="unidad__datos">
        {u.estado === "vendida" ? (
          <>
            <div>
              <dt>Precio de venta</dt>
              <dd>
                <strong>{usd(u.precioVenta)}</strong>
                {u.precioVenta != null && u.supTotal > 0 && <span> · {usd(u.precioVenta / u.supTotal)}/m²</span>}
              </dd>
            </div>
            <div>
              <dt>Según cada planilla</dt>
              <dd>
                Ventas {usd(u.venta?.costoEstimado)} · Pagos por Inversor {u.contrato && u.precioCuenta == null ? "no tiene (contrato)" : usd(u.precioCuenta)}
              </dd>
            </div>
            {u.reventa && (
              <div>
                <dt>En reventa</dt>
                <dd>
                  <strong>{usd(u.reventa)}</strong>
                  {u.supTotal > 0 && <span> · {usd(u.reventa / u.supTotal)}/m²</span>}
                  <span className="tabla__sub">La revende el dueño: no es plata del proyecto.</span>
                </dd>
              </div>
            )}
          </>
        ) : (
          <div>
            <dt>Precio de lista vigente</dt>
            <dd>
              <strong>{usd(u.precioLista)}</strong>
              {u.precioM2Lista && <span> · {usd(u.precioM2Lista)}/m²</span>}
            </dd>
          </div>
        )}
      </dl>
      {v && (
        <div className="unidad__machete">
          <strong>Machete de la venta</strong>
          <p>
            {v.nombre} · {v.tipo || "—"} · unidad &quot;{v.unidad}&quot;
          </p>
          <p>
            Al boleto: {usd(v.montoBoleto)} (blanco {usd(v.blanco)} · negro {usd(v.negro)})
          </p>
          <Origen texto={`Excel madre → "Ventas", fila ${v.fila}.`} />
        </div>
      )}
      <Origen
        texto={
          u.estado === "vendida"
            ? `Estado: Excel madre → "Lista de precios", fila ${u.fila}. Precio de venta: "Costo estimado" del machete de "Ventas"${u.venta ? ` (fila ${u.venta.fila})` : ""}; si no está, el "Costo Estimado Departamento" de "Pagos por Inversor".`
            : `Excel madre → "Lista de precios", fila ${u.fila}. Precio de lista = valor con amenities + aumento por altura.`
        }
      />
      {u.estado === "vendida" && !u.contrato && (
        <Link href={`${base}/inversores/cuentas-corrientes`} className="btn btn--borde btn--chico">
          Ver cuentas corrientes
          <Icono nombre="flecha" size={16} />
        </Link>
      )}
    </aside>
  );
}

function modalidad(u: Unidad): string {
  if (!u.modalidad) return "";
  return MODALIDADES[u.modalidad] + (u.tope != null ? ` con tope ${(u.tope * 100).toLocaleString("es-AR")}%` : "");
}

/** El precio que corresponde: el de venta si está vendida, el de lista vigente si está libre. */
function Precio({ u }: { u: Unidad }) {
  if (u.estado === "vendida") {
    return (
      <>
        {u.precioVenta != null ? usd(u.precioVenta) : "—"}
        <span className="tabla__sub">
          {u.precioVenta == null ? "Venta sin precio cargado" : `Venta${u.supTotal > 0 ? ` · ${usd(u.precioVenta / u.supTotal)}/m²` : ""}`}
        </span>
        {u.reventa && <span className="tabla__sub unidad__reventa">Reventa: {usd(u.reventa)}</span>}
      </>
    );
  }
  return (
    <>
      {usd(u.precioLista)}
      <span className="tabla__sub">Lista vigente{u.precioM2Lista ? ` · ${usd(u.precioM2Lista)}/m²` : ""}</span>
    </>
  );
}
