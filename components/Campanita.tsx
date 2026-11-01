"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Notificacion, TipoNotificacion } from "@/lib/notificaciones/modelo";
import { leerJson } from "./formato";
import { Icono } from "./Icono";

const ETIQUETA: Record<TipoNotificacion, string> = { mencion: "Mención", asignacion: "Asignada", comentario: "Comentario", vencimiento: "Vence" };

const hace = (iso: string) => {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 0) {
    const f = iso.slice(0, 10);
    return f.split("-").reverse().join("/");
  }
  const min = Math.round(d / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.round(h / 24);
  return dias === 1 ? "ayer" : dias < 30 ? `hace ${dias} días` : iso.slice(0, 10).split("-").reverse().join("/");
};

/** La campanita de arriba a la derecha: menciones, asignaciones, comentarios y tus vencimientos. */
export function Campanita() {
  const router = useRouter();
  const [lista, setLista] = useState<Notificacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      const d = await leerJson<{ notificaciones: Notificacion[] }>(await fetch("/api/notificaciones", { cache: "no-store" }));
      setLista(d.notificaciones);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Al entrar, cada 2 minutos y al volver a la pestaña.
  useEffect(() => {
    void cargar();
    const t = setInterval(() => void cargar(), 120_000);
    const foco = () => document.visibilityState === "visible" && void cargar();
    document.addEventListener("visibilitychange", foco);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", foco);
    };
  }, [cargar]);

  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: MouseEvent) => !caja.current?.contains(e.target as Node) && setAbierta(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierta(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierta]);

  const noLeidas = (lista ?? []).filter((n) => !n.leida);
  const leer = async (ids: string[]) => {
    if (!ids.length) return;
    setLista((l) => l?.map((n) => (ids.includes(n.id) ? { ...n, leida: true } : n)) ?? l);
    await fetch("/api/notificaciones/leidas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids }) }).catch(() => undefined);
  };

  return (
    <div className="campanita" ref={caja}>
      <button
        type="button"
        className="campanita__boton"
        onClick={() => (setAbierta((x) => !x), !abierta && void cargar())}
        aria-label={noLeidas.length ? `Notificaciones: ${noLeidas.length} sin leer` : "Notificaciones"}
        aria-expanded={abierta}
      >
        <Icono nombre="campana" size={20} />
        {noLeidas.length > 0 && <span className="campanita__contador">{noLeidas.length > 9 ? "9+" : noLeidas.length}</span>}
      </button>
      {abierta && (
        <div className="campanita__panel" role="dialog" aria-label="Notificaciones">
          <header>
            <strong>Notificaciones</strong>
            {noLeidas.length > 0 && (
              <button type="button" className="btn btn--texto btn--chico" onClick={() => void leer(noLeidas.map((n) => n.id))}>
                Marcar todas como leídas
              </button>
            )}
          </header>
          {error && <p className="campanita__vacio">{error}</p>}
          {!lista && !error && <p className="campanita__vacio">Cargando…</p>}
          {lista && !lista.length && <p className="campanita__vacio">No tenés notificaciones. Cuando alguien te mencione con @, te asigne algo o se te venza algo, aparece acá.</p>}
          <ul>
            {(lista ?? []).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`campanita__item${n.leida ? "" : " campanita__item--nueva"}`}
                  onClick={() => {
                    void leer(n.leida ? [] : [n.id]);
                    setAbierta(false);
                    if (n.link) router.push(n.link);
                  }}
                >
                  <span className={`campanita__tipo campanita__tipo--${n.tipo}`}>{ETIQUETA[n.tipo]}</span>
                  <span className="campanita__textos">
                    <strong>{n.titulo}</strong>
                    {n.texto && <small>{n.texto}</small>}
                    <small className="campanita__cuando">{n.tipo === "vencimiento" ? "" : hace(n.fecha)}</small>
                  </span>
                  {!n.leida && <span className="campanita__punto" aria-label="Sin leer" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
