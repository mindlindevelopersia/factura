"use client";

import { useState } from "react";
import { resumen } from "@/lib/proyectos/comercial";
import { Icono } from "../Icono";
import { BarraLectura } from "../finanzas/comun";
import { m2, pct, useComercial, usd } from "./datos";
import { Origen } from "./Origen";
import { RevisionHq } from "./RevisionHq";
import { Supuestos } from "./Supuestos";

/** Management del proyecto: los m² de los desarrolladores, a qué valor y el reparto entre socios. */
export function Desarrolladores() {
  const { datos, error, cargando, actualizar } = useComercial();
  const dev = datos?.desarrolladores;
  const c = datos?.comercial;
  const r = c ? resumen(c.unidades) : null;
  const [valor, setValor] = useState<string>("");
  const valorM2 = Number(valor.replace(",", ".")) || c?.precioBaseM2 || 0;

  return (
    <div className="ingresos">
      <BarraLectura leido={datos?.leido ?? null} cargando={cargando} actualizar={actualizar} />
      {error && (
        <p role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" size={18} />
          <span>{error}</span>
        </p>
      )}
      {datos && !dev && <p className="card ingresos__vacio">Este proyecto todavía no tiene definida la parte de los desarrolladores.</p>}
      {dev && c && r && (
        <>
          <p className="cobranzas__nota">
            Lo de los desarrolladores no es ingreso del edificio: se lleva en m² y se valúa aparte, al precio al que se termine vendiendo.
          </p>
          <div className="ingresos__cifras">
            <div className="cifra cifra--destacada">
              <span className="cifra__titulo">m² de los desarrolladores</span>
              <span className="cifra__valor">{m2(dev.m2, 2)}</span>
              <span className="cifra__nota">
                {pct(dev.parte)} de {m2(dev.m2Venta, 2)} vendibles · sin amenities
              </span>
              <Origen texto={`${pct(dev.parte)} de la suma de "Sup Propia VENTA" de la lista de precios (${m2(dev.m2Venta)}). Los amenities (${m2(dev.m2Amenities)}) no se cuentan.`} />
            </div>
            <div className="cifra">
              <span className="cifra__titulo">Valuados a {usd(valorM2)}/m²</span>
              <span className="cifra__valor">{usd(dev.m2 * valorM2)}</span>
              <span className="cifra__nota">El valor se elige abajo</span>
            </div>
            <div className="cifra">
              <span className="cifra__titulo">Stock sin vender</span>
              <span className="cifra__valor">{m2(r.m2.libres, 1)}</span>
              <span className="cifra__nota">Para terceros quedarían {m2(Math.max(0, r.m2.libres - dev.m2), 1)} si lo de los desarrolladores sale de ahí</span>
            </div>
          </div>

          <section className="card ingresos__filtros" aria-label="Valor por m²">
            <h2 className="lista__titulo">¿A qué valor?</h2>
            <div className="ingresos__campos">
              <label className="campo campo--filtro">
                Valor por m² (US$)
                <input inputMode="decimal" value={valor} placeholder={String(Math.round(c.precioBaseM2 ?? 0))} onChange={(e) => setValor(e.target.value)} />
              </label>
              <div className="ingresos__atajos lista__atajos">
                {[
                  [`Lista vigente (${usd(c.precioBaseM2)})`, c.precioBaseM2],
                  [`Promedio de venta (${usd(r.vendido.promedioM2)})`, r.vendido.promedioM2],
                  ["US$ 2.800", 2800],
                  ["US$ 3.000", 3000],
                ].map(([t, v]) =>
                  v ? (
                    <button key={String(t)} type="button" className={`btn btn--chico ${Math.round(valorM2) === Math.round(Number(v)) ? "btn--primario" : "btn--borde"}`} onClick={() => setValor(String(Math.round(Number(v))))}>
                      {t}
                    </button>
                  ) : null,
                )}
              </div>
            </div>
          </section>

          <section className="card ingresos__seccion">
            <h2>Reparto entre socios</h2>
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Socio</th>
                    <th className="tabla__numero">Parte</th>
                    <th className="tabla__numero">m²</th>
                    <th className="tabla__numero">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {dev.socios.map((s) => (
                    <tr key={s.nombre}>
                      <td data-etiqueta="Socio">{s.nombre}</td>
                      <td data-etiqueta="Parte" className="tabla__numero">
                        {pct(s.parte)}
                      </td>
                      <td data-etiqueta="m²" className="tabla__numero">
                        {m2(s.m2, 2)}
                      </td>
                      <td data-etiqueta="Valor" className="tabla__numero">
                        <strong>{usd(s.m2 * valorM2)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ficha__nota">El reparto (50 / 25 / 25) es el mismo en todos los proyectos. La parte de los desarrolladores puede cambiar según el proyecto.</p>
          </section>

          <Supuestos supuestos={dev.supuestos} titulo="Supuestos del management" />

          {dev.hq && <RevisionHq hq={dev.hq} />}
        </>
      )}
    </div>
  );
}
