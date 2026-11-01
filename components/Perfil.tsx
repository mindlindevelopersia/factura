"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Notificacion } from "@/lib/notificaciones/modelo";
import { leerJson } from "./formato";

interface DatosPerfil {
  email: string;
  nombre: string;
  apellido: string;
  usuario: string;
  celular: string;
  horario: string;
  puesto: string;
  rol: string;
  modulos: string[];
  proyectos: string[] | null;
}

const ETIQUETA: Record<string, string> = { mencion: "Mención", asignacion: "Asignada", comentario: "Comentario", vencimiento: "Vence" };

/** Mi perfil: mis datos (editables), mi rol y lo que veo, y mis notificaciones. */
export function Perfil() {
  const [d, setD] = useState<DatosPerfil | null>(null);
  const [f, setF] = useState({ nombre: "", apellido: "", usuario: "", celular: "", horario: "" });
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [notis, setNotis] = useState<Notificacion[] | null>(null);

  useEffect(() => {
    void fetch("/api/perfil")
      .then((r) => leerJson<DatosPerfil>(r))
      .then((x) => {
        setD(x);
        setF({ nombre: x.nombre, apellido: x.apellido, usuario: x.usuario, celular: x.celular, horario: x.horario });
      })
      .catch((e) => setAviso(e instanceof Error ? e.message : String(e)));
    void fetch("/api/notificaciones")
      .then((r) => leerJson<{ notificaciones: Notificacion[] }>(r))
      .then((x) => setNotis(x.notificaciones))
      .catch(() => setNotis([]));
  }, []);

  if (!d) return <p className="ficha__nota">{aviso ?? "Cargando…"}</p>;
  const poner = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div className="perfil">
      <section className="card perfil__seccion">
        <h2>Mis datos</h2>
        <div className="tarea-ficha__grilla">
          <label className="campo">
            Nombre
            <input value={f.nombre} onChange={(e) => poner("nombre", e.target.value)} />
          </label>
          <label className="campo">
            Apellido
            <input value={f.apellido} onChange={(e) => poner("apellido", e.target.value)} />
          </label>
          <label className="campo">
            @usuario (con el que te mencionan)
            <input value={f.usuario} onChange={(e) => poner("usuario", e.target.value.replace(/\s/g, ""))} />
          </label>
          <label className="campo">
            Celular
            <input inputMode="tel" value={f.celular} onChange={(e) => poner("celular", e.target.value)} />
          </label>
          <label className="campo">
            Horario de trabajo
            <input value={f.horario} onChange={(e) => poner("horario", e.target.value)} placeholder="Lun a vie, 9 a 18" />
          </label>
          <label className="campo">
            Mail
            <input value={d.email} disabled />
          </label>
        </div>
        {aviso && <p className="crm-ficha__aviso">{aviso}</p>}
        <div className="tarea-ficha__acciones">
          <button
            type="button"
            className="btn btn--primario btn--chico"
            disabled={guardando}
            onClick={async () => {
              setGuardando(true);
              setAviso(null);
              try {
                await leerJson(await fetch("/api/perfil", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(f) }));
                setAviso("Listo, guardado. El nombre de arriba se actualiza al recargar.");
              } catch (e) {
                setAviso(e instanceof Error ? e.message : String(e));
              } finally {
                setGuardando(false);
              }
            }}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </section>

      <section className="card perfil__seccion">
        <h2>Lo que veo</h2>
        <p>
          <strong>{d.rol}</strong>
          {d.puesto ? ` · ${d.puesto}` : ""} · {d.proyectos ? `Proyectos: ${d.proyectos.join(", ") || "ninguno"}` : "Todos los proyectos"}
        </p>
        <ul className="perfil__modulos">
          {d.modulos.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <p className="crm-ficha__sub">El rol y los permisos los cambia un administrador en Ajustes.</p>
      </section>

      <section className="card perfil__seccion" id="notificaciones">
        <h2>Notificaciones</h2>
        <p className="crm-ficha__sub">Te llegan a la campanita: menciones con @, lo que te asignan, comentarios en tus tareas y tus vencimientos de hoy y mañana. Los avisos por mail (y elegir cuáles querés) vienen más adelante.</p>
        {!notis && <p className="ficha__nota">Cargando…</p>}
        {notis && !notis.length && <p className="ficha__nota">No tenés notificaciones.</p>}
        <ul className="perfil__notis">
          {(notis ?? []).map((n) => (
            <li key={n.id} className={n.leida ? undefined : "perfil__noti--nueva"}>
              <span className={`campanita__tipo campanita__tipo--${n.tipo}`}>{ETIQUETA[n.tipo]}</span>
              <Link href={n.link || "#"}>
                <strong>{n.titulo}</strong>
                {n.texto && <small>{n.texto}</small>}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
