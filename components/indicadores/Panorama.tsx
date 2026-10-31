"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { nombreMes, sumarMeses } from "@/lib/finanzas/ingresos";
import { TEXTO_SENAL, type AnalisisMaterial } from "@/lib/indicadores/materiales";
import { base100, comparar, ranking, real, type SerieMensual, type Variacion } from "@/lib/indicadores/series";
import { Icono } from "../Icono";
import { BarraLectura, opcionesDeMeses, Selector } from "../finanzas/comun";
import { CLASE_SENAL, COLOR_SERIE, pctSigno, TEXTO_CORTO, usePanorama } from "./datos";
import { GraficoLineas } from "./GraficoLineas";

const POR_DEFECTO = ["cac", "ipc", "blue", "insumo-142001", "insumo-4001"];

/** El inicio de Indicadores: qué subió más en un período, el CAC contra la inflación y el dólar, y las alarmas de compra. */
export function Panorama() {
  const { datos, error, cargando, actualizar } = usePanorama();
  const ultimoMes = datos?.cacUltimo ?? null;
  const [periodo, setPeriodo] = useState<{ desde: string | null; hasta: string | null }>({ desde: null, hasta: null });
  const hasta = periodo.hasta ?? ultimoMes;
  const desde = periodo.desde ?? (hasta ? sumarMeses(hasta, -12) : null);
  const [visibles, setVisibles] = useState<string[]>(POR_DEFECTO);

  const r = useMemo(() => (datos && desde && hasta ? ranking(datos.series, desde, hasta) : []), [datos, desde, hasta]);
  const opciones = useMemo(() => (datos ? opcionesDeMeses(datos.series.flatMap((s) => s.puntos.map((p) => p.mes))) : []), [datos]);

  return (
    <div className="ingresos">
      <BarraLectura leido={datos?.leido ?? null} cargando={cargando} actualizar={actualizar} />
      {error && (
        <p role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" size={18} />
          <span>{error}</span>
        </p>
      )}
      {datos && desde && hasta && (
        <>
          <section className="card ingresos__filtros" aria-label="Período">
            <div className="ingresos__atajos" role="group" aria-label="Período">
              {(
                [
                  ["Últimos 12 meses", 12],
                  ["24 meses", 24],
                  ["3 años", 36],
                  ["5 años", 60],
                ] as const
              ).map(([texto, n]) => {
                const d = sumarMeses(ultimoMes!, -n);
                const activo = desde === d && hasta === ultimoMes;
                return (
                  <button key={texto} type="button" className={`btn btn--chico ${activo ? "btn--primario" : "btn--borde"}`} aria-pressed={activo} onClick={() => setPeriodo({ desde: d, hasta: null })}>
                    {texto}
                  </button>
                );
              })}
            </div>
            <div className="ingresos__campos">
              <Selector etiqueta="Desde" valor={desde} opciones={opciones} cambiar={(m) => setPeriodo((p) => ({ ...p, desde: m }))} todos="Hace 12 meses" />
              <Selector etiqueta="Hasta" valor={hasta} opciones={opciones} cambiar={(m) => setPeriodo((p) => ({ ...p, hasta: m }))} todos="Último CAC" />
            </div>
          </section>

          <Titulares series={datos.series} desde={desde} hasta={hasta} />

          <section className="card grafico">
            <h2>¿Qué subió más?</h2>
            <p className="grafico__sub">
              De {nombreMes(desde).toLowerCase()} a {nombreMes(hasta).toLowerCase()}. Si una serie no llega al final del período, se aclara hasta qué mes.
            </p>
            <Ranking r={r} />
          </section>

          <Comparacion series={datos.series} desde={desde} hasta={hasta} visibles={visibles} setVisibles={setVisibles} />

          <Alarmas materiales={datos.materiales.filter((m) => m.id === "142001" || m.id === "4001")} />

          <Fuentes fuentes={datos.fuentes} />
        </>
      )}
    </div>
  );
}

function Titulares({ series, desde, hasta }: { series: SerieMensual[]; desde: string; hasta: string }) {
  const buscar = (id: string) => series.find((s) => s.id === id) ?? null;
  const tarjeta = (titulo: string, idA: string, idB: string, texto: (dif: number) => string) => {
    const a = buscar(idA);
    const b = buscar(idB);
    const c = a && b ? comparar(a, b, desde, hasta) : null;
    return (
      <div className="cifra panorama__titular">
        <span className="cifra__titulo">{titulo}</span>
        {c ? (
          <>
            <span className="cifra__valor">{pctSigno(real(c.a, c.b))}</span>
            <span className="cifra__nota">{texto(real(c.a, c.b))}</span>
            <span className="cifra__nota">
              {c.a.serie.nombre} {pctSigno(c.a.variacion)} · {c.b.serie.nombre} {pctSigno(c.b.variacion)}
            </span>
            {c.recortado && (
              <span className="cifra__nota panorama__recorte">
                <Icono nombre="alerta" size={12} /> Comparado hasta {nombreMes(c.hasta).toLowerCase()}, el último mes con las dos series.
              </span>
            )}
          </>
        ) : (
          <span className="cifra__nota">Falta alguna de las dos series en este período.</span>
        )}
      </div>
    );
  };
  return (
    <section aria-label="CAC contra la inflación y el dólar">
      <h2 className="cac__titulo-seccion">
        De {nombreMes(desde).toLowerCase()} a {nombreMes(hasta).toLowerCase()}
      </h2>
      <div className="ingresos__cifras">
        {tarjeta("CAC contra la inflación", "cac", "ipc", (d) => (d >= 0 ? `Construir se encareció ${pctSigno(d).slice(1)} más que la inflación.` : `Construir subió ${pctSigno(-d).slice(1)} menos que la inflación.`))}
        {tarjeta("CAC en dólares blue", "cac", "blue", (d) => (d >= 0 ? `En dólares, construir está ${pctSigno(d).slice(1)} más caro.` : `En dólares, construir está ${pctSigno(-d).slice(1)} más barato.`))}
        {tarjeta("Dólar blue contra la inflación", "blue", "ipc", (d) => (d >= 0 ? `El dólar le ganó a la inflación por ${pctSigno(d).slice(1)}.` : `El dólar quedó ${pctSigno(-d).slice(1)} atrás de la inflación (se abarató).`))}
      </div>
    </section>
  );
}

function Ranking({ r }: { r: Variacion[] }) {
  if (!r.length) return <p className="ficha__vacio">No hay series con datos en este período.</p>;
  const maximo = Math.max(...r.map((x) => Math.abs(x.variacion)), 0.0001);
  const hayNegativos = r.some((x) => x.variacion < 0);
  return (
    <ul className="rubros panorama__ranking">
      {r.map((x) => (
        <li key={x.serie.id} className="rubros__fila panorama__fila" title={`${x.serie.nombre}: ${pctSigno(x.variacion)} (de ${nombreMes(x.desde.mes)} a ${nombreMes(x.hasta.mes)})`}>
          <span className="rubros__nombre">
            <i className="leyenda__marca" style={{ background: COLOR_SERIE[x.serie.id] ?? "var(--serie-otros)" }} /> {x.serie.nombre}
            {x.incompleta && <span className="panorama__hasta"> hasta {nombreMes(x.hasta.mes, true)}</span>}
          </span>
          <span className={`rubros__pista${hayNegativos ? " panorama__pista--doble" : ""}`}>
            <span
              className="rubros__barra panorama__barra"
              style={{
                width: `${(Math.abs(x.variacion) / maximo) * (hayNegativos ? 50 : 100)}%`,
                marginLeft: hayNegativos ? (x.variacion < 0 ? `${50 - (Math.abs(x.variacion) / maximo) * 50}%` : "50%") : 0,
                background: COLOR_SERIE[x.serie.id] ?? "var(--serie-otros)",
              }}
            />
          </span>
          <span className="rubros__valor">{pctSigno(x.variacion)}</span>
        </li>
      ))}
    </ul>
  );
}

function Comparacion({
  series,
  desde,
  hasta,
  visibles,
  setVisibles,
}: {
  series: SerieMensual[];
  desde: string;
  hasta: string;
  visibles: string[];
  setVisibles: (f: (v: string[]) => string[]) => void;
}) {
  const elegidas = series.filter((s) => visibles.includes(s.id));
  const b = base100(elegidas, desde, hasta);
  return (
    <figure className="card grafico">
      <figcaption>
        <h2>Comparación (base 100 = {nombreMes(desde).toLowerCase()})</h2>
        <p className="grafico__sub">Todas las series arrancan en 100: la que termina más arriba es la que más subió. Tocá una serie para mostrarla u ocultarla.</p>
      </figcaption>
      <ul className="leyenda">
        {series.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className={`cac__serie${visibles.includes(s.id) ? "" : " cac__serie--oculta"}`}
              aria-pressed={visibles.includes(s.id)}
              onClick={() => setVisibles((v) => (v.includes(s.id) ? (v.length > 1 ? v.filter((x) => x !== s.id) : v) : [...v, s.id]))}
            >
              <span className="leyenda__marca" style={{ background: COLOR_SERIE[s.id] ?? "var(--serie-otros)" }} /> {s.nombre}
            </button>
          </li>
        ))}
      </ul>
      <GraficoLineas
        meses={b.meses}
        series={elegidas.map((s) => ({ id: s.id, nombre: s.nombre, color: COLOR_SERIE[s.id] ?? "#888", valores: b.valores[s.id] }))}
        formatoEje={(v) => v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
        formatoValor={(v) => `${v.toLocaleString("es-AR", { maximumFractionDigits: 1 })} (${pctSigno(v / 100 - 1)})`}
        descripcion="Comparación de índices en base 100."
        referencia={100}
      />
    </figure>
  );
}

function Alarmas({ materiales }: { materiales: AnalisisMaterial[] }) {
  return (
    <section className="card grafico">
      <div className="ingresos__titulo panorama__alarmas-titulo">
        <h2>¿Es momento de comprar?</h2>
        <Link href="/indicadores/materiales" className="btn btn--borde btn--chico">
          Ver los 50 materiales
          <Icono nombre="flecha" size={16} />
        </Link>
      </div>
      <div className="panorama__alarmas">
        {materiales.map((m) => (
          <TarjetaAlarma key={m.id} m={m} />
        ))}
      </div>
    </section>
  );
}

export function TarjetaAlarma({ m }: { m: AnalisisMaterial }) {
  return (
    <article className={`alarma ${m.resumen ? CLASE_SENAL[m.resumen] : ""}`}>
      <header>
        <strong>{m.descripcion}</strong>
        {m.resumen && (
          <span className="senal">
            <Icono nombre={m.resumen === "comprar" ? "check" : "alerta"} size={14} /> {TEXTO_SENAL[m.resumen]}
          </span>
        )}
      </header>
      <dl className="alarma__lecturas">
        <div>
          <dt>Con pesos ajustados por CAC</dt>
          <dd>
            {m.senalPesos ? TEXTO_CORTO[m.senalPesos] : "—"}
            {m.real && <span> ({pctSigno(m.real.vsMediana, 0)} vs. lo habitual)</span>}
          </dd>
        </div>
        <div>
          <dt>En dólares blue</dt>
          <dd>
            {m.senalDolares ? TEXTO_CORTO[m.senalDolares] : "—"}
            {m.usd && <span> ({pctSigno(m.usd.vsMediana, 0)} vs. lo habitual)</span>}
          </dd>
        </div>
      </dl>
      <p className="alarma__motivo">{m.motivo}</p>
      {m.atraso > 2 && (
        <p className="alarma__atraso">
          <Icono nombre="alerta" size={14} /> El último precio es de {nombreMes(m.ultimoMes).toLowerCase()} ({m.atraso} meses de atraso): actualizar &quot;Precios Medios&quot; en la planilla.
        </p>
      )}
    </article>
  );
}

function Fuentes({ fuentes }: { fuentes: { serie: string; fuente: string; ultimo: string | null; enLinea: boolean; error: string | null }[] }) {
  return (
    <details className="card egresos__internos">
      <summary>
        <strong>De dónde sale cada dato</strong>
        <span>El IPC y el dólar se traen solos de fuentes públicas; si no responden, se usa la planilla.</span>
      </summary>
      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              <th>Serie</th>
              <th>Fuente</th>
              <th>Último dato</th>
            </tr>
          </thead>
          <tbody>
            {fuentes.map((f) => (
              <tr key={f.serie}>
                <td data-etiqueta="Serie">{f.serie}</td>
                <td data-etiqueta="Fuente">
                  {f.fuente}
                  {f.enLinea && <span className="tabla__sub">En línea</span>}
                  {!f.enLinea && f.error && <span className="tabla__sub">No se pudo consultar en línea ({f.error})</span>}
                </td>
                <td data-etiqueta="Último dato">{f.ultimo ? nombreMes(f.ultimo) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
