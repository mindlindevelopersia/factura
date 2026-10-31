"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nombreMes, sumarMeses } from "@/lib/finanzas/ingresos";
import { actualizar, cacACsv, rango, SERIES, type MesCac, type Serie, type SerieCac } from "@/lib/indicadores/cac";
import { leerJson } from "../formato";
import { Icono } from "../Icono";
import { BarraLectura, descargar, Revisar } from "../finanzas/comun";

interface Respuesta {
  serie: SerieCac;
  leido: string;
}

const COLORES: Record<Serie, string> = { general: "var(--serie-cac-general)", materiales: "var(--serie-cac-materiales)", manoDeObra: "var(--serie-cac-mano)" };
const pct = (n: number | null, decimales = 1) => (n == null ? "—" : `${(n * 100).toLocaleString("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}%`);
const indice = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const mesCorto = (mes: string) => nombreMes(mes, true).replace(/^./, (c) => c.toUpperCase());

/** El tablero del índice CAC: último mes, gráfico, tabla como la publica la Cámara, calculadora y controles. */
export function IndiceCac() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async (fresco = false) => {
    setCargando(true);
    try {
      setDatos(await leerJson<Respuesta>(await fetch(`/api/indicadores/cac${fresco ? "?fresco=1" : ""}`)));
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

  const serie = datos?.serie;
  const ultimo = serie?.meses.at(-1);

  return (
    <div className="ingresos">
      <BarraLectura leido={datos?.leido ?? null} cargando={cargando} actualizar={() => cargar(true)} />
      {error && (
        <p role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" size={18} />
          <span>{error}</span>
        </p>
      )}
      {serie && ultimo && (
        <>
          <Revisar avisos={serie.avisos.map((a) => ({ ...a, donde: a.filas.length ? `Pestaña "Índice CAC" · filas ${a.filas.slice(0, 8).join(", ")}` : 'Pestaña "Índice CAC"', monto: null, moneda: null }))} />
          <section aria-label="Último mes publicado">
            <h2 className="cac__titulo-seccion">
              {nombreMes(ultimo.mes)} {ultimo.provisorio && <span className="cac__provisorio" title="Dato provisorio: la Cámara puede corregirlo">(*) provisorio</span>}
            </h2>
            <div className="ingresos__cifras">
              {SERIES.map((s) => (
                <div key={s.id} className={`cifra cac__tarjeta${s.id === "general" ? " cifra--destacada" : ""}`}>
                  <span className="cifra__titulo">
                    <i className="leyenda__marca" style={{ background: COLORES[s.id] }} /> {s.nombre}
                  </span>
                  <span className="cifra__valor">{indice(ultimo[s.id].indice)}</span>
                  <dl className="cac__variaciones">
                    <div>
                      <dt>Mes anterior</dt>
                      <dd>{pct(ultimo[s.id].mensual)}</dd>
                    </div>
                    <div>
                      <dt>Acumulado anual</dt>
                      <dd>{pct(ultimo[s.id].anual)}</dd>
                    </div>
                    <div>
                      <dt>Interanual</dt>
                      <dd>{pct(ultimo[s.id].interanual)}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </section>
          <Grafico serie={serie} />
          <Calculadora serie={serie} />
          <Tabla serie={serie} />
          <p className="cac__fuente">
            Fuente: Cámara Argentina de la Construcción. (*) Los últimos tres meses son provisorios y la Cámara puede corregirlos. Las variaciones se calculan de los índices de la
            planilla &quot;Indicadores - REAL ESTATE&quot;.
          </p>
        </>
      )}
    </div>
  );
}

type Medida = "mensual" | "interanual" | "indice";
const PERIODOS: { texto: string; meses: number | null }[] = [
  { texto: "12 meses", meses: 12 },
  { texto: "24 meses", meses: 24 },
  { texto: "5 años", meses: 60 },
  { texto: "Todo", meses: null },
];

/** Líneas por mes de las tres series, con cursor y tooltip. */
function Grafico({ serie }: { serie: SerieCac }) {
  const [medida, setMedida] = useState<Medida>("mensual");
  const [periodo, setPeriodo] = useState<number | null>(24);
  const [visibles, setVisibles] = useState<Serie[]>(["general", "materiales", "manoDeObra"]);
  const [activo, setActivo] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  // El gráfico se dibuja al ancho real, así el texto de los ejes no se agranda ni se achica.
  const [W, setW] = useState(800);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const meses = periodo ? serie.meses.slice(-periodo) : serie.meses;
  const valor = (m: MesCac, s: Serie) => (medida === "indice" ? m[s].indice : m[s][medida]);
  const valores = meses.flatMap((m) => visibles.map((s) => valor(m, s))).filter((v): v is number => v != null);
  const minimo = Math.min(0, ...valores);
  const maximo = Math.max(...valores, medida === "indice" ? 1 : 0.01);
  const paso = (() => {
    const bruto = (maximo - minimo) / 4;
    const p = 10 ** Math.floor(Math.log10(bruto));
    return [1, 2, 2.5, 5, 10].map((k) => k * p).find((k) => k >= bruto)!;
  })();
  const tope = Math.ceil(maximo / paso) * paso;
  const piso = Math.floor(minimo / paso) * paso;
  const marcas: number[] = [];
  for (let v = piso; v <= tope + paso / 2; v += paso) marcas.push(Number(v.toFixed(10)));

  const H = W < 500 ? 220 : 280;
  const izq = 52;
  const der = 12;
  const arriba = 12;
  const abajo = 28;
  const x = (i: number) => izq + (meses.length <= 1 ? 0 : (i / (meses.length - 1)) * (W - izq - der));
  const y = (v: number) => arriba + (1 - (v - piso) / (tope - piso || 1)) * (H - arriba - abajo);
  const formato = (v: number) => (medida === "indice" ? v.toLocaleString("es-AR", { maximumFractionDigits: 0 }) : pct(v, Math.abs(paso) < 0.01 ? 1 : 0));
  const cada = Math.ceil(meses.length / Math.max(3, Math.floor((W - izq) / 80)));

  const mover = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = svg.current?.getBoundingClientRect();
    if (!r || meses.length < 2) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - izq) / (W - izq - der)) * (meses.length - 1));
    setActivo(Math.max(0, Math.min(meses.length - 1, i)));
  };
  const alternar = (s: Serie) => setVisibles((v) => (v.includes(s) ? (v.length > 1 ? v.filter((x) => x !== s) : v) : SERIES.map((x) => x.id).filter((x) => x === s || v.includes(x))));
  const m = activo != null ? meses[activo] : null;

  return (
    <figure className="card grafico">
      <figcaption className="cac__cabecera">
        <div>
          <h2>Evolución</h2>
          <p className="grafico__sub">Pasá el mouse por el gráfico para ver cada mes. Tocá una serie para mostrarla u ocultarla.</p>
        </div>
        <div className="cac__opciones">
          <div className="ingresos__atajos" role="group" aria-label="Qué mostrar">
            {(
              [
                ["mensual", "Variación mensual"],
                ["interanual", "Interanual"],
                ["indice", "Índice"],
              ] as const
            ).map(([id, texto]) => (
              <button key={id} type="button" className={`btn btn--chico ${medida === id ? "btn--primario" : "btn--borde"}`} aria-pressed={medida === id} onClick={() => setMedida(id)}>
                {texto}
              </button>
            ))}
          </div>
          <div className="ingresos__atajos" role="group" aria-label="Período">
            {PERIODOS.map((p) => (
              <button key={p.texto} type="button" className={`btn btn--chico ${periodo === p.meses ? "btn--primario" : "btn--borde"}`} aria-pressed={periodo === p.meses} onClick={() => setPeriodo(p.meses)}>
                {p.texto}
              </button>
            ))}
          </div>
        </div>
      </figcaption>
      <ul className="leyenda">
        {SERIES.map((s) => (
          <li key={s.id}>
            <button type="button" className={`cac__serie${visibles.includes(s.id) ? "" : " cac__serie--oculta"}`} aria-pressed={visibles.includes(s.id)} onClick={() => alternar(s.id)}>
              <span className="leyenda__marca" style={{ background: COLORES[s.id] }} /> {s.nombre}
            </button>
          </li>
        ))}
      </ul>
      <div className="cac__grafico" ref={caja}>
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          aria-label="Evolución del índice CAC. El detalle está en la tabla de abajo."
          onPointerMove={mover}
          onPointerLeave={() => setActivo(null)}
        >
          {marcas.map((v) => (
            <g key={v}>
              <line x1={izq} x2={W - der} y1={y(v)} y2={y(v)} className={v === 0 ? "cac__cero" : "cac__grilla"} />
              <text x={izq - 8} y={y(v)} className="cac__eje" textAnchor="end" dominantBaseline="middle">
                {formato(v)}
              </text>
            </g>
          ))}
          {meses.map((mm, i) =>
            (i % cada === 0 && meses.length - 1 - i >= Math.max(1, cada * 0.7)) || i === meses.length - 1 ? (
              <text key={mm.mes} x={x(i)} y={H - 8} className="cac__eje" textAnchor={i === meses.length - 1 ? "end" : "middle"}>
                {mesCorto(mm.mes)}
              </text>
            ) : null,
          )}
          {visibles.map((s) => {
            const puntos = meses.map((mm, i) => [x(i), valor(mm, s)] as const).filter((p): p is readonly [number, number] => p[1] != null);
            return (
              <polyline
                key={s}
                points={puntos.map(([px, v]) => `${px},${y(v)}`).join(" ")}
                fill="none"
                stroke={COLORES[s]}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {activo != null && m && (
            <g>
              <line x1={x(activo)} x2={x(activo)} y1={arriba} y2={H - abajo} className="cac__cursor" />
              {visibles.map((s) => {
                const v = valor(m, s);
                return v == null ? null : <circle key={s} cx={x(activo)} cy={y(v)} r={4.5} fill={COLORES[s]} stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke" />;
              })}
            </g>
          )}
        </svg>
        {activo != null && m && (
          <div className="tooltip cac__tooltip" style={{ left: `${(x(activo) / W) * 100}%`, transform: activo > meses.length / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }} role="tooltip">
            <strong>
              {nombreMes(m.mes)}
              {m.provisorio ? " (*)" : ""}
            </strong>
            {visibles.map((s) => (
              <span key={s}>
                <i className="leyenda__marca" style={{ background: COLORES[s] }} /> {SERIES.find((x) => x.id === s)!.nombre}: {medida === "indice" ? indice(m[s].indice) : pct(m[s][medida])}
              </span>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

/** Actualizar un monto por CAC entre dos meses, con la cuenta a la vista. */
function Calculadora({ serie }: { serie: SerieCac }) {
  const ultimo = serie.ultimo!;
  const [monto, setMonto] = useState("1000000");
  const [desde, setDesde] = useState(sumarMeses(ultimo, -6));
  const [hasta, setHasta] = useState(ultimo);
  const [cual, setCual] = useState<Serie>("general");
  const opciones = useMemo(() => [...serie.meses].reverse().map((m) => m.mes), [serie]);
  const numero = Number(monto.replace(/\./g, "").replace(",", "."));
  const r = Number.isFinite(numero) && numero > 0 ? actualizar(serie, numero, desde, hasta, cual) : null;
  const pesos = (n: number) => `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <section className="card grafico cac__calculadora">
      <h2>Actualizar un monto por CAC</h2>
      <p className="grafico__sub">Monto × índice del mes final ÷ índice del mes inicial. Las cuotas del Flujo usan el índice del mes anterior al de la cuota.</p>
      <div className="ingresos__campos">
        <label className="campo campo--filtro">
          Monto en pesos
          <input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </label>
        <label className="campo campo--filtro">
          Desde (índice de)
          <select value={desde} onChange={(e) => setDesde(e.target.value)}>
            {opciones.map((m) => (
              <option key={m} value={m}>
                {nombreMes(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="campo campo--filtro">
          Hasta (índice de)
          <select value={hasta} onChange={(e) => setHasta(e.target.value)}>
            {opciones.map((m) => (
              <option key={m} value={m}>
                {nombreMes(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="campo campo--filtro">
          Serie
          <select value={cual} onChange={(e) => setCual(e.target.value as Serie)}>
            {SERIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      {r ? (
        <div className="cac__resultado">
          <span className="cac__monto">{pesos(r.monto)}</span>
          <span>
            {pesos(numero)} × {indice(r.indiceHasta)} ÷ {indice(r.indiceDesde)} = {pesos(numero)} × {r.factor.toLocaleString("es-AR", { maximumFractionDigits: 6 })} (
            {r.factor >= 1 ? "+" : ""}
            {pct(r.factor - 1, 2)})
          </span>
        </div>
      ) : (
        <p className="ficha__vacio">Poné un monto mayor a cero.</p>
      )}
    </section>
  );
}

/** La serie como la publica la Cámara: período, denominación, índice, variación mensual y acumulada (y la interanual). */
function Tabla({ serie }: { serie: SerieCac }) {
  const anios = useMemo(() => [...new Set(serie.meses.map((m) => m.mes.slice(0, 4)))].reverse(), [serie]);
  const [anio, setAnio] = useState(anios[0]);
  const meses = anio === "todo" ? serie.meses : rango(serie, `${anio}-01`, `${anio}-12`);

  return (
    <section className="card ingresos__seccion">
      <div className="ingresos__titulo cuentas__controles">
        <h2>Evolución mensual</h2>
        <label className="campo campo--filtro">
          <span className="sr-only">Año</span>
          <select value={anio} onChange={(e) => setAnio(e.target.value)}>
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            <option value="todo">Toda la serie (desde 2015)</option>
          </select>
        </label>
        <button type="button" className="btn btn--borde btn--chico" onClick={() => descargar(`indice-cac-${anio}.csv`, cacACsv(meses))}>
          <Icono nombre="archivo" size={16} />
          Descargar CSV
        </button>
      </div>
      <div className="tabla-contenedor">
        <table className="tabla cac__tabla">
          <thead>
            <tr>
              <th>Período</th>
              <th>Denominación</th>
              <th className="tabla__numero">Índice (base 100 dic. 14)</th>
              <th className="tabla__numero">Mes anterior</th>
              <th className="tabla__numero">Acumulado anual</th>
              <th className="tabla__numero">Interanual</th>
            </tr>
          </thead>
          {meses.map((m) => (
            <tbody key={m.mes} className="cac__grupo">
              {SERIES.map((s, i) => (
                <tr key={s.id}>
                  {i === 0 && (
                    <th rowSpan={3} scope="rowgroup" className="cac__periodo">
                      {mesCorto(m.mes).replace(/ (\d\d)$/, " 20$1")}
                      {m.provisorio && " (*)"}
                    </th>
                  )}
                  <td data-etiqueta="Denominación">{s.nombre}</td>
                  <td data-etiqueta="Índice" className="tabla__numero cac__indice">
                    {indice(m[s.id].indice)}
                  </td>
                  <td data-etiqueta="Mes anterior" className="tabla__numero">
                    {pct(m[s.id].mensual)}
                  </td>
                  <td data-etiqueta="Acumulado anual" className="tabla__numero">
                    {pct(m[s.id].anual)}
                  </td>
                  <td data-etiqueta="Interanual" className="tabla__numero">
                    {pct(m[s.id].interanual)}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}
