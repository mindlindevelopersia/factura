"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { hilos, type ComentarioDato } from "@/lib/comentarios/modelo";
import { leerJson } from "./formato";
import { Icono } from "./Icono";
import { CampoMenciones, ConMenciones } from "./Menciones";

interface Ctx {
  ruta: string;
  comentarios: ComentarioDato[];
  comentar: (c: { clave: string; etiqueta: string; texto: string; padre?: string }) => Promise<void>;
}

const Contexto = createContext<Ctx | null>(null);

/** Carga los comentarios de los datos de una página (los de las claves que empiezan con `prefijo`). */
export function NotasProvider({ ruta, prefijo, children }: { ruta: string; prefijo: string; children: ReactNode }) {
  const [comentarios, setComentarios] = useState<ComentarioDato[]>([]);
  useEffect(() => {
    let vivo = true;
    void fetch(`/api/comentarios?ruta=${encodeURIComponent(ruta)}&prefijo=${encodeURIComponent(prefijo)}`)
      .then((r) => leerJson<{ comentarios: ComentarioDato[] }>(r))
      .then((d) => vivo && setComentarios(d.comentarios))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [ruta, prefijo]);
  const comentar = useCallback(
    async (c: { clave: string; etiqueta: string; texto: string; padre?: string }) => {
      const { comentario } = await leerJson<{ comentario: ComentarioDato }>(await fetch("/api/comentarios", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...c, ruta }) }));
      setComentarios((l) => [...l, comentario]);
    },
    [ruta],
  );
  return <Contexto.Provider value={{ ruta, comentarios, comentar }}>{children}</Contexto.Provider>;
}

const fecha = (iso: string) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));

/** La nota de un dato: un globito al lado del número (con cuántos comentarios tiene) que abre el hilo. */
export function Nota({ clave, etiqueta }: { clave: string; etiqueta: string }) {
  const ctx = useContext(Contexto);
  const [abierta, setAbierta] = useState(false);
  // El panel va fijo en la pantalla (si no, una tabla con scroll lo recorta), debajo del globito.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const caja = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: MouseEvent) => !caja.current?.contains(e.target as Node) && setAbierta(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierta(false);
    // Fijo en la pantalla: si se mueve la página (o la tabla), se cierra.
    const mover = (e: Event) => !caja.current?.contains(e.target as Node) && setAbierta(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", mover, true);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", mover, true);
    };
  }, [abierta]);
  if (!ctx) return null;
  const lista = hilos(ctx.comentarios, clave);
  const total = lista.reduce((s, h) => s + 1 + h.respuestas.length, 0);
  return (
    <span className="nota" ref={caja}>
      <button
        type="button"
        className={`nota__boton${total ? " nota__boton--con" : ""}`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const ancho = Math.min(360, window.innerWidth * 0.86);
          setPos({ top: Math.min(r.bottom + 6, window.innerHeight - 220), left: Math.max(8, Math.min(r.right - ancho, window.innerWidth - ancho - 8)) });
          setAbierta((x) => !x);
        }}
        aria-label={total ? `${total} comentarios sobre ${etiqueta}` : `Comentar ${etiqueta}`}
        title={total ? `${total} ${total === 1 ? "comentario" : "comentarios"}` : "Agregar una nota"}
      >
        <Icono nombre="mensaje" size={11} />
        {total > 0 && <span>{total}</span>}
      </button>
      {abierta && (
        <span className="nota__panel" role="dialog" aria-label={`Notas: ${etiqueta}`} style={pos ? { top: pos.top, left: pos.left } : undefined}>
          <strong className="nota__titulo">{etiqueta}</strong>
          {lista.map((h) => (
            <HiloNota key={h.raiz.id} raiz={h.raiz} respuestas={h.respuestas} responder={(texto) => ctx.comentar({ clave, etiqueta, texto, padre: h.raiz.id })} />
          ))}
          <NuevaNota placeholder={lista.length ? "Otra nota sobre este dato… (con @ avisás)" : "Anotá por qué este número es así… (con @ avisás)"} enviar={(texto) => ctx.comentar({ clave, etiqueta, texto })} />
        </span>
      )}
    </span>
  );
}

function HiloNota({ raiz, respuestas, responder }: { raiz: ComentarioDato; respuestas: ComentarioDato[]; responder: (texto: string) => Promise<void> }) {
  const [respondiendo, setRespondiendo] = useState(false);
  return (
    <span className="nota__hilo">
      <Mensaje c={raiz} />
      {respuestas.map((r) => (
        <span key={r.id} className="nota__respuesta">
          <Mensaje c={r} />
        </span>
      ))}
      {respondiendo ? (
        <span className="nota__respuesta">
          <NuevaNota placeholder="Respondé… (con @ avisás)" enviar={async (t) => (await responder(t), setRespondiendo(false))} cancelar={() => setRespondiendo(false)} />
        </span>
      ) : (
        <button type="button" className="btn btn--texto btn--chico" onClick={() => setRespondiendo(true)}>
          Responder
        </button>
      )}
    </span>
  );
}

function Mensaje({ c }: { c: ComentarioDato }) {
  return (
    <span className="nota__mensaje">
      <small>
        <strong>{c.usuario}</strong> · {fecha(c.fecha)}
      </small>
      <span>
        <ConMenciones texto={c.texto} />
      </span>
    </span>
  );
}

function NuevaNota({ placeholder, enviar, cancelar }: { placeholder: string; enviar: (texto: string) => Promise<void>; cancelar?: () => void }) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <span className="nota__nueva">
      <CampoMenciones rows={2} value={texto} onChange={setTexto} placeholder={placeholder} aria-label="Nota" />
      {error && <small className="oliver__error">{error}</small>}
      <span className="nota__acciones">
        {cancelar && (
          <button type="button" className="btn btn--texto btn--chico" onClick={cancelar}>
            Cancelar
          </button>
        )}
        <button
          type="button"
          className="btn btn--primario btn--chico"
          disabled={!texto.trim() || enviando}
          onClick={async () => {
            setEnviando(true);
            setError(null);
            try {
              await enviar(texto.trim());
              setTexto("");
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setEnviando(false);
            }
          }}
        >
          {enviando ? "Guardando…" : "Comentar"}
        </button>
      </span>
    </span>
  );
}
