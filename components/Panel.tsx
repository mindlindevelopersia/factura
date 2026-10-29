"use client";

import { useCallback, useEffect, useState } from "react";
import type { Enlace } from "@/lib/enlaces";
import type { MesPanel, Monto, ResumenPanel } from "@/lib/panel";
import { fechaHora, importe, leerJson } from "./formato";

/** El panel se actualiza solo, sin apuro: los números de la planilla cambian pocas veces por día. */
const REFRESCO_MS = 60_000;

const compacto = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });
const pesosCompacto = (n: number) => `$\u00a0${compacto.format(n)}`;

function nombreMes(mes: string, formato: "short" | "long" = "long"): string {
  const [anio, m] = mes.split("-").map(Number);
  const nombre = new Intl.DateTimeFormat("es-AR", { month: formato, timeZone: "UTC" }).format(new Date(Date.UTC(anio, m - 1, 1)));
  return formato === "long" ? nombre : nombre.replace(".", "");
}

/** Un máximo redondo para el eje y sus marcas: 0, 1/4, 1/2, 3/4 y el máximo. */
function escala(maximo: number): number[] {
  if (maximo <= 0) return [0, 1];
  const paso = 10 ** Math.floor(Math.log10(maximo / 4));
  const tope = Math.ceil(maximo / 4 / paso) * paso * 4;
  return [0, tope / 4, tope / 2, (tope * 3) / 4, tope];
}

const ESTADOS: Record<string, string> = {
  leyendo: "Leyendo",
  pendiente: "Para revisar",
  error: "Error",
  aprobando: "Aprobando",
  aprobada: "Cargada",
  descartada: "Descartada",
};

function Acceso({ enlace }: { enlace: Enlace }) {
  const icono =
    enlace.grupo === "planilla" ? (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2 2h12v12H2z M2 6h12 M2 10h12 M6 2v12" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ) : (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M1.5 3.5h5l1.5 2h6.5v7.5h-13z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  if (enlace.falta) {
    return (
      <span className="acceso acceso--off" title={enlace.falta} aria-disabled="true">
        {icono}
        {enlace.texto}
      </span>
    );
  }
  return (
    <a className="acceso" href={`/ir/${enlace.destino}`} target="_blank" rel="noopener">
      {icono}
      {enlace.texto}
      <span className="acceso__flecha" aria-hidden="true">
        ↗
      </span>
    </a>
  );
}

/** Un total del mes: compacto en grande ($ 21,8 M) y exacto abajo. */
function Cifra({ titulo, monto }: { titulo: string; monto: Monto }) {
  return (
    <div className="cifra">
      <span className="cifra__titulo">{titulo}</span>
      <span className="cifra__valor">{pesosCompacto(monto.total)}</span>
      <span className="cifra__nota">
        {monto.cantidad} {monto.cantidad === 1 ? "factura" : "facturas"}
        {monto.cantidad > 0 && ` · ${importe(monto.total)}`}
      </span>
    </div>
  );
}

/** Egresos e ingresos de cada mes, en columnas agrupadas sobre un mismo eje en pesos. */
function GraficoMeses({ meses }: { meses: MesPanel[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const marcas = escala(Math.max(...meses.flatMap((m) => [m.egresos.total, m.ingresos.total])));
  const tope = marcas.at(-1)!;
  const alto = (n: number) => `${(Math.max(n, 0) / tope) * 100}%`;
  const sinDatos = meses.every((m) => m.egresos.cantidad === 0 && m.ingresos.cantidad === 0);

  return (
    <figure className="card grafico">
      <figcaption>
        <h2>Egresos e ingresos por mes</h2>
        <p className="grafico__sub">Últimos 12 meses, en pesos, por fecha de factura. Incluye lo cargado a mano.</p>
      </figcaption>
      <ul className="leyenda">
        <li>
          <span className="leyenda__marca leyenda__marca--egresos" /> Egresos (compras y honorarios)
        </li>
        <li>
          <span className="leyenda__marca leyenda__marca--ingresos" /> Ingresos (ventas)
        </li>
      </ul>
      {sinDatos ? (
        <p className="carga__resumen">Todavía no hay facturas con fecha en estos meses.</p>
      ) : (
        <div className="columnas" role="img" aria-label="Egresos e ingresos de los últimos 12 meses. El detalle está en la tabla de abajo.">
          <div className="columnas__eje" aria-hidden="true">
            {marcas.map((m) => (
              <span key={m} style={{ bottom: alto(m) }}>
                {m === 0 ? "0" : pesosCompacto(m)}
              </span>
            ))}
          </div>
          <div className="columnas__area">
            {marcas.map((m) => (
              <span key={m} className="columnas__linea" style={{ bottom: alto(m) }} aria-hidden="true" />
            ))}
            {meses.map((m, i) => (
              <div
                key={m.mes}
                className={`columnas__grupo${activo === i ? " columnas__grupo--activo" : ""}`}
                tabIndex={0}
                onMouseEnter={() => setActivo(i)}
                onMouseLeave={() => setActivo(null)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
                aria-label={`${nombreMes(m.mes)}: egresos ${importe(m.egresos.total)}, ingresos ${importe(m.ingresos.total)}`}
              >
                <div className="columnas__barras">
                  <span className="columnas__barra columnas__barra--egresos" style={{ height: alto(m.egresos.total) }} />
                  <span className="columnas__barra columnas__barra--ingresos" style={{ height: alto(m.ingresos.total) }} />
                </div>
                <span className="columnas__mes">{nombreMes(m.mes, "short")}</span>
                {activo === i && (
                  <div className={`tooltip${i < 2 ? " tooltip--izq" : i > meses.length - 3 ? " tooltip--der" : ""}`} role="tooltip">
                    <strong>
                      {nombreMes(m.mes)} {m.mes.slice(0, 4)}
                    </strong>
                    <span>
                      <i className="leyenda__marca leyenda__marca--egresos" /> Egresos {importe(m.egresos.total)} ({m.egresos.cantidad})
                    </span>
                    <span>
                      <i className="leyenda__marca leyenda__marca--ingresos" /> Ingresos {importe(m.ingresos.total)} ({m.ingresos.cantidad})
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <details className="grafico__tabla">
        <summary>Ver como tabla</summary>
        <table className="tabla">
          <thead>
            <tr>
              <th>Mes</th>
              <th className="tabla__numero">Egresos</th>
              <th className="tabla__numero">Ingresos</th>
            </tr>
          </thead>
          <tbody>
            {[...meses].reverse().map((m) => (
              <tr key={m.mes}>
                <td>
                  {nombreMes(m.mes)} {m.mes.slice(0, 4)}
                </td>
                <td className="tabla__numero">
                  {importe(m.egresos.total)} <span className="tabla__sub">{m.egresos.cantidad} facturas</span>
                </td>
                <td className="tabla__numero">
                  {importe(m.ingresos.total)} <span className="tabla__sub">{m.ingresos.cantidad} facturas</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Los proveedores con más compras del mes, en barras horizontales con el valor en la punta. */
function GraficoProveedores({ proveedores }: { proveedores: ResumenPanel["proveedores"] }) {
  const filas = [
    ...proveedores.lista.map((p) => ({ ...p, otros: false })),
    ...(proveedores.otros.cantidad > 0 ? [{ nombre: "Otros", total: proveedores.otros.total, cantidad: proveedores.otros.cantidad, otros: true }] : []),
  ];
  const maximo = Math.max(...filas.map((f) => f.total), 1);
  return (
    <figure className="card grafico">
      <figcaption>
        <h2>Compras de {nombreMes(proveedores.mes)} por proveedor</h2>
        <p className="grafico__sub">En pesos, sin honorarios. Las notas de crédito restan.</p>
      </figcaption>
      {filas.length === 0 ? (
        <p className="carga__resumen">Todavía no hay compras este mes.</p>
      ) : (
        <ul className="barras">
          {filas.map((f) => (
            <li key={f.nombre} className="barras__fila" title={`${f.nombre}: ${importe(f.total)} en ${f.cantidad} ${f.cantidad === 1 ? "factura" : "facturas"}`}>
              <span className="barras__nombre">{f.otros ? `Otros (${f.cantidad})` : f.nombre}</span>
              <span className="barras__pista">
                <span className={`barras__barra${f.otros ? " barras__barra--otros" : ""}`} style={{ width: `${(Math.max(f.total, 0) / maximo) * 100}%` }} />
                <span className="barras__valor">{pesosCompacto(f.total)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

/**
 * Inicio: lo que espera revisión, los números del mes, la evolución de los últimos 12 meses y
 * los accesos directos a la planilla y a Drive.
 */
export function Panel({ onIrA }: { onIrA: (vista: "revisar" | "subir" | "historial") => void }) {
  const [datos, setDatos] = useState<{ resumen: ResumenPanel; enlaces: Enlace[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await leerJson(await fetch("/api/panel", { cache: "no-store" })));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void cargar();
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") void cargar();
    }, REFRESCO_MS);
    return () => clearInterval(intervalo);
  }, [cargar]);

  if (error && !datos) return <p className="alerta alerta--error">{error}</p>;
  if (!datos) return <p className="carga__resumen">Cargando el panel…</p>;

  const { resumen: r, enlaces } = datos;
  const mes = nombreMes(r.mes);
  const porRevisar = r.cola.paraRevisar + r.cola.conError;

  return (
    <div className="panel">
      <nav className="accesos" aria-label="Accesos directos">
        {enlaces.map((e) => (
          <Acceso key={e.destino} enlace={e} />
        ))}
      </nav>

      {r.sinPlanilla && <p className="alerta alerta--aviso">No se pudo leer la planilla: {r.sinPlanilla}</p>}

      <div className="panel__cifras">
        <button type="button" className={`cifra cifra--hero${porRevisar > 0 ? " cifra--pendiente" : ""}`} onClick={() => onIrA("revisar")}>
          <span className="cifra__titulo">Para revisar</span>
          <span className="cifra__valor">{porRevisar}</span>
          <span className="cifra__nota">
            {porRevisar === 0
              ? "Todo al día"
              : [
                  r.cola.paraRevisar && `${r.cola.paraRevisar} ${r.cola.paraRevisar === 1 ? "lista" : "listas"} para aprobar`,
                  r.cola.conError && `${r.cola.conError} con error`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
            {r.cola.leyendo > 0 && ` · ${r.cola.leyendo} leyéndose`}
          </span>
          <span className="cifra__accion">Revisar →</span>
        </button>
        <Cifra titulo={`Compras de ${mes}`} monto={r.mesActual.compras} />
        <Cifra titulo={`Honorarios de ${mes}`} monto={r.mesActual.honorarios} />
        <Cifra titulo={`Ventas de ${mes}`} monto={r.mesActual.ventas} />
        <div className="cifra">
          <span className="cifra__titulo">Cargadas por la app en {mes}</span>
          <span className="cifra__valor">{r.app.cargadas}</span>
          <span className="cifra__nota">
            {r.app.cargadas === 0
              ? "Ninguna todavía"
              : `${r.app.porTelegram} por Telegram${r.app.horasHastaCarga != null ? ` · ${r.app.horasHastaCarga < 1 ? "menos de 1 h" : `${Math.round(r.app.horasHastaCarga)} h`} de la llegada a la carga (mediana)` : ""}`}
          </span>
        </div>
      </div>
      {r.enOtraMoneda > 0 && (
        <p className="factura__nota">
          {r.enOtraMoneda} {r.enOtraMoneda === 1 ? "factura" : "facturas"} de los últimos 12 meses en otra moneda no se suman a los totales en pesos.
        </p>
      )}

      <div className="panel__graficos">
        <GraficoMeses meses={r.meses} />
        <GraficoProveedores proveedores={r.proveedores} />
      </div>

      <section className="card recientes" aria-label="Actividad reciente">
        <div className="recientes__encabezado">
          <h2>Actividad reciente</h2>
          <button type="button" className="btn btn--borde btn--chico" onClick={() => onIrA("historial")}>
            Ver todo
          </button>
        </div>
        {r.recientes.length === 0 ? (
          <p className="carga__resumen">Todavía no llegó ninguna factura a la app.</p>
        ) : (
          <ul className="recientes__lista">
            {r.recientes.map((x) => (
              <li key={x.id}>
                <span className={`estado estado--${x.estado === "aprobada" ? "guardada" : x.estado === "pendiente" || x.estado === "aprobando" ? "revision" : x.estado}`}>
                  {ESTADOS[x.estado]}
                </span>
                <span className="recientes__texto">
                  <strong>{x.contraparte}</strong> {x.comprobante}
                  <span className="tabla__sub">
                    {fechaHora(x.cuando)} · {x.origen === "telegram" ? "Telegram" : "Web"}
                    {x.total != null && ` · ${importe(x.total, x.moneda)}`}
                  </span>
                </span>
                {x.fila && x.pestania && (
                  <a className="recientes__fila" href={`/ir/planilla-${x.pestania}?fila=${x.fila}`} target="_blank" rel="noopener">
                    Fila {x.fila} ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
