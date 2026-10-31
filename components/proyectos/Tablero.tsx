"use client";

import { resumen } from "@/lib/proyectos/comercial";
import { Icono } from "../Icono";
import { BarraLectura } from "../finanzas/comun";
import { m2, pct, useComercial, usd } from "./datos";
import { Origen } from "./Origen";
import { Supuestos } from "./Supuestos";

/** El tablero de un proyecto: avance comercial, plata, superficies y lo que hay que revisar. */
export function Tablero() {
  const { datos, error, cargando, actualizar } = useComercial();
  const c = datos?.comercial;
  const r = c ? resumen(c.unidades) : null;
  const s = c?.superficies;

  return (
    <div className="ingresos">
      <BarraLectura leido={datos?.leido ?? null} cargando={cargando} actualizar={actualizar} />
      {error && (
        <p role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" size={18} />
          <span>{error}</span>
        </p>
      )}
      {c && r && (
        <>
          <section aria-label="Avance comercial">
            <h2 className="cac__titulo-seccion">Avance comercial</h2>
            <div className="ingresos__cifras cuentas__cifras">
              <div className="cifra cifra--destacada">
                <span className="cifra__titulo">Unidades vendidas</span>
                <span className="cifra__valor">
                  {r.vendidas} de {r.deptos}
                </span>
                <span className="cifra__nota">
                  {pct(r.vendidas / r.deptos)} · quedan {r.libres} · cocheras {r.cocheras.vendidas} de {r.cocheras.total}
                  {r.enReventa.cantidad > 0 && ` · ${r.enReventa.cantidad} en reventa del dueño (${usd(r.enReventa.total)})`}
                </span>
                <Origen texto='Excel madre → "Lista de precios" → columna Estado (Vendido / Libre), con las correcciones confirmadas (ver "Supuestos"). Las unidades en reventa cuentan como vendidas: la reventa es del dueño, no del proyecto.' />
              </div>
              <div className="cifra">
                <span className="cifra__titulo">m² vendidos</span>
                <span className="cifra__valor">{m2(r.m2.vendidos, 0)}</span>
                <span className="cifra__nota">
                  {pct(r.m2.vendidos / r.m2.total)} de {m2(r.m2.total, 2)} vendibles · quedan {m2(r.m2.libres, 1)}
                </span>
                <span className="avance avance--grande tablero__avance">
                  <span className="avance__tramo avance__tramo--formal" style={{ width: `${(r.m2.vendidos / r.m2.total) * 100}%` }} />
                </span>
                <Origen texto='Excel madre → "Lista de precios" → columna "Sup Total" (superficie propia + amenities) de cada unidad.' />
              </div>
              <div className="cifra">
                <span className="cifra__titulo">Precio promedio de venta</span>
                <span className="cifra__valor">{usd(r.vendido.promedioM2)}/m²</span>
                <span className="cifra__nota">
                  Lista vigente: {usd(c.precioBaseM2)}/m² en el piso 1 (+{pct(c.aumentoPorPiso)} por piso)
                </span>
                <Origen
                  texto={`Precio de cada venta ("Costo estimado" del machete de "Ventas") ÷ su "Sup Total". ${
                    c.promedioVentaPlanilla.length ? `En la planilla, "¿A cuánto vendimos?" dice ${c.promedioVentaPlanilla.map((v) => usd(v)).join(" y ")}.` : ""
                  }`}
                />
              </div>
              <div className="cifra">
                <span className="cifra__titulo">Falta vender, a precio de lista</span>
                <span className="cifra__valor">{usd(r.porVender)}</span>
                <span className="cifra__nota">Vendido: {usd(r.vendido.total)} · total del proyecto {usd(r.vendido.total + r.porVender)}</span>
                <Origen texto="Suma del precio de lista vigente (valor con amenities + aumento por altura) de las unidades libres. Lo vendido, al precio de venta de cada unidad." />
              </div>
            </div>
          </section>

          <div className="tablero__fila">
            <section className="card grafico">
              <h2>Superficies del proyecto</h2>
              <dl className="tablero__superficies">
                {s?.terreno != null && (
                  <div>
                    <dt>Terreno</dt>
                    <dd>{m2(s.terreno)}</dd>
                  </div>
                )}
                {s?.construccion && (
                  <div>
                    <dt>Construcción</dt>
                    <dd>
                      {m2(s.construccion.cubierta + s.construccion.semicubierta + s.construccion.descubierta)}
                      <span>
                        cubiertos {m2(s.construccion.cubierta, 0)} · semicubiertos {m2(s.construccion.semicubierta, 0)} · descubiertos {m2(s.construccion.descubierta, 0)}
                      </span>
                    </dd>
                  </div>
                )}
                {s?.vendibles && (
                  <div>
                    <dt>De las unidades y comunes</dt>
                    <dd>
                      {m2(s.vendibles.total)}
                      <span>
                        {m2(s.vendibles.propios, 0)} de las unidades ({pct(s.vendibles.propios / s.vendibles.total)}) y {m2(s.vendibles.comunes, 0)} comunes: palier, escaleras,
                        circulación ({pct(s.vendibles.comunes / s.vendibles.total)}).
                      </span>
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Vendibles (lista de precios)</dt>
                  <dd>
                    {m2(r.m2.total)}
                    <span>Superficie propia de las 28 unidades más su parte de amenities.</span>
                  </dd>
                </div>
              </dl>
              <Origen texto='Excel madre → "Superficies" (filas "Superficie total", "TOTALES" y "TOTAL CONSTRUIBLE" de la tabla de vendibles) y "Lista de precios" (suma de "Sup Total").' />
            </section>

          </div>

          <Supuestos supuestos={c.supuestos} />
        </>
      )}
    </div>
  );
}
