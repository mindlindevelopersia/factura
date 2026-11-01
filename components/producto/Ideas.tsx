"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ComentarioIdea, EstadoIdea, Idea } from "@/lib/producto/ideas";
import { IDEAS_SUGERIDAS, type IdeaSugerida } from "@/lib/producto/sugeridas";
import { areaDeTag, esDelArea, GRUPOS_TAGS, SEP_TAG } from "@/lib/producto/tags";
import { leerJson } from "../formato";
import { Icono } from "../Icono";
import { CampoMenciones, ConMenciones } from "../Menciones";

interface Datos {
  ideas: Idea[];
  comentarios: ComentarioIdea[];
  usuario: string;
}

const fechaHora = (iso: string) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));
const extracto = (t: string) => (t.length > 220 ? `${t.slice(0, 219)}…` : t);

/** Producto · Ideas: el tablero de mensajes. Cada idea con título, descripción y comentarios; las que van pasan a Features. */
export function Ideas() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [nueva, setNueva] = useState(false);
  const [ver, setVer] = useState<EstadoIdea | "todas">("Abierta");
  const [area, setArea] = useState("");

  const cargar = useCallback(async () => {
    try {
      setDatos(await leerJson<Datos>(await fetch("/api/producto/ideas", { cache: "no-store" })));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    void cargar();
    const id = new URLSearchParams(window.location.search).get("idea");
    if (id) setAbierta(id);
  }, [cargar]);

  if (error && !datos) return <p className="alerta alerta--error">{error}</p>;
  if (!datos) return <p className="ficha__nota">Cargando las ideas…</p>;
  const lista = datos.ideas.filter((i) => (ver === "todas" || i.estado === ver) && (!area || esDelArea(i.tags, area)));
  const areasUsadas = GRUPOS_TAGS.map((g) => g.area).filter((a) => datos.ideas.some((i) => esDelArea(i.tags, a)));
  const idea = datos.ideas.find((i) => i.id === abierta);
  const cuenta = (e: EstadoIdea) => datos.ideas.filter((i) => i.estado === e).length;

  return (
    <div className="ideas">
      <div className="tareas__barra">
        <button type="button" className="btn btn--primario" onClick={() => setNueva((x) => !x)}>
          {nueva ? "Cancelar" : "+ Nueva idea"}
        </button>
        <div className="cf__selector" role="group" aria-label="Qué ideas ver">
          {(["Abierta", "En features", "Descartada", "todas"] as const).map((e) => (
            <button key={e} type="button" className={ver === e ? "activo" : undefined} onClick={() => setVer(e)}>
              {e === "todas" ? `Todas (${datos.ideas.length})` : `${e === "Abierta" ? "Abiertas" : e === "Descartada" ? "Descartadas" : "En features"} (${cuenta(e)})`}
            </button>
          ))}
        </div>
        {areasUsadas.length > 0 && (
          <select className="ideas__filtro-area" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filtrar por área">
            <option value="">Todas las áreas</option>
            {areasUsadas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        )}
      </div>
      <Sugeridas
        publicadas={datos.ideas.map((i) => i.titulo)}
        listo={async (i) => {
          await cargar();
          setAbierta(i.id);
        }}
      />
      {nueva && (
        <NuevaIdea
          listo={async (i) => {
            setNueva(false);
            await cargar();
            setAbierta(i.id);
          }}
        />
      )}
      {!lista.length && <p className="ficha__nota">{datos.ideas.length ? "No hay ideas acá." : "Todavía no hay ideas. Tirá la primera con “+ Nueva idea”."}</p>}
      <ul className="ideas__lista">
        {lista.map((i) => {
          const n = datos.comentarios.filter((c) => c.ideaId === i.id).length;
          return (
            <li key={i.id}>
              <button type="button" className="ideas__tarjeta" onClick={() => setAbierta(i.id)}>
                <span className="ideas__arriba">
                  <strong>{i.titulo}</strong>
                  {i.estado !== "Abierta" && <span className={`ideas__estado ideas__estado--${i.estado === "En features" ? "features" : "descartada"}`}>{i.estado}</span>}
                </span>
                {i.texto && <span className="ideas__texto">{extracto(i.texto)}</span>}
                <Tags tags={i.tags} />
                <span className="tarea__pie">
                  <span className="tarea__responsable">{i.autor || "—"}</span>
                  <span>{fechaHora(i.creada)}</span>
                  <span>
                    <Icono nombre="mensaje" size={12} /> {n} {n === 1 ? "comentario" : "comentarios"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {idea && (
        <FichaIdea
          key={idea.id}
          idea={idea}
          comentarios={datos.comentarios.filter((c) => c.ideaId === idea.id).sort((a, b) => a.fecha.localeCompare(b.fecha))}
          usuario={datos.usuario}
          cerrar={() => setAbierta(null)}
          cambio={cargar}
        />
      )}
    </div>
  );
}

function NuevaIdea({ listo }: { listo: (i: Idea) => void }) {
  const [titulo, setTitulo] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  return (
    <form
      className="card ideas__nueva"
      onSubmit={async (e) => {
        e.preventDefault();
        setGuardando(true);
        setError(null);
        try {
          const { idea } = await leerJson<{ idea: Idea }>(await fetch("/api/producto/ideas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ titulo, texto, tags }) }));
          listo(idea);
        } catch (x) {
          setError(x instanceof Error ? x.message : String(x));
        } finally {
          setGuardando(false);
        }
      }}
    >
      <label className="campo">
        Título
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: módulo de compras y presupuestos" autoFocus />
      </label>
      <label className="campo">
        Descripción
        <CampoMenciones rows={6} value={texto} onChange={setTexto} placeholder="Qué es, para qué sirve, cómo lo imaginás… (con @ le avisás a alguien)" />
      </label>
      <ElegirTags value={tags} onChange={setTags} />
      {error && <p className="oliver__error">{error}</p>}
      <div className="tarea-ficha__acciones">
        <button type="submit" className="btn btn--primario btn--chico" disabled={guardando || !titulo.trim()}>
          {guardando ? "Publicando…" : "Publicar"}
        </button>
      </div>
    </form>
  );
}

function FichaIdea({ idea, comentarios, usuario, cerrar, cambio }: { idea: Idea; comentarios: ComentarioIdea[]; usuario: string; cerrar: () => void; cambio: () => Promise<void> }) {
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(idea.titulo);
  const [texto, setTexto] = useState(idea.texto);
  const [tags, setTags] = useState(idea.tags);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const patch = async (cuerpo: Record<string, unknown>) => {
    setOcupado(true);
    setError(null);
    try {
      await leerJson(await fetch(`/api/producto/ideas/${idea.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) }));
      await cambio();
      setEditando(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };
  // Saca la idea de Features: se reabre y el feature queda cancelado (no se borra).
  const volver = async () => {
    if (!window.confirm("¿Volver esta idea a Ideas? El feature se cancela (sale del tablero, pero no se borra).")) return;
    setOcupado(true);
    setError(null);
    try {
      await leerJson(await fetch(`/api/producto/features/${idea.featureId}/a-ideas`, { method: "POST" }));
      await cambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="crm-ficha__fondo" onClick={cerrar}>
      <aside className="crm-ficha tarea-ficha" aria-label={`Idea: ${idea.titulo}`} onClick={(e) => e.stopPropagation()}>
        <header className="crm-ficha__encabezado">
          <div>
            <h2>{idea.titulo}</h2>
            <span className="crm-ficha__sub">
              {idea.autor || "—"} · {fechaHora(idea.creada)} · {idea.estado}
            </span>
          </div>
          <button type="button" className="oliver__accion crm-ficha__cerrar" onClick={cerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" size={18} />
          </button>
        </header>
        <div className="crm-ficha__cuerpo">
          <section className="crm-ficha__seccion">
            {editando ? (
              <>
                <label className="campo">
                  Título
                  <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                </label>
                <label className="campo">
                  Descripción
                  <CampoMenciones rows={8} value={texto} onChange={setTexto} />
                </label>
                <ElegirTags value={tags} onChange={setTags} />
              </>
            ) : (
              <>
                <Tags tags={idea.tags} />
                <p className="ideas__cuerpo">{idea.texto ? <ConMenciones texto={idea.texto} /> : <span className="crm-ficha__sub">Sin descripción.</span>}</p>
              </>
            )}
            {error && <p className="oliver__error">{error}</p>}
            <div className="tarea-ficha__acciones">
              {editando ? (
                <>
                  <button type="button" className="btn btn--primario btn--chico" disabled={ocupado || !titulo.trim()} onClick={() => void patch({ titulo, texto, tags })}>
                    Guardar
                  </button>
                  <button type="button" className="btn btn--texto btn--chico" onClick={() => setEditando(false)}>
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  {idea.estado !== "En features" && (
                    <button type="button" className="btn btn--primario btn--chico" disabled={ocupado} onClick={() => void patch({ aFeatures: true })}>
                      Pasar a Features
                    </button>
                  )}
                  {idea.featureId && (
                    <Link className="btn btn--borde btn--chico" href={`/producto/features?tarea=${idea.featureId}`}>
                      Ver el feature
                    </Link>
                  )}
                  {idea.featureId && (
                    <button type="button" className="btn btn--texto btn--chico" disabled={ocupado} onClick={() => void volver()}>
                      <Icono nombre="volver" size={14} /> Volver a Ideas
                    </button>
                  )}
                  {(
                    <button type="button" className="btn btn--borde btn--chico" onClick={() => setEditando(true)}>
                      Editar
                    </button>
                  )}
                  {idea.estado === "Abierta" ? (
                    <button type="button" className="btn btn--texto btn--chico" disabled={ocupado} onClick={() => void patch({ estado: "Descartada" })}>
                      Descartar
                    </button>
                  ) : (
                    idea.estado === "Descartada" && (
                      <button type="button" className="btn btn--texto btn--chico" disabled={ocupado} onClick={() => void patch({ estado: "Abierta" })}>
                        Reabrir
                      </button>
                    )
                  )}
                </>
              )}
            </div>
          </section>

          <section className="crm-ficha__seccion">
            <h3>Comentarios</h3>
            {!comentarios.length && <p className="crm-ficha__sub">Todavía no hay comentarios.</p>}
            <ul className="tarea-ficha__comentarios">
              {comentarios.map((c, i) => (
                <li key={i}>
                  <span className="crm-ficha__sub">
                    <strong>{c.usuario}</strong> · {fechaHora(c.fecha)}
                  </span>
                  <p>
                    <ConMenciones texto={c.texto} />
                  </p>
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
                  await leerJson(await fetch(`/api/producto/ideas/${idea.id}/comentarios`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texto: comentario.trim() }) }));
                  setComentario("");
                  await cambio();
                } catch (x) {
                  setError(x instanceof Error ? x.message : String(x));
                }
              }}
            >
              <CampoMenciones rows={2} value={comentario} onChange={setComentario} placeholder="Comentá… (con @ le avisás a alguien)" aria-label="Comentario" />
              <button type="submit" className="btn btn--primario btn--chico" disabled={!comentario.trim()}>
                Comentar
              </button>
            </form>
          </section>
        </div>
      </aside>
    </div>
  );
}

/** Los tags de una idea, como chips (el módulo se muestra con su área). */
function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  // Si está el área y también sus módulos, el área sola sobra en la tarjeta.
  const mostrar = tags.filter((t) => t.includes(SEP_TAG) || !tags.some((x) => x !== t && areaDeTag(x) === t));
  return (
    <span className="ideas__tags">
      {mostrar.map((t) => (
        <span key={t} className="ideas__tag">
          {t}
        </span>
      ))}
    </span>
  );
}

/** Elegir a qué áreas (y módulos) aplica la idea: las áreas como chips; al marcar una, aparecen sus módulos. */
function ElegirTags({ value, onChange }: { value: string[]; onChange: (t: string[]) => void }) {
  const tiene = (t: string) => value.includes(t);
  const poner = (t: string) => onChange(tiene(t) ? value.filter((x) => x !== t) : [...value, t]);
  const abiertas = GRUPOS_TAGS.filter((g) => value.some((t) => areaDeTag(t) === g.area) && g.modulos.length);
  return (
    <div className="campo ideas__elegir-tags">
      <span>¿A qué área aplica? (opcional)</span>
      <div className="tarea-ficha__opciones" role="group" aria-label="Áreas">
        {GRUPOS_TAGS.map((g) => (
          <button
            key={g.area}
            type="button"
            className={`tarea-ficha__opcion${value.some((t) => areaDeTag(t) === g.area) ? " tarea-ficha__opcion--activa" : ""}`}
            aria-pressed={value.some((t) => areaDeTag(t) === g.area)}
            onClick={() => (value.some((t) => areaDeTag(t) === g.area) ? onChange(value.filter((t) => areaDeTag(t) !== g.area)) : poner(g.area))}
          >
            {g.area}
          </button>
        ))}
      </div>
      {abiertas.map((g) => (
        <div key={g.area} className="ideas__modulos-tag" role="group" aria-label={`Módulos de ${g.area}`}>
          <small>{g.area}:</small>
          {g.modulos.map((m) => {
            const t = `${g.area}${SEP_TAG}${m}`;
            return (
              <button key={t} type="button" className={`tarea-ficha__opcion tarea-ficha__opcion--chica${tiene(t) ? " tarea-ficha__opcion--activa" : ""}`} aria-pressed={tiene(t)} onClick={() => poner(t)}>
                {m}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const CLAVE_DESCARTADAS = "ideas-sugeridas-descartadas";

/** Las ideas que propone el hub (por ejemplo, todo lo que falta de Marketing): se publican con un clic. */
function Sugeridas({ publicadas, listo }: { publicadas: string[]; listo: (i: Idea) => Promise<void> }) {
  const [descartadas, setDescartadas] = useState<string[]>([]);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    try {
      setDescartadas(JSON.parse(localStorage.getItem(CLAVE_DESCARTADAS) ?? "[]"));
    } catch {
      /* nada guardado */
    }
  }, []);
  const lista = IDEAS_SUGERIDAS.filter((s) => !publicadas.includes(s.titulo) && !descartadas.includes(s.clave));
  if (!lista.length) return null;
  const publicar = async (s: IdeaSugerida) => {
    setOcupado(true);
    setError(null);
    try {
      const { idea } = await leerJson<{ idea: Idea }>(await fetch("/api/producto/ideas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ titulo: s.titulo, texto: s.texto, tags: s.tags }) }));
      await listo(idea);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };
  const descartar = (s: IdeaSugerida) => {
    const l = [...descartadas, s.clave];
    setDescartadas(l);
    localStorage.setItem(CLAVE_DESCARTADAS, JSON.stringify(l));
  };
  return (
    <ul className="ideas__lista ideas__sugeridas">
      {lista.map((s) => (
        <li key={s.clave} className="ideas__sugerida">
          <span className="ideas__arriba">
            <strong>{s.titulo}</strong>
            <span className="ideas__estado ideas__estado--sugerida">La propone el hub</span>
          </span>
          <Tags tags={s.tags} />
          <p className="ideas__texto">{abierta === s.clave ? s.texto : extracto(s.texto)}</p>
          {error && <p className="oliver__error">{error}</p>}
          <div className="tarea-ficha__acciones">
            <button type="button" className="btn btn--primario btn--chico" disabled={ocupado} onClick={() => void publicar(s)}>
              {ocupado ? "Publicando…" : "Publicarla"}
            </button>
            <button type="button" className="btn btn--borde btn--chico" onClick={() => setAbierta(abierta === s.clave ? null : s.clave)}>
              {abierta === s.clave ? "Ver menos" : "Verla completa"}
            </button>
            <button type="button" className="btn btn--texto btn--chico" onClick={() => descartar(s)}>
              Ahora no
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
