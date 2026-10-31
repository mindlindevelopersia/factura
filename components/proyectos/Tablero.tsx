"use client";

import Link from "next/link";
import { resumen } from "@/lib/proyectos/comercial";
import { Icono } from "../Icono";
import { BarraLectura } from "../finanzas/comun";
import { m2, pct, useComercial, useProyectoId, usd } from "./datos";
import { Origen } from "./Origen";
import { Supuestos } from "./Supuestos";

/** El tablero de un proyecto: avance comercial, plata, superficies y lo que hay que revisar. */
export function Tablero() {
  const { datos, error, cargando, actualizar } = useComercial();
  const id = useProyectoId();
  const c = datos?.comercial;
  const r = c ? resumen(c.unidades) : null;
  const dev = datos?.desarrolladores;
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
                </span>
                <Origen texto='Excel madre → "Lista de precios" → columna Estado (Vendido / Libre). La lista manda.' />
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
                <Origen
                  marca="por-confirmar"
                  texto={`Suma del precio de lista vigente (valor con amenities + aumento por altura) de las unidades libres.${
                    dev ? ` Incluye los ${m2(dev.m2.total, 1)} que les tocarían a los desarrolladores (ver Management).` : ""
                  }`}
                />
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

            {dev && (
              <section className="card grafico">
                <h2>Desarrolladores</h2>
                <p className="tablero__dev">
                  <strong>{m2(dev.m2.total, 1)}</strong> para los desarrolladores ({pct(dev.parte)}).
                </p>
                <ul className="tablero__socios">
                  {dev.socios.map((x) => (
                    <li key={x.nombre}>
                      {x.nombre} <span>{pct(x.parte)}</span> <strong>{m2(x.m2, 1)}</strong>
                    </li>
                  ))}
                </ul>
                <Origen marca="por-confirmar" texto="15% de los m² de venta sin amenities + 15% del 85% de los amenities. Ver los detalles en Management." />
                <Link href={`/proyectos/${id}/management/desarrolladores`} className="btn btn--borde btn--chico tablero__ir">
                  Ver Management
                  <Icono nombre="flecha" size={16} />
                </Link>
              </section>
            )}
          </div>

          <Supuestos supuestos={[...c.supuestos, ...(dev?.supuestos ?? [])]} />
        </>
      )}
    </div>
  );
}
