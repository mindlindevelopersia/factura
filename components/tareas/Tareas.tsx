"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PROYECTOS, proyecto as buscarProyecto } from "@/lib/modulos";
import {
  abierta,
  bloqueaA,
  bloqueantes,
  columnaDe,
  COLUMNAS_TABLERO,
  ESTADOS,
  ordenar,
  PRIORIDADES,
  RELACIONES,
  TIPOS,
  type CambiosTarea,
  type ColumnaTablero,
  type Comentario,
  type Tarea,
} from "@/lib/tareas/modelo";
import { leerJson } from "../formato";
import { Icono } from "../Icono";
import { useBaseProyecto } from "../proyecto";
import { useProyectoId } from "../proyectos/datos";

interface Datos {
  tareas: Tarea[];
  comentarios: Comentario[];
  usuario: string;
  equipo: string[];
  leads: { id: string; nombre: string }[];
  ahora: string;
}

const hoyBA = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const fecha = (f: string | null) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}${f.slice(0, 4) !== String(new Date().getFullYear()) ? `/${f.slice(2, 4)}` : ""}` : "");
const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));

const AYUDA_COLUMNA: Record<ColumnaTablero, string> = {
  "Por hacer": "Lo que falta arrancar.",
  "En curso": "Lo que se está haciendo.",
  Bloqueada: "Esperan otra tarea o algo de afuera: vuelven solas a su columna cuando se destraban.",
  Hecha: "Terminadas.",
};

function useTareas() {
  const id = useProyectoId();
  const base = `/api/proyectos/${id}/tareas`;
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    try {
      setDatos(await leerJson<Datos>(await fetch(base)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [base]);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  const poner = (t: Tarea) => setDatos((d) => (d ? { ...d, tareas: d.tareas.some((x) => x.id === t.id) ? d.tareas.map((x) => (x.id === t.id ? t : x)) : [...d.tareas, t] } : d));
  const crear = async (c: CambiosTarea) => {
    const { tarea } = await leerJson<{ tarea: Tarea }>(await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c) }));
    poner(tarea);
    return tarea;
  };
  const cambiar = async (tareaId: string, c: CambiosTarea) => {
    const { tarea } = await leerJson<{ tarea: Tarea }>(await fetch(`${base}/${tareaId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(c) }));
    poner(tarea);
    return tarea;
  };
  const comentar = async (tareaId: string, texto: string) => {
    const { comentario } = await leerJson<{ comentario: Comentario }>(
      await fetch(`${base}/${tareaId}/comentarios`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texto }) }),
    );
    setDatos((d) => (d ? { ...d, comentarios: [...d.comentarios, comentario] } : d));
  };
  return { proyecto: id, datos, error, cargar, crear, cambiar, comentar };
}
type Hook = ReturnType<typeof useTareas>;

/** El tablero de tareas del proyecto (y las generales de la empresa). */
export function Tareas() {
  const h = useTareas();
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const [nueva, setNueva] = useState(false);
  const [quien, setQuien] = useState("");
  const [buscar, setBuscar] = useState("");
  const [empresa, setEmpresa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hoy = hoyBA();

  // Desde el calendario o un link: ?tarea=<id> abre su ficha.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("tarea");
    if (id) setAbiertaId(id);
  }, []);

  const d = h.datos;
  const visibles = useMemo(() => {
    if (!d) return [];
    const t = buscar.trim().toLowerCase();
    return d.tareas.filter(
      (x) =>
        (empresa || x.proyecto === h.proyecto || !x.proyecto) &&
        (!quien || x.responsable === quien) &&
        (!t || `${x.titulo} ${x.con} ${x.descripcion} ${x.responsable}`.toLowerCase().includes(t)),
    );
  }, [d, buscar, empresa, quien, h.proyecto]);

  if (h.error && !d) return <p className="alerta alerta--error">{h.error}</p>;
  if (!d) return <p className="ficha__nota">Cargando las tareas…</p>;

  const mover = async (id: string, col: ColumnaTablero) => {
    const t = d.tareas.find((x) => x.id === id);
    if (!t || col === "Bloqueada") {
      // Para bloquear hay que decir qué la bloquea: se abre la ficha.
      if (t) setAbiertaId(id);
      return;
    }
    if (t.estado === col && columnaDe(t, d.tareas) === col) return;
    setError(null);
    try {
      await h.cambiar(id, { estado: col });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const mias = d.tareas.filter((x) => abierta(x) && x.responsable === d.usuario);
  const vencidas = mias.filter((x) => x.vence && x.vence < hoy).length;

  return (
    <>
      <div className="tareas__barra">
        <button type="button" className="btn btn--primario" onClick={() => setNueva(true)}>
          + Nueva tarea
        </button>
        <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar tarea, inversor, proveedor…" aria-label="Buscar tareas" />
        <select value={quien} onChange={(e) => setQuien(e.target.value)} aria-label="Responsable">
          <option value="">Todos</option>
          {d.equipo.map((p) => (
            <option key={p} value={p}>
              {p === d.usuario ? `Mías (${p})` : p}
            </option>
          ))}
        </select>
        <label className="crm__check">
          <input type="checkbox" checked={empresa} onChange={(e) => setEmpresa(e.target.checked)} /> Toda la empresa
        </label>
        <span className="crm-ficha__sub">
          Tenés {mias.length} {mias.length === 1 ? "abierta" : "abiertas"}
          {vencidas ? `, ${vencidas} ${vencidas === 1 ? "vencida" : "vencidas"}` : ""}. Arrastrá una tarjeta para cambiarla de columna.
        </span>
      </div>
      {(error || h.error) && <p className="alerta alerta--error">{error ?? h.error}</p>}
      <div className="crm-embudo tareas__tablero">
        {COLUMNAS_TABLERO.map((col) => {
          const lista = visibles.filter((t) => columnaDe(t, d.tareas) === col).sort(ordenar);
          const mostrar = col === "Hecha" ? lista.slice(0, 15) : lista;
          return (
            <section
              key={col}
              className={`crm-embudo__columna tareas__columna tareas__columna--${col === "Por hacer" ? "por-hacer" : col === "En curso" ? "en-curso" : col.toLowerCase()}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void mover(e.dataTransfer.getData("text/plain"), col);
              }}
            >
              <header title={AYUDA_COLUMNA[col]}>
                <strong>{col}</strong>
                <span>{lista.length}</span>
              </header>
              <div className="crm-embudo__tarjetas">
                {mostrar.map((t) => (
                  <TarjetaTarea key={t.id} t={t} todas={d.tareas} hoy={hoy} comentarios={d.comentarios.filter((c) => c.tareaId === t.id).length} abrir={setAbiertaId} empresa={empresa} />
                ))}
                {!lista.length && <p className="crm-ficha__sub">Vacío</p>}
                {lista.length > mostrar.length && <p className="crm-ficha__sub">Y {lista.length - mostrar.length} más (buscalas arriba).</p>}
              </div>
            </section>
          );
        })}
      </div>
      {(abiertaId || nueva) && (
        <FichaTarea
          h={h}
          tarea={abiertaId ? (d.tareas.find((x) => x.id === abiertaId) ?? null) : null}
          cerrar={() => (setAbiertaId(null), setNueva(false))}
          creada={(id) => (setNueva(false), setAbiertaId(id))}
        />
      )}
    </>
  );
}

function TarjetaTarea({ t, todas, hoy, comentarios, abrir, empresa }: { t: Tarea; todas: Tarea[]; hoy: string; comentarios: number; abrir: (id: string) => void; empresa: boolean }) {
  const vencida = abierta(t) && t.vence && t.vence < hoy;
  const hechas = t.subtareas.filter((s) => s.hecha).length;
  const espera = bloqueantes(t, todas);
  return (
    <button
      type="button"
      className={`crm-tarjeta tarea${vencida ? " crm-tarjeta--alarma" : ""}${t.prioridad !== "Normal" ? ` tarea--${t.prioridad.toLowerCase()}` : ""}`}
      onClick={() => abrir(t.id)}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
    >
      <span className="tarea__etiquetas">
        <span className="tarea__tipo">{t.tipo}</span>
        {t.prioridad !== "Normal" && <span className={`tarea__prioridad tarea__prioridad--${t.prioridad.toLowerCase()}`}>{t.prioridad}</span>}
        {empresa && <span className="tarea__tipo">{t.proyecto ? (buscarProyecto(t.proyecto)?.nombre ?? t.proyecto) : "General"}</span>}
      </span>
      <strong className={t.estado === "Hecha" ? "tarea__titulo tarea__titulo--hecha" : "tarea__titulo"}>{t.titulo}</strong>
      {t.con && (
        <span className="crm-tarjeta__datos">
          {t.relacion !== "Interna" ? `${t.relacion}: ` : ""}
          {t.con}
        </span>
      )}
      {(espera.length > 0 || t.motivoBloqueo) && abierta(t) && (
        <span className="tarea__bloqueo">
          <Icono nombre="alerta" size={12} /> {espera.length ? `Espera: ${espera.map((x) => x.titulo).join(", ")}` : t.motivoBloqueo}
        </span>
      )}
      <span className="tarea__pie">
        <span className="tarea__responsable" title="Responsable">
          {t.responsable || "Sin responsable"}
        </span>
        {t.vence && (
          <span className={vencida ? "crm-tarjeta__paso--vencido" : undefined}>
            <Icono nombre="reloj" size={12} /> {fecha(t.vence)}
            {t.hora ? ` ${t.hora}` : ""}
          </span>
        )}
        {t.subtareas.length > 0 && (
          <span>
            <Icono nombre="check" size={12} /> {hechas}/{t.subtareas.length}
          </span>
        )}
        {comentarios > 0 && (
          <span>
            <Icono nombre="mensaje" size={12} /> {comentarios}
          </span>
        )}
      </span>
    </button>
  );
}

const VACIA: CambiosTarea = { titulo: "", descripcion: "", tipo: "Otro", estado: "Por hacer", prioridad: "Normal", responsable: "", vence: null, hora: "", relacion: "Interna", con: "", contactoId: "", bloqueadaPor: [], motivoBloqueo: "", subtareas: [] };

/** La ficha de una tarea (o el alta de una nueva): todo editable, con subtareas, bloqueos y comentarios. */
function FichaTarea({ h, tarea, cerrar, creada }: { h: Hook; tarea: Tarea | null; cerrar: () => void; creada: (id: string) => void }) {
  const d = h.datos!;
  const base = useBaseProyecto();
  const [f, setF] = useState<CambiosTarea>(() => (tarea ? { ...tarea } : { ...VACIA, responsable: d.usuario, proyecto: h.proyecto }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subtarea, setSubtarea] = useState("");
  const [comentario, setComentario] = useState("");
  const [bloqueo, setBloqueo] = useState("");
  const poner = <K extends keyof CambiosTarea>(k: K, v: CambiosTarea[K]) => setF((x) => ({ ...x, [k]: v }));

  // Cambios puntuales de una tarea ya creada (subtareas, bloqueos, estado) se guardan al toque.
  const guardarYa = async (c: CambiosTarea) => {
    setF((x) => ({ ...x, ...c }));
    if (!tarea) return;
    setError(null);
    try {
      await h.cambiar(tarea.id, c);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const sinGuardar = tarea ? (["titulo", "descripcion", "tipo", "prioridad", "responsable", "vence", "hora", "relacion", "con", "contactoId", "motivoBloqueo", "proyecto"] as const).some((k) => (f[k] ?? "") !== (tarea[k] ?? "")) : true;

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      if (tarea) await h.cambiar(tarea.id, f);
      else creada((await h.crear(f)).id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  const otras = d.tareas.filter((x) => x.id !== tarea?.id && abierta(x) && !(f.bloqueadaPor ?? []).includes(x.id));
  const leBloquean = (f.bloqueadaPor ?? []).map((id) => d.tareas.find((x) => x.id === id)).filter((x): x is Tarea => !!x);
  const bloqueadas = tarea ? bloqueaA(tarea, d.tareas) : [];
  const comentarios = tarea ? d.comentarios.filter((c) => c.tareaId === tarea.id).sort((a, b) => a.fecha.localeCompare(b.fecha)) : [];
  const subtareas = f.subtareas ?? [];

  return (
    <div className="crm-ficha__fondo" onClick={cerrar}>
      <aside className="crm-ficha tarea-ficha" aria-label={tarea ? `Tarea: ${tarea.titulo}` : "Nueva tarea"} onClick={(e) => e.stopPropagation()}>
        <header className="crm-ficha__encabezado">
          <div>
            <h2>{tarea ? tarea.titulo : "Nueva tarea"}</h2>
            {tarea && (
              <span className="crm-ficha__sub">
                La creó {tarea.creo || "—"} el {fechaHora(tarea.creada)}
                {tarea.terminada ? ` · terminada el ${fechaHora(tarea.terminada)}` : ""}
              </span>
            )}
          </div>
          <button type="button" className="oliver__accion crm-ficha__cerrar" onClick={cerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" size={18} />
          </button>
        </header>
        <div className="crm-ficha__cuerpo">
          <section className="crm-ficha__seccion">
            <label className="campo">
              Título
              <input value={f.titulo ?? ""} onChange={(e) => poner("titulo", e.target.value)} placeholder="¿Qué hay que hacer?" autoFocus={!tarea} />
            </label>
            <div className="tarea-ficha__opciones" role="group" aria-label="Tipo">
              {TIPOS.map((t) => (
                <button key={t} type="button" className={`tarea-ficha__opcion${f.tipo === t ? " tarea-ficha__opcion--activa" : ""}`} onClick={() => poner("tipo", t)}>
                  {t}
                </button>
              ))}
            </div>
            <div className="tarea-ficha__grilla">
              <label className="campo">
                Estado
                <select value={f.estado} onChange={(e) => (tarea ? void guardarYa({ estado: e.target.value as Tarea["estado"] }) : poner("estado", e.target.value as Tarea["estado"]))}>
                  {ESTADOS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="campo">
                Prioridad
                <select value={f.prioridad} onChange={(e) => poner("prioridad", e.target.value as Tarea["prioridad"])}>
                  {PRIORIDADES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="campo">
                Responsable
                <select value={f.responsable} onChange={(e) => poner("responsable", e.target.value)}>
                  <option value="">Sin responsable</option>
                  {[...new Set([...d.equipo, f.responsable ?? ""].filter(Boolean))].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="campo">
                Proyecto
                <select value={f.proyecto ?? ""} onChange={(e) => poner("proyecto", e.target.value)}>
                  <option value="">General (Mindlin)</option>
                  {PROYECTOS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="campo">
                Vence
                <input type="date" value={f.vence ?? ""} onChange={(e) => poner("vence", e.target.value || null)} />
              </label>
              <label className="campo">
                Hora (opcional)
                <input type="time" value={f.hora ?? ""} onChange={(e) => poner("hora", e.target.value)} />
              </label>
              <label className="campo">
                Tiene que ver con
                <select value={f.relacion} onChange={(e) => (poner("relacion", e.target.value as Tarea["relacion"]), poner("contactoId", ""))}>
                  {RELACIONES.map((x) => (
                    <option key={x} value={x}>
                      {x === "Interna" ? "Algo interno" : x}
                    </option>
                  ))}
                </select>
              </label>
              {f.relacion === "Lead" ? (
                <label className="campo">
                  Lead del CRM
                  <select
                    value={f.contactoId ?? ""}
                    onChange={(e) => {
                      const l = d.leads.find((x) => x.id === e.target.value);
                      poner("contactoId", e.target.value);
                      poner("con", l?.nombre ?? "");
                    }}
                  >
                    <option value="">Elegí el lead</option>
                    {d.leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              ) : f.relacion !== "Interna" ? (
                <label className="campo">
                  {f.relacion === "Unidad" ? "Unidad" : `Nombre del ${(f.relacion ?? "").toLowerCase()}`}
                  <input value={f.con ?? ""} onChange={(e) => poner("con", e.target.value)} placeholder={f.relacion === "Unidad" ? "Ej.: 2C" : f.relacion === "Proveedor" ? "Ej.: la constructora" : "Ej.: Persona X"} />
                </label>
              ) : null}
            </div>
            {f.relacion === "Lead" && f.contactoId && (
              <Link className="btn btn--texto btn--chico" href={`${base}/comercial/crm?contacto=${f.contactoId}`}>
                Abrir la ficha del lead
              </Link>
            )}
            <label className="campo">
              Descripción
              <textarea rows={4} value={f.descripcion ?? ""} onChange={(e) => poner("descripcion", e.target.value)} placeholder="Contexto, qué hace falta, próximos pasos…" />
            </label>
            {error && <p className="oliver__error">{error}</p>}
            <div className="tarea-ficha__acciones">
              <button type="button" className="btn btn--primario btn--chico" onClick={() => void guardar()} disabled={guardando || (!!tarea && !sinGuardar) || !f.titulo?.trim()}>
                {guardando ? "Guardando…" : tarea ? (sinGuardar ? "Guardar cambios" : "Guardada ✓") : "Crear tarea"}
              </button>
              {tarea && abierta(tarea) && (
                <button type="button" className="btn btn--borde btn--chico" onClick={() => void guardarYa({ estado: "Hecha" })}>
                  <Icono nombre="check" size={14} /> Marcar hecha
                </button>
              )}
            </div>
          </section>

          <section className="crm-ficha__seccion">
            <h3>
              Subtareas {subtareas.length > 0 && <small className="crm-ficha__sub">{subtareas.filter((s) => s.hecha).length} de {subtareas.length}</small>}
            </h3>
            <ul className="tarea-ficha__subtareas">
              {subtareas.map((s, i) => (
                <li key={i}>
                  <label>
                    <input type="checkbox" checked={s.hecha} onChange={() => void guardarYa({ subtareas: subtareas.map((x, j) => (j === i ? { ...x, hecha: !x.hecha } : x)) })} />
                    <span className={s.hecha ? "tarea__titulo--hecha" : undefined}>{s.texto}</span>
                  </label>
                  <button type="button" className="btn btn--texto btn--chico" onClick={() => void guardarYa({ subtareas: subtareas.filter((_, j) => j !== i) })} aria-label={`Quitar ${s.texto}`}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="tarea-ficha__agregar"
              onSubmit={(e) => {
                e.preventDefault();
                if (!subtarea.trim()) return;
                void guardarYa({ subtareas: [...subtareas, { texto: subtarea.trim(), hecha: false }] });
                setSubtarea("");
              }}
            >
              <input value={subtarea} onChange={(e) => setSubtarea(e.target.value)} placeholder="Agregar una subtarea" aria-label="Nueva subtarea" />
              <button type="submit" className="btn btn--borde btn--chico">
                Agregar
              </button>
            </form>
          </section>

          <section className="crm-ficha__seccion">
            <h3>Qué la bloquea</h3>
            {leBloquean.length === 0 && !f.motivoBloqueo && <p className="crm-ficha__sub">Nada: se puede avanzar.</p>}
            <ul className="tarea-ficha__subtareas">
              {leBloquean.map((b) => (
                <li key={b.id}>
                  <span>
                    <strong>{b.titulo}</strong> <small className="crm-ficha__sub">{abierta(b) ? `${b.estado} · ${b.responsable || "sin responsable"}` : `${b.estado}: ya no bloquea`}</small>
                  </span>
                  <button type="button" className="btn btn--texto btn--chico" onClick={() => void guardarYa({ bloqueadaPor: (f.bloqueadaPor ?? []).filter((x) => x !== b.id) })}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
            <div className="tarea-ficha__agregar">
              <select value={bloqueo} onChange={(e) => setBloqueo(e.target.value)} aria-label="Tarea que la bloquea">
                <option value="">Está bloqueada por la tarea…</option>
                {otras.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.titulo}
                    {x.responsable ? ` (${x.responsable})` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn--borde btn--chico"
                disabled={!bloqueo}
                onClick={() => {
                  void guardarYa({ bloqueadaPor: [...(f.bloqueadaPor ?? []), bloqueo] });
                  setBloqueo("");
                }}
              >
                Agregar
              </button>
            </div>
            <label className="campo">
              Otro motivo (algo de afuera)
              <input value={f.motivoBloqueo ?? ""} onChange={(e) => poner("motivoBloqueo", e.target.value)} placeholder="Ej.: espera la firma del escribano" />
            </label>
            {bloqueadas.length > 0 && (
              <p className="crm-ficha__sub">
                Esta tarea bloquea a: <strong>{bloqueadas.map((x) => x.titulo).join(", ")}</strong>.
              </p>
            )}
          </section>

          {tarea && (
            <section className="crm-ficha__seccion">
              <h3>Comentarios</h3>
              {!comentarios.length && <p className="crm-ficha__sub">Todavía no hay comentarios.</p>}
              <ul className="tarea-ficha__comentarios">
                {comentarios.map((c, i) => (
                  <li key={i}>
                    <span className="crm-ficha__sub">
                      <strong>{c.usuario}</strong> · {fechaHora(c.fecha)}
                    </span>
                    <p>{c.texto}</p>
                  </li>
                ))}
              </ul>
              <form
                className="tarea-ficha__comentar"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!comentario.trim()) return;
                  setError(null);
                  try {
                    await h.comentar(tarea.id, comentario.trim());
                    setComentario("");
                  } catch (x) {
                    setError(x instanceof Error ? x.message : String(x));
                  }
                }}
              >
                <textarea rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Escribí un comentario…" aria-label="Comentario" />
                <button type="submit" className="btn btn--primario btn--chico" disabled={!comentario.trim()}>
                  Comentar
                </button>
              </form>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
