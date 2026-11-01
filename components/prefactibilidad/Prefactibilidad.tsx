"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PROYECTOS, proyecto as buscarProyecto, rutaProyecto } from "@/lib/modulos";
import {
  calcular,
  construiblePiso,
  cuentaPiso,
  cuentas,
  cuentaUnidad,
  vendibleTeorico,
  type DatosPrefactibilidad,
  type Descubierta,
  type Normativa,
  type Prefactibilidad,
  type Version,
} from "@/lib/prefactibilidad/modelo";
import { calcularPlusvalia, formatear, type DatosPlusvalia } from "@/lib/prefactibilidad/plusvalia";
import { BARRIOS_PRINCIPALES, MUNICIPIOS, OTROS_BARRIOS } from "@/lib/prefactibilidad/barrios";
import { useDolarHoy } from "../indicadores/Dolar";
import { leerJson } from "../formato";
import { Nota, NotasProvider } from "../Notas";
import { Icono } from "../Icono";

const m2 = (x: number | null | undefined) => (x == null ? "—" : `${x.toLocaleString("es-AR", { maximumFractionDigits: 2 })} m²`);
const fecha = (iso: string) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));
const json = (cuerpo: unknown, metodo = "POST") => ({ method: metodo, headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });

/** HQ · Prefactibilidad: la lista de lotes (en análisis, en proyectos, descartados) y la ficha de cada uno. */
export function Prefactibilidades() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => setId(new URLSearchParams(window.location.search).get("id")), []);
  const abrir = (x: string | null) => {
    setId(x);
    window.history.replaceState(null, "", x ? `?id=${x}` : window.location.pathname);
  };
  return id ? <Editor id={id} volver={() => abrir(null)} /> : <Lista abrir={abrir} />;
}

function Lista({ abrir }: { abrir: (id: string) => void }) {
  const [lista, setLista] = useState<Prefactibilidad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);
  useEffect(() => {
    void fetch("/api/prefactibilidad")
      .then((r) => leerJson<{ prefactibilidades: Prefactibilidad[] }>(r))
      .then((d) => setLista(d.prefactibilidades))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  if (error && !lista) return <p className="alerta alerta--error">{error}</p>;
  if (!lista) return <p className="ficha__nota">Cargando las prefactibilidades…</p>;
  const grupos: [string, Prefactibilidad[]][] = [
    ["En análisis", lista.filter((p) => p.estado === "En análisis")],
    ["En proyectos", lista.filter((p) => p.estado === "Asignada")],
    ["Descartadas", lista.filter((p) => p.estado === "Descartada")],
  ];
  return (
    <div className="pf">
      <form
        className="tareas__barra"
        onSubmit={async (e) => {
          e.preventDefault();
          setCreando(true);
          setError(null);
          try {
            const { prefactibilidad } = await leerJson<{ prefactibilidad: Prefactibilidad }>(await fetch("/api/prefactibilidad", json({ nombre })));
            abrir(prefactibilidad.id);
          } catch (x) {
            setError(x instanceof Error ? x.message : String(x));
          } finally {
            setCreando(false);
          }
        }}
      >
        <input className="pf__nuevo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Dirección o nombre del lote (ej.: Güemes 4676)" aria-label="Nombre de la prefactibilidad" />
        <button type="submit" className="btn btn--primario" disabled={creando || !nombre.trim()}>
          {creando ? "Creando…" : "+ Nueva prefactibilidad"}
        </button>
      </form>
      {error && <p className="alerta alerta--error">{error}</p>}
      {grupos.map(([titulo, l]) =>
        l.length ? (
          <section key={titulo} className="pf__grupo">
            <h2 className="cac__titulo-seccion">{titulo}</h2>
            <ul className="pf__lista">
              {l.map((p) => {
                const c = calcular(p.datos);
                return (
                  <li key={p.id}>
                    <button type="button" className="ideas__tarjeta" onClick={() => abrir(p.id)}>
                      <span className="ideas__arriba">
                        <strong>{p.nombre}</strong>
                        {p.proyecto && <span className="ideas__estado ideas__estado--features">{buscarProyecto(p.proyecto)?.nombre ?? p.proyecto}</span>}
                      </span>
                      <span className="pf__cifras">
                        <span>Terreno {m2(c.superficieTerreno)}</span>
                        <span>Construible GCBA {m2(c.construible.gcba)}</span>
                        <span>Vendible {m2(c.vendible.teorico)}</span>
                        {c.vendible.porcentaje != null && <span>{Math.round(c.vendible.porcentaje * 100)}% vendible</span>}
                      </span>
                      <span className="tarea__pie">
                        <span>
                          Cambió {p.edito || "—"} · {fecha(p.actualizada)}
                        </span>
                        {c.avisos.some((a) => a.nivel === "error") && <span className="crm-tarjeta__paso--vencido">Hay avisos</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null,
      )}
      {!lista.length && <p className="ficha__nota">Todavía no hay prefactibilidades. Creá la primera con el nombre del lote.</p>}
    </div>
  );
}

/** En el proyecto: su prefactibilidad (la misma de HQ), o para importar una o cargarla del Excel madre. */
export function PrefactibilidadDelProyecto({ proyecto }: { proyecto: string }) {
  const [lista, setLista] = useState<Prefactibilidad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elegida, setElegida] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const cargar = useCallback(async () => {
    try {
      setLista((await leerJson<{ prefactibilidades: Prefactibilidad[] }>(await fetch("/api/prefactibilidad"))).prefactibilidades);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  if (error && !lista) return <p className="alerta alerta--error">{error}</p>;
  if (!lista) return <p className="ficha__nota">Cargando…</p>;
  const asignada = lista.find((p) => p.proyecto === proyecto);
  if (asignada) return <Editor id={asignada.id} enProyecto={proyecto} />;
  const disponibles = lista.filter((p) => p.estado === "En análisis");
  const p = buscarProyecto(proyecto);
  const hacer = async (f: () => Promise<Response>) => {
    setOcupado(true);
    setError(null);
    try {
      await leerJson(await f());
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section className="card pf__vacia">
      <h2>Este proyecto todavía no tiene prefactibilidad</h2>
      <p>Importá la que armaron en HQ: queda asignada a {p?.nombre} y es la misma (se sigue editando desde acá o desde HQ, y se guarda una versión de cómo estaba).</p>
      <div className="tareas__barra">
        <select value={elegida} onChange={(e) => setElegida(e.target.value)} aria-label="Prefactibilidad para importar">
          <option value="">{disponibles.length ? "Elegí una prefactibilidad en análisis" : "No hay prefactibilidades en análisis"}</option>
          {disponibles.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nombre}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn--primario btn--chico" disabled={!elegida || ocupado} onClick={() => void hacer(() => fetch(`/api/prefactibilidad/${elegida}`, json({ proyecto }, "PUT")))}>
          Importar a {p?.nombre}
        </button>
      </div>
      {p?.planillaMadre && (
        <p>
          O cargala con lo que hoy está en el Excel madre (pestaña Superficies y la lista de precios):{" "}
          <button type="button" className="btn btn--borde btn--chico" disabled={ocupado} onClick={() => void hacer(() => fetch("/api/prefactibilidad/excel", json({ proyecto })))}>
            {ocupado ? "Cargando…" : "Cargar del Excel madre"}
          </button>
        </p>
      )}
      {error && <p className="alerta alerta--error">{error}</p>}
    </section>
  );
}

function Editor({ id, volver, enProyecto }: { id: string; volver?: () => void; enProyecto?: string }) {
  const [p, setP] = useState<Prefactibilidad | null>(null);
  const [d, setD] = useState<DatosPrefactibilidad | null>(null);
  const [versiones, setVersiones] = useState<Version[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [carpeta, setCarpeta] = useState<string | null>(null);
  const [nombreVersion, setNombreVersion] = useState("");
  const [viendo, setViendo] = useState<Version | null>(null);
  const [pestania, setPestania] = useState<"superficies" | "plusvalia" | "resultados">("superficies");
  const [uvas, setUvas] = useState<{ hoy: { valor: number; fecha: string; fuente: string } | null; fechas: Record<string, { valor: number; fecha: string; fuente: string } | null> } | null>(null);
  const [errorUva, setErrorUva] = useState<string | null>(null);
  const dolar = useDolarHoy();
  const mep = dolar.de("mep")?.venta ?? null;
  const fechaPago = d?.plusvalia?.pago?.fecha ?? "";
  useEffect(() => {
    void fetch(`/api/indicadores/uva${fechaPago ? `?fechas=${fechaPago}` : ""}`)
      .then((r) => leerJson<NonNullable<typeof uvas>>(r))
      .then((x) => (setUvas(x), setErrorUva(null)))
      .catch((e) => setErrorUva(e instanceof Error ? e.message : String(e)));
  }, [fechaPago]);

  const cargar = useCallback(async () => {
    try {
      const r = await leerJson<{ prefactibilidad: Prefactibilidad; versiones: Version[] }>(await fetch(`/api/prefactibilidad/${id}`, { cache: "no-store" }));
      setP(r.prefactibilidad);
      setD(r.prefactibilidad.datos);
      setVersiones(r.versiones);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const c = useMemo(() => (d ? calcular(d) : null), [d]);
  const cu = useMemo(() => (d && c ? cuentas(d, c) : null), [d, c]);
  const sinGuardar = !!p && !!d && JSON.stringify(p.datos) !== JSON.stringify(d);

  // Avisar si se va con cambios sin guardar.
  useEffect(() => {
    if (!sinGuardar) return;
    const f = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [sinGuardar]);

  if (error && !p) return <p className="alerta alerta--error">{error}</p>;
  if (!p || !d || !c || !cu) return <p className="ficha__nota">Cargando la prefactibilidad…</p>;

  const put = async (cuerpo: Record<string, unknown>, ok?: string) => {
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const r = await leerJson<{ prefactibilidad: Prefactibilidad }>(await fetch(`/api/prefactibilidad/${id}`, json(cuerpo, "PUT")));
      setP(r.prefactibilidad);
      if (cuerpo.datos === undefined) setD((x) => x ?? r.prefactibilidad.datos);
      if (ok) setAviso(ok);
      if (cuerpo.proyecto !== undefined) await cargar();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setGuardando(false);
    }
  };
  const poner = (cambio: Partial<DatosPrefactibilidad>) => setD((x) => (x ? { ...x, ...cambio } : x));
  const ponerNormativa = <K extends keyof Normativa>(k: K, v: Normativa[K]) => setD((x) => (x ? { ...x, normativa: { ...x.normativa, [k]: v } } : x));
  const proyecto = p.proyecto ? buscarProyecto(p.proyecto) : null;

  return (
    <NotasProvider ruta={`/prefactibilidad?id=${id}`} prefijo={`pf:${id}:`}>
    <div className="pf">
      {volver && (
        <button type="button" className="btn btn--texto btn--chico propuesta__volver" onClick={volver}>
          ← Todas las prefactibilidades
        </button>
      )}
      <section className="card pf__cabeza">
        <div className="pf__titulo">
          <input className="pf__nombre" value={p.nombre} onChange={(e) => setP({ ...p, nombre: e.target.value })} onBlur={() => void put({ nombre: p.nombre })} aria-label="Nombre" />
          <span className={`ideas__estado ${p.estado === "Asignada" ? "ideas__estado--features" : "ideas__estado--descartada"}`}>{p.estado === "Asignada" && proyecto ? `Asignada a ${proyecto.nombre}` : p.estado}</span>
        </div>
        <p className="crm-ficha__sub">
          Cambió {p.edito || "—"} el {fecha(p.actualizada)}.
          {p.proyecto && !enProyecto && proyecto && (
            <>
              {" "}
              Es la misma que la de <Link href={rutaProyecto(p.proyecto, "prefactibilidad")}>{proyecto.nombre}</Link>.
            </>
          )}
          {enProyecto && " Es la misma que en HQ → Prefactibilidad."}
        </p>
        <div className="pf__acciones">
          {p.carpeta ? (
            <a className="btn btn--borde btn--chico" href={p.carpeta} target="_blank" rel="noreferrer">
              <Icono nombre="externo" size={14} /> Abrir carpeta (planos, PDF, CAD)
            </a>
          ) : (
            <span className="crm-ficha__sub">Sin carpeta de Drive.</span>
          )}
          <button
            type="button"
            className="btn btn--borde btn--chico"
            onClick={async () => {
              const { exportarPrefactibilidad } = await import("@/lib/prefactibilidad/excel");
              const blob = await exportarPrefactibilidad({ ...p, datos: d }, { uva: uvas?.hoy ?? null, mep });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `Prefactibilidad ${p.nombre}.xlsx`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            <Icono nombre="archivo" size={14} /> Exportar a Excel
          </button>
          {carpeta === null ? (
            <button type="button" className="btn btn--texto btn--chico" onClick={() => setCarpeta(p.carpeta)}>
              {p.carpeta ? "Cambiar el link" : "Poner el link de la carpeta"}
            </button>
          ) : (
            <form
              className="pf__carpeta"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await put({ carpeta }, "Listo, guardé el link de la carpeta.")) setCarpeta(null);
              }}
            >
              <input value={carpeta} onChange={(e) => setCarpeta(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" aria-label="Link de la carpeta de Drive" autoFocus />
              <button type="submit" className="btn btn--primario btn--chico" disabled={guardando}>
                Guardar
              </button>
              <button type="button" className="btn btn--texto btn--chico" onClick={() => setCarpeta(null)}>
                Cancelar
              </button>
            </form>
          )}
          {!enProyecto &&
            (p.proyecto ? (
              <button type="button" className="btn btn--texto btn--chico" disabled={guardando} onClick={() => window.confirm(`¿Sacarla de ${proyecto?.nombre}? Vuelve a "En análisis".`) && void put({ proyecto: "" }, "Volvió a En análisis.")}>
                Sacar del proyecto
              </button>
            ) : (
              <select value="" onChange={(e) => e.target.value && void put({ proyecto: e.target.value }, "Asignada: ahora es la prefactibilidad de ese proyecto.")} aria-label="Asignar a un proyecto" disabled={guardando}>
                <option value="">Asignar a un proyecto…</option>
                {PROYECTOS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </select>
            ))}
          {!p.proyecto && (
            <button type="button" className="btn btn--texto btn--chico" disabled={guardando} onClick={() => void put({ estado: p.estado === "Descartada" ? "En análisis" : "Descartada" })}>
              {p.estado === "Descartada" ? "Reabrir" : "Descartar"}
            </button>
          )}
        </div>
        <p className="crm-ficha__sub">Para subir la volumetría, el anteproyecto, el PDF o el CAD: abrí la carpeta y arrastralos ahí (Drive no tiene límite de tamaño).</p>
      </section>

      <div className={`pf__guardar${sinGuardar ? " pf__guardar--pendiente" : ""}`}>
        <span>{sinGuardar ? "Hay cambios sin guardar." : "Todo guardado."}</span>
        {aviso && <span className="crm-ficha__aviso">{aviso}</span>}
        {error && <span className="oliver__error">{error}</span>}
        <button type="button" className="btn btn--texto btn--chico" disabled={!sinGuardar || guardando} onClick={() => setD(p.datos)}>
          Deshacer
        </button>
        <button type="button" className="btn btn--primario btn--chico" disabled={!sinGuardar || guardando} onClick={() => void put({ datos: d }, "Guardado.")}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      <nav className="crm__pestanias" aria-label="Partes de la prefactibilidad">
        {(
          [
            ["superficies", "Superficies"],
            ["plusvalia", "Plusvalía"],
            ["resultados", "Estado de resultados"],
          ] as const
        ).map(([k, n]) => (
          <button key={k} type="button" className={`crm__pestania cf__pestania${pestania === k ? " crm__pestania--activa" : ""}`} onClick={() => setPestania(k)}>
            {n}
          </button>
        ))}
      </nav>

      {pestania === "plusvalia" && d.ciudad !== "CABA" && (
        <section className="card pf__vacia">
          <h2>Plusvalía en {d.ciudad}</h2>
          <p>La cuenta de abajo es la de CABA (volumétrica, Ley 6062). En {d.ciudad} la lógica es otra (por FOS y densidad): se arma cuando pases el Excel de {d.ciudad}.</p>
        </section>
      )}
      {pestania === "plusvalia" && (
        <Plusvalia
          d={d}
          c={c}
          uva={uvas?.hoy ?? null}
          uvaDelPago={fechaPago ? (uvas?.fechas[fechaPago] ?? null) : null}
          errorUva={errorUva}
          mep={mep}
          poner={(pv) => poner({ plusvalia: pv })}
          conExcel={!!p.proyecto && !!buscarProyecto(p.proyecto)?.planillaMadre}
          id={id}
          nombre={p.nombre}
        />
      )}
      {pestania === "resultados" && (
        <section className="card pf__vacia">
          <h2>Estado de resultados</h2>
          <p>Lo armamos más adelante: ingresos por ventas (con la lista de precios y lo vendible), costos (terreno, obra, plusvalía, honorarios) y el margen. La plusvalía ya sale de la pestaña Plusvalía.</p>
        </section>
      )}
      {pestania === "superficies" && (
      <>
      <div className="cf__resumen">
        <div>
          <span>Terreno</span>
          <strong>
            {m2(c.superficieTerreno)} <Cuenta texto={cu.terreno} /> <Nota clave={`pf:${id}:terreno`} etiqueta={`${p.nombre} · Terreno`} />
          </strong>
          {c.fosPermitido != null && (
            <small className="pf__sub">
              FOS permitido {m2(c.fosPermitido)} <Cuenta texto={cu.fosPermitido} /> <Nota clave={`pf:${id}:fosPermitido`} etiqueta={`${p.nombre} · FOS permitido`} />
            </small>
          )}
        </div>
        <div>
          <span>Construible según GCBA</span>
          <strong>
            {m2(c.construible.gcba)} <Cuenta texto={cu.gcba} /> <Nota clave={`pf:${id}:gcba`} etiqueta={`${p.nombre} · Construible según GCBA`} />
          </strong>
          <small className="pf__sub">
            Con descubiertas a su %: {m2(c.construible.conDescubiertas)} <Cuenta texto={cu.conDescubiertas} /> <Nota clave={`pf:${id}:conDescubiertas`} etiqueta={`${p.nombre} · Construible con descubiertas a su %`} /> · Total: {m2(c.construible.total)} <Cuenta texto={cu.total} /> <Nota clave={`pf:${id}:total`} etiqueta={`${p.nombre} · Construible total`} />
          </small>
        </div>
        <div>
          <span>Vendible</span>
          <strong>
            {m2(c.vendible.teorico)} <Cuenta texto={cu.vendibleTeorico} /> <Nota clave={`pf:${id}:vendibleTeorico`} etiqueta={`${p.nombre} · Vendible teórico`} />
          </strong>
          <small className="pf__sub">
            Real: {m2(c.vendible.real)} <Cuenta texto={cu.vendibleReal} /> <Nota clave={`pf:${id}:vendibleReal`} etiqueta={`${p.nombre} · Vendible real`} />
          </small>
        </div>
        <div>
          <span>Comunes</span>
          <strong>
            {m2(c.vendible.comunes)} <Cuenta texto={cu.comunes} /> <Nota clave={`pf:${id}:comunes`} etiqueta={`${p.nombre} · Comunes`} />
          </strong>
          {c.vendible.porcentaje != null && (
            <small className="pf__sub">
              {(c.vendible.porcentaje * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}% vendible <Cuenta texto={cu.porcentaje} /> <Nota clave={`pf:${id}:porcentaje`} etiqueta={`${p.nombre} · % vendible`} />
            </small>
          )}
        </div>
      </div>
      {c.avisos.map((a) => (
        <p key={a.texto} className={`alerta ${a.nivel === "error" ? "alerta--error" : "alerta--aviso"}`}>
          {a.texto}
        </p>
      ))}

      <section className="card pf__seccion">
        <h2>Lote y normativa</h2>
        <div className="pf__campos">
          <Texto etiqueta="Dirección" valor={d.direccion} poner={(v) => poner({ direccion: v })} />
          <label className="campo">
            Municipio
            <select value={d.ciudad} onChange={(e) => poner({ ciudad: e.target.value })}>
              {[...new Set([...MUNICIPIOS, d.ciudad].filter(Boolean))].map((m) => (
                <option key={m} value={m}>
                  {m === "CABA" ? "CABA (Ciudad de Buenos Aires)" : m}
                </option>
              ))}
            </select>
          </label>
          {d.ciudad === "CABA" && <Barrio valor={d.barrio} poner={(v) => poner({ barrio: v })} />}
          <label className="campo">
            Fecha
            <input type="date" value={d.fecha} onChange={(e) => poner({ fecha: e.target.value })} />
          </label>
          <Texto etiqueta="Distrito" valor={d.normativa.distrito} poner={(v) => ponerNormativa("distrito", v)} />
          <Texto etiqueta="Tipología edilicia" valor={d.normativa.tipologia} poner={(v) => ponerNormativa("tipologia", v)} />
          <Texto etiqueta="Zonificación" valor={d.normativa.zonificacion} poner={(v) => ponerNormativa("zonificacion", v)} />
          <Texto etiqueta="Basamento" valor={d.normativa.basamento} poner={(v) => ponerNormativa("basamento", v)} />
          <Numero etiqueta="FOT" valor={d.normativa.fot} poner={(v) => ponerNormativa("fot", v)} vacio />
          <Numero etiqueta="FOS" valor={d.normativa.fos} poner={(v) => ponerNormativa("fos", v)} vacio />
          <Texto etiqueta="Densidad" valor={d.normativa.densidad} poner={(v) => ponerNormativa("densidad", v)} />
          <Texto etiqueta="Cochera obligatoria" valor={d.normativa.cocheraObligatoria} poner={(v) => ponerNormativa("cocheraObligatoria", v)} />
          <Texto etiqueta="Premio" valor={d.normativa.premio} poner={(v) => ponerNormativa("premio", v)} />
          <Numero etiqueta="Altura máxima (m)" valor={d.normativa.alturaMaxima} poner={(v) => ponerNormativa("alturaMaxima", v)} vacio />
          <Numero etiqueta="Pisos máximos" valor={d.normativa.pisosMaximos} poner={(v) => ponerNormativa("pisosMaximos", v)} vacio />
          <Texto etiqueta="Retiros" valor={d.normativa.retiros} poner={(v) => ponerNormativa("retiros", v)} />
          <Texto etiqueta="LFI" valor={d.normativa.lfi} poner={(v) => ponerNormativa("lfi", v)} />
          <Texto etiqueta="Protección histórica" valor={d.normativa.proteccionHistorica} poner={(v) => ponerNormativa("proteccionHistorica", v)} />
          <Numero etiqueta="FOS del proyecto (m² en planta)" valor={d.fosProyecto} poner={(v) => poner({ fosProyecto: v })} vacio />
          <Texto etiqueta="Link al código" valor={d.normativa.linkCodigo} poner={(v) => ponerNormativa("linkCodigo", v)} />
        </div>
        <h3>Terrenos</h3>
        <table className="tabla pf__tabla">
          <thead>
            <tr>
              <th>Terreno</th>
              <th className="tabla__numero">Frente (m)</th>
              <th className="tabla__numero">Fondo (m)</th>
              <th className="tabla__numero">Superficie</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {d.terrenos.map((t, i) => (
              <tr key={i}>
                <td>
                  <input value={t.nombre} onChange={(e) => poner({ terrenos: d.terrenos.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)) })} aria-label="Nombre del terreno" />
                </td>
                <td>
                  <CeldaNumero valor={t.frente} poner={(v) => poner({ terrenos: d.terrenos.map((x, j) => (j === i ? { ...x, frente: v } : x)) })} />
                </td>
                <td>
                  <CeldaNumero valor={t.fondo} poner={(v) => poner({ terrenos: d.terrenos.map((x, j) => (j === i ? { ...x, fondo: v } : x)) })} />
                </td>
                <td className="tabla__numero">{m2(Math.round(t.frente * t.fondo * 100) / 100)}</td>
                <td>
                  {d.terrenos.length > 1 && (
                    <button type="button" className="btn btn--texto btn--chico" onClick={() => poner({ terrenos: d.terrenos.filter((_, j) => j !== i) })}>
                      Quitar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="btn btn--texto btn--chico" onClick={() => poner({ terrenos: [...d.terrenos, { nombre: `Terreno ${d.terrenos.length + 1}`, frente: 0, fondo: 0 }] })}>
          + Terreno
        </button>
      </section>

      <section className="card pf__seccion">
        <h2>Superficies construibles</h2>
        <p className="crm-ficha__sub">Por piso. Cada descubierta con su % (lo que computa): una terraza grande al 50%, un patio al 30%… “GCBA” marca los pisos que entran en lo construible según GCBA (cubierta + semicubierta).</p>
        <div className="tabla-contenedor">
          <table className="tabla pf__tabla">
            <thead>
              <tr>
                <th>Piso</th>
                <th className="tabla__numero">Cubierta</th>
                <th className="tabla__numero">Semicubierta</th>
                <th>Descubiertas (m² y % que computa)</th>
                <th>GCBA</th>
                <th className="tabla__numero">Total del piso</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.pisos.map((pi, i) => {
                const cambiar = (c2: Partial<typeof pi>) => poner({ pisos: d.pisos.map((x, j) => (j === i ? { ...x, ...c2 } : x)) });
                return (
                  <tr key={i}>
                    <td>
                      <input value={pi.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} aria-label="Piso" />
                    </td>
                    <td>
                      <CeldaNumero valor={pi.cubierta} poner={(v) => cambiar({ cubierta: v })} />
                    </td>
                    <td>
                      <CeldaNumero valor={pi.semicubierta} poner={(v) => cambiar({ semicubierta: v })} />
                    </td>
                    <td>
                      <Descubiertas lista={pi.descubiertas} poner={(l) => cambiar({ descubiertas: l })} porDefecto={0.5} />
                    </td>
                    <td>
                      <input type="checkbox" checked={pi.computaGcba} onChange={(e) => cambiar({ computaGcba: e.target.checked })} aria-label="Computa según GCBA" />
                    </td>
                    <td className="tabla__numero" title={cuentaPiso(pi)}>
                      {m2(construiblePiso(pi))} <Cuenta texto={cuentaPiso(pi)} />
                    </td>
                    <td>
                      <button type="button" className="btn btn--texto btn--chico" onClick={() => poner({ pisos: d.pisos.filter((_, j) => j !== i) })}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th>Totales</th>
                <th className="tabla__numero">{m2(c.construible.cubierta)}</th>
                <th className="tabla__numero">{m2(c.construible.semicubierta)}</th>
                <th>{m2(c.construible.descubierta)} al 100%</th>
                <th />
                <th className="tabla__numero">{m2(c.construible.conDescubiertas)}</th>
                <th />
              </tr>
            </tfoot>
          </table>
        </div>
        <button type="button" className="btn btn--texto btn--chico" onClick={() => poner({ pisos: [...d.pisos, { nombre: `Piso ${d.pisos.length}`, cubierta: 0, semicubierta: 0, descubiertas: [], computaGcba: true }] })}>
          + Piso
        </button>
        <dl className="pf__totales">
          <div>
            <dt>Según GCBA (cubierta + semicubierta)</dt>
            <dd>
              {m2(c.construible.gcba)} <Cuenta texto={cu.gcba} /> <Nota clave={`pf:${id}:gcba`} etiqueta={`${p.nombre} · Construible según GCBA`} />
            </dd>
          </div>
          <div>
            <dt>Con las descubiertas a su %</dt>
            <dd>
              {m2(c.construible.conDescubiertas)} <Cuenta texto={cu.conDescubiertas} /> <Nota clave={`pf:${id}:conDescubiertas`} etiqueta={`${p.nombre} · Construible con descubiertas a su %`} />
            </dd>
          </div>
          <div>
            <dt>Totales (todo al 100%)</dt>
            <dd>
              {m2(c.construible.total)} <Cuenta texto={cu.total} /> <Nota clave={`pf:${id}:total`} etiqueta={`${p.nombre} · Construible total`} />
            </dd>
          </div>
          {c.capacidadFot != null && (
            <div>
              <dt>Lo que permite el FOT (terreno × FOT)</dt>
              <dd>
                {m2(c.capacidadFot)} <Cuenta texto={cu.capacidadFot} /> <Nota clave={`pf:${id}:capacidadFot`} etiqueta={`${p.nombre} · Lo que permite el FOT`} />
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="card pf__seccion">
        <h2>Superficies vendibles</h2>
        <p className="crm-ficha__sub">Por unidad. Lo teórico suma cubierta, semicubierta y cada descubierta a su %. “Real” es lo que de verdad se vende, si es menos (un balcón gigante que no se cobra entero): vacío, es igual a lo teórico.</p>
        <div className="tabla-contenedor">
          <table className="tabla pf__tabla">
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Piso</th>
                <th>Tipología</th>
                <th className="tabla__numero">Cubierta</th>
                <th className="tabla__numero">Semicubierta</th>
                <th>Descubiertas</th>
                <th className="tabla__numero">Teórico</th>
                <th className="tabla__numero">Real</th>
                <th>Nota</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.unidades.map((u, i) => {
                const cambiar = (c2: Partial<typeof u>) => poner({ unidades: d.unidades.map((x, j) => (j === i ? { ...x, ...c2 } : x)) });
                return (
                  <tr key={i}>
                    <td>
                      <input className="pf__corto" value={u.codigo} onChange={(e) => cambiar({ codigo: e.target.value })} aria-label="Unidad" />
                    </td>
                    <td>
                      <input className="pf__corto" value={u.piso} onChange={(e) => cambiar({ piso: e.target.value })} aria-label="Piso" />
                    </td>
                    <td>
                      <input value={u.tipologia} onChange={(e) => cambiar({ tipologia: e.target.value })} aria-label="Tipología" />
                    </td>
                    <td>
                      <CeldaNumero valor={u.cubierta} poner={(v) => cambiar({ cubierta: v })} />
                    </td>
                    <td>
                      <CeldaNumero valor={u.semicubierta} poner={(v) => cambiar({ semicubierta: v })} />
                    </td>
                    <td>
                      <Descubiertas lista={u.descubiertas} poner={(l) => cambiar({ descubiertas: l })} porDefecto={0.33} />
                    </td>
                    <td className="tabla__numero" title={cuentaUnidad(u)}>
                      {m2(vendibleTeorico(u))} <Cuenta texto={cuentaUnidad(u)} />
                    </td>
                    <td>
                      <CeldaNumero valor={u.real} poner={(v) => cambiar({ real: v })} vacio placeholder={String(vendibleTeorico(u))} />
                    </td>
                    <td>
                      <input value={u.nota} onChange={(e) => cambiar({ nota: e.target.value })} aria-label="Nota" placeholder="Por qué" />
                    </td>
                    <td>
                      <button type="button" className="btn btn--texto btn--chico" onClick={() => poner({ unidades: d.unidades.filter((_, j) => j !== i) })}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={6}>Totales ({d.unidades.length} unidades)</th>
                <th className="tabla__numero">{m2(c.vendible.teorico)}</th>
                <th className="tabla__numero">{m2(c.vendible.real)}</th>
                <th colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        <button
          type="button"
          className="btn btn--texto btn--chico"
          onClick={() => poner({ unidades: [...d.unidades, { codigo: "", piso: d.unidades.at(-1)?.piso ?? "", tipologia: "", cubierta: 0, semicubierta: 0, descubiertas: [], real: null, nota: "" }] })}
        >
          + Unidad
        </button>
      </section>

      <section className="card pf__seccion">
        <h2>Notas</h2>
        <textarea rows={4} value={d.notas} onChange={(e) => poner({ notas: e.target.value })} placeholder="Definiciones pendientes, supuestos (¿qué hacemos en PB?, ¿a cuánto tomamos las terrazas?)…" />
      </section>

      </>
      )}

      <section className="card pf__seccion">
        <h2>Versiones</h2>
        <p className="crm-ficha__sub">Una foto de cómo estaba en cada momento. Al asignarla a un proyecto se guarda una sola. Volver a una guarda antes cómo está ahora.</p>
        <form
          className="tarea-ficha__agregar"
          onSubmit={async (e) => {
            e.preventDefault();
            if (sinGuardar && !window.confirm("Hay cambios sin guardar: la versión guarda lo último guardado. ¿Seguir?")) return;
            try {
              const r = await leerJson<{ versiones: Version[] }>(await fetch(`/api/prefactibilidad/${id}/versiones`, json({ nombre: nombreVersion })));
              setVersiones(r.versiones);
              setNombreVersion("");
            } catch (x) {
              setError(x instanceof Error ? x.message : String(x));
            }
          }}
        >
          <input value={nombreVersion} onChange={(e) => setNombreVersion(e.target.value)} placeholder="Nombre de la versión (ej.: Con PB de cocheras)" aria-label="Nombre de la versión" />
          <button type="submit" className="btn btn--borde btn--chico" disabled={!nombreVersion.trim()}>
            Guardar versión
          </button>
        </form>
        {!versiones.length && <p className="crm-ficha__sub">Todavía no hay versiones.</p>}
        <ul className="pf__versiones">
          {versiones.map((v) => {
            const cv = calcular(v.datos);
            return (
              <li key={v.id}>
                <span>
                  <strong>{v.nombre}</strong>
                  <small className="crm-ficha__sub">
                    {v.autor || "—"} · {fecha(v.fecha)} · GCBA {m2(cv.construible.gcba)} · vendible {m2(cv.vendible.teorico)}
                  </small>
                </span>
                <span className="pf__acciones">
                  <button type="button" className="btn btn--texto btn--chico" onClick={() => setViendo(viendo?.id === v.id ? null : v)}>
                    {viendo?.id === v.id ? "Ocultar" : "Comparar"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--texto btn--chico"
                    onClick={async () => {
                      if (!window.confirm(`¿Volver a "${v.nombre}"? Antes se guarda una versión con cómo está ahora.`)) return;
                      try {
                        const r = await leerJson<{ prefactibilidad: Prefactibilidad; versiones: Version[] }>(await fetch(`/api/prefactibilidad/${id}/versiones`, json({ restaurar: v.id })));
                        setP(r.prefactibilidad);
                        setD(r.prefactibilidad.datos);
                        setVersiones(r.versiones);
                        setAviso(`Volvió a "${v.nombre}".`);
                      } catch (x) {
                        setError(x instanceof Error ? x.message : String(x));
                      }
                    }}
                  >
                    Volver a esta
                  </button>
                </span>
                {viendo?.id === v.id && <Comparacion antes={v.datos} ahora={d} />}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
    </NotasProvider>
  );
}

function Comparacion({ antes, ahora }: { antes: DatosPrefactibilidad; ahora: DatosPrefactibilidad }) {
  const a = calcular(antes);
  const b = calcular(ahora);
  const filas: [string, number, number][] = [
    ["Terreno", a.superficieTerreno, b.superficieTerreno],
    ["Construible según GCBA", a.construible.gcba, b.construible.gcba],
    ["Construible con descubiertas a su %", a.construible.conDescubiertas, b.construible.conDescubiertas],
    ["Construible total", a.construible.total, b.construible.total],
    ["Vendible teórico", a.vendible.teorico, b.vendible.teorico],
    ["Vendible real", a.vendible.real, b.vendible.real],
    ["Comunes", a.vendible.comunes, b.vendible.comunes],
  ];
  return (
    <table className="tabla pf__comparacion">
      <thead>
        <tr>
          <th />
          <th className="tabla__numero">Esa versión</th>
          <th className="tabla__numero">Ahora</th>
          <th className="tabla__numero">Diferencia</th>
        </tr>
      </thead>
      <tbody>
        {filas.map(([n, x, y]) => (
          <tr key={n}>
            <td>{n}</td>
            <td className="tabla__numero">{m2(x)}</td>
            <td className="tabla__numero">{m2(y)}</td>
            <td className="tabla__numero">{Math.abs(y - x) < 0.01 ? "—" : `${y > x ? "+" : ""}${m2(Math.round((y - x) * 100) / 100)}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Descubiertas({ lista, poner, porDefecto }: { lista: Descubierta[]; poner: (l: Descubierta[]) => void; porDefecto: number }) {
  return (
    <div className="pf__descubiertas">
      {lista.map((x, i) => (
        <span key={i} className="pf__descubierta">
          <input className="pf__corto" value={x.nombre} onChange={(e) => poner(lista.map((y, j) => (j === i ? { ...y, nombre: e.target.value } : y)))} aria-label="Nombre de la descubierta" />
          <CeldaNumero valor={x.m2} poner={(v) => poner(lista.map((y, j) => (j === i ? { ...y, m2: v } : y)))} />
          <span className="pf__pct">
            <CeldaNumero valor={Math.round(x.computa * 1000) / 10} poner={(v) => poner(lista.map((y, j) => (j === i ? { ...y, computa: Math.min(100, v) / 100 } : y)))} />%
          </span>
          <button type="button" className="btn btn--texto btn--chico" onClick={() => poner(lista.filter((_, j) => j !== i))} aria-label="Quitar descubierta">
            ×
          </button>
        </span>
      ))}
      <button type="button" className="btn btn--texto btn--chico" onClick={() => poner([...lista, { nombre: "Terraza", m2: 0, computa: porDefecto }])}>
        + descubierta
      </button>
    </div>
  );
}

/** Un número que se puede escribir con coma; vacio: se puede dejar en blanco (null). */
function CeldaNumero<V extends number | null = number>({ valor, poner, vacio, placeholder }: { valor: number | null; poner: (v: V) => void; vacio?: boolean; placeholder?: string }) {
  const [texto, setTexto] = useState(valor == null ? "" : String(valor).replace(".", ","));
  useEffect(() => {
    setTexto((t) => {
      const actual = t.trim() === "" ? null : Number(t.replace(",", "."));
      return actual === valor ? t : valor == null ? "" : String(valor).replace(".", ",");
    });
  }, [valor]);
  return (
    <input
      className="pf__numero"
      inputMode="decimal"
      value={texto}
      placeholder={placeholder}
      onChange={(e) => {
        const t = e.target.value;
        setTexto(t);
        if (t.trim() === "") return poner((vacio ? null : 0) as V);
        // "1.234,5" o "1234,5" o "8.65": con coma, los puntos son de miles; sin coma, el punto es decimal.
        const x = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
        if (Number.isFinite(x) && x >= 0) poner(x as V);
      }}
    />
  );
}

function Numero({ etiqueta, valor, poner, vacio }: { etiqueta: string; valor: number | null; poner: (v: number | null) => void; vacio?: boolean }) {
  return (
    <label className="campo">
      {etiqueta}
      <CeldaNumero valor={valor} poner={poner} vacio={vacio} />
    </label>
  );
}

function Texto({ etiqueta, valor, poner }: { etiqueta: string; valor: string; poner: (v: string) => void }) {
  return (
    <label className="campo">
      {etiqueta}
      <input value={valor} onChange={(e) => poner(e.target.value)} />
    </label>
  );
}

/** "fx": muestra la cuenta de un número (de dónde sale, con los valores). */
function Cuenta({ texto }: { texto: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <span className="cuenta">
      <button type="button" className={`cuenta__boton${abierta ? " cuenta__boton--abierta" : ""}`} onClick={() => setAbierta((x) => !x)} aria-label="Ver la cuenta" title="Ver la cuenta">
        fx
      </button>
      {abierta && (
        <span className="cuenta__texto" role="note">
          {texto}
        </span>
      )}
    </span>
  );
}

/** La pestaña Plusvalía: los datos, cada paso con su cuenta y la verificación contra el pago. */
function Plusvalia({
  d,
  c,
  uva,
  uvaDelPago,
  errorUva,
  mep,
  poner,
  conExcel,
  id,
  nombre,
}: {
  d: DatosPrefactibilidad;
  c: ReturnType<typeof calcular>;
  uva: { valor: number; fecha: string; fuente: string } | null;
  uvaDelPago: { valor: number; fecha: string; fuente: string } | null;
  errorUva: string | null;
  mep: number | null;
  poner: (pv: DatosPlusvalia) => void;
  conExcel: boolean;
  id: string;
  nombre: string;
}) {
  const pv = d.plusvalia;
  const [uvaManual, setUvaManual] = useState<number | null>(null);
  const [trayendo, setTrayendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const uvaUsado = uvaManual != null ? { valor: uvaManual, fecha: uva?.fecha ?? "", fuente: "Cargado a mano para probar (no se guarda)" } : uva;
  const r = calcularPlusvalia(d, c, { uva: uvaUsado, mep, uvaDelPago: uvaDelPago?.valor ?? null });
  const cambiar = (x: Partial<DatosPlusvalia>) => poner({ ...pv, ...x });
  const pctNum = (v: number | null) => (v == null ? null : Math.round(v * 10000) / 100);

  return (
    <>
      <section className="card pf__seccion">
        <h2>Datos</h2>
        <p className="crm-ficha__sub">
          La incidencia del suelo y la alícuota salen de Ciudad 3D. La superficie que computa el Gobierno es la del plano o el permiso: si la dejás vacía, se usa la construible según GCBA de Superficies ({m2(c.construible.gcba)}).
        </p>
        <div className="pf__campos">
          <Numero etiqueta="Superficie que computa el Gobierno (m²)" valor={pv.superficieComputable} poner={(v) => cambiar({ superficieComputable: v })} vacio />
          <Numero etiqueta="Ajuste del Gobierno (%)" valor={pctNum(pv.ajuste)} poner={(v) => cambiar({ ajuste: Math.min(100, v ?? 80) / 100 })} />
          <Numero etiqueta={`Superficie de la parcela (m²) · vacío: ${m2(c.superficieTerreno)}`} valor={pv.superficieParcela} poner={(v) => cambiar({ superficieParcela: v })} vacio />
          <Numero etiqueta={`FOT · vacío: el de la normativa (${d.normativa.fot ?? "—"})`} valor={pv.fot} poner={(v) => cambiar({ fot: v })} vacio />
          <Numero etiqueta="Incidencia del suelo (UVA/m²)" valor={pv.incidencia} poner={(v) => cambiar({ incidencia: v })} vacio />
          <Numero etiqueta="Alícuota (%)" valor={pctNum(pv.alicuota)} poner={(v) => cambiar({ alicuota: v == null ? null : Math.min(100, v) / 100 })} vacio />
          <label className="campo">
            Zona
            <input value={pv.zona} onChange={(e) => cambiar({ zona: e.target.value })} placeholder="Zona 3" />
          </label>
          <Numero etiqueta="Descuento de contado (%)" valor={pctNum(pv.descuentoContado)} poner={(v) => cambiar({ descuentoContado: Math.min(100, v ?? 0) / 100 })} />
          <label className="campo">
            Pago registrado: fecha
            <input type="date" value={pv.pago?.fecha ?? ""} onChange={(e) => cambiar({ pago: e.target.value ? { fecha: e.target.value, monto: pv.pago?.monto ?? 0 } : null })} />
          </label>
          <Numero etiqueta="Pago registrado: monto ($)" valor={pv.pago?.monto ?? null} poner={(v) => cambiar({ pago: pv.pago?.fecha && v ? { fecha: pv.pago.fecha, monto: v } : pv.pago?.fecha ? { fecha: pv.pago.fecha, monto: 0 } : null })} vacio />
        </div>
        {conExcel && (
          <div className="pf__acciones">
            <button
              type="button"
              className="btn btn--borde btn--chico"
              disabled={trayendo}
              onClick={async () => {
                setTrayendo(true);
                setAviso(null);
                try {
                  const x = await leerJson<{ plusvalia: Partial<DatosPlusvalia>; pago: { fecha: string; monto: number; descripcion: string } | null }>(await fetch(`/api/prefactibilidad/${id}/plusvalia-excel`));
                  poner({ ...pv, ...Object.fromEntries(Object.entries(x.plusvalia).filter(([, v]) => v !== null && v !== "")), pago: x.pago ? { fecha: x.pago.fecha, monto: x.pago.monto } : pv.pago });
                  setAviso(`Traje los datos de EE.RR${x.pago ? ` y el pago del ${x.pago.fecha.split("-").reverse().join("/")} ("${x.pago.descripcion}")` : " (no encontré el pago en la caja)"}. Revisalos y tocá "Guardar cambios".`);
                } catch (e) {
                  setAviso(e instanceof Error ? e.message : String(e));
                } finally {
                  setTrayendo(false);
                }
              }}
            >
              {trayendo ? "Trayendo…" : "Traer del Excel madre (EE.RR) y el pago de la caja"}
            </button>
            {aviso && <span className="crm-ficha__aviso">{aviso}</span>}
          </div>
        )}
      </section>

      <section className="card pf__seccion">
        <h2>La cuenta, paso a paso</h2>
        {errorUva && <p className="alerta alerta--aviso">No pude traer el UVA ({errorUva}). Podés cargarlo a mano abajo para hacer la cuenta.</p>}
        {r.avisos.map((a) => (
          <p key={a} className="alerta alerta--aviso">
            {a}
          </p>
        ))}
        <table className="tabla pf__plusvalia">
          <tbody>
            {r.pasos.map((x) => (
              <tr key={x.clave} className={x.total ? "pf__paso-total" : undefined}>
                <th scope="row">{x.nombre}</th>
                <td className="tabla__numero">
                  {x.clave === "uva" && uvaManual == null && !uva ? "—" : formatear(x.valor, x.unidad)} <Nota clave={`pf:${id}:pv:${x.clave}`} etiqueta={`${nombre} · Plusvalía · ${x.nombre}`} />
                </td>
                <td className="pf__paso-cuenta">{x.cuenta}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pf__acciones">
          <span className="crm-ficha__sub">Probar con otro UVA (no se guarda):</span>
          <CeldaNumero valor={uvaManual} poner={(v: number | null) => setUvaManual(v)} vacio placeholder={uva ? String(uva.valor) : "UVA"} />
          {uvaManual != null && (
            <button type="button" className="btn btn--texto btn--chico" onClick={() => setUvaManual(null)}>
              Volver al UVA de hoy
            </button>
          )}
          {uvaDelPago && (
            <button type="button" className="btn btn--texto btn--chico" onClick={() => setUvaManual(uvaDelPago.valor)}>
              Usar el UVA del día del pago ({uvaDelPago.valor.toLocaleString("es-AR")})
            </button>
          )}
        </div>
      </section>

      {r.verificacion && (
        <section className="card pf__seccion">
          <h2>Verificación con lo pagado</h2>
          <dl className="pf__totales">
            <div>
              <dt>Pagado el {pv.pago!.fecha.split("-").reverse().join("/")}</dt>
              <dd>{formatear(pv.pago!.monto, "$")}</dd>
            </div>
            <div>
              <dt>Plusvalía sin el descuento ({formatear(pv.descuentoContado, "%")})</dt>
              <dd>
                {formatear(r.verificacion.totalImplicito, "$")} <Cuenta texto={`$ ${pv.pago!.monto.toLocaleString("es-AR")} ÷ (1 − ${pv.descuentoContado.toLocaleString("es-AR")}) = $ ${Math.round(r.verificacion.totalImplicito).toLocaleString("es-AR")}`} />
              </dd>
            </div>
            <div>
              <dt>UVA que surge del pago</dt>
              <dd>
                {formatear(r.verificacion.uvaImplicito, "")} <Cuenta texto={`Plusvalía sin descuento ÷ base imponible (${formatear(r.pasos.find((x) => x.clave === "base")?.valor ?? null)} UVA)`} />
              </dd>
            </div>
            <div>
              <dt>UVA oficial de ese día</dt>
              <dd>{uvaDelPago ? `${uvaDelPago.valor.toLocaleString("es-AR")} (${uvaDelPago.fuente})` : "—"}</dd>
            </div>
          </dl>
          {r.verificacion.diferencia != null && (
            <p className={`alerta ${Math.abs(r.verificacion.diferencia) <= 0.005 ? "alerta--ok" : "alerta--aviso"}`}>
              {Math.abs(r.verificacion.diferencia) <= 0.005
                ? `La cuenta cierra: el UVA del pago y el oficial difieren ${(r.verificacion.diferencia * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })}% (lo que se mueve el UVA entre que se emite el certificado y se paga).`
                : `No cierra: el UVA del pago y el oficial difieren ${(r.verificacion.diferencia * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%. Revisá la superficie que computa el Gobierno, la incidencia y la alícuota.`}
            </p>
          )}
        </section>
      )}
    </>
  );
}

/** El barrio: los principales arriba y, con "Ver más barrios", el resto de CABA en orden alfabético. */
function Barrio({ valor, poner }: { valor: string; poner: (v: string) => void }) {
  const [todos, setTodos] = useState(!!valor && !BARRIOS_PRINCIPALES.includes(valor));
  return (
    <label className="campo">
      Barrio
      <select
        value={valor}
        onChange={(e) => {
          if (e.target.value === "__mas") return setTodos(true);
          poner(e.target.value);
        }}
      >
        <option value="">Elegí el barrio</option>
        <optgroup label="Principales">
          {BARRIOS_PRINCIPALES.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </optgroup>
        {todos ? (
          <optgroup label="Otros barrios">
            {OTROS_BARRIOS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </optgroup>
        ) : (
          <option value="__mas">Ver más barrios…</option>
        )}
        {valor && !BARRIOS_PRINCIPALES.includes(valor) && !OTROS_BARRIOS.includes(valor) && <option>{valor}</option>}
      </select>
    </label>
  );
}
