"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icono } from "./Icono";
import { camino } from "./Migas";

interface Mensaje {
  role: "user" | "assistant";
  content: string;
}

/** Negrita (**así**) dentro de una línea. */
function enLinea(texto: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) => (parte.startsWith("**") && parte.endsWith("**") ? <strong key={i}>{parte.slice(2, -2)}</strong> : parte));
}

/** Lo justo de Markdown para las respuestas: párrafos, listas con "-" y negrita. Sin HTML. */
function Texto({ texto }: { texto: string }) {
  const bloques: ReactNode[] = [];
  let lista: string[] = [];
  const cerrarLista = () => {
    if (lista.length) bloques.push(<ul key={`l${bloques.length}`}>{lista.map((l, i) => <li key={i}>{enLinea(l)}</li>)}</ul>);
    lista = [];
  };
  for (const linea of texto.split("\n")) {
    const item = linea.match(/^\s*[-*•]\s+(.*)$/);
    if (item) {
      lista.push(item[1]);
      continue;
    }
    cerrarLista();
    if (linea.trim()) bloques.push(<p key={`p${bloques.length}`}>{enLinea(linea.replace(/^#+\s*/, ""))}</p>);
  }
  cerrarLista();
  return <>{bloques}</>;
}

const SUGERENCIAS: Record<string, string[]> = {
  "cuentas-corrientes": ["¿Quién tiene más saldo?", "Explicame cómo se calcula el saldo en pesos de hoy", "¿Qué hay que corregir en la planilla?"],
  cobranzas: ["¿Quién está más atrasado?", "¿Cuánto hay vencido, actualizado por CAC?", "¿A quién tengo que avisar este mes?"],
  comercial: ["¿Cuánto falta vender a lista?", "¿Qué unidades están libres?", "¿A cuánto vendimos el m² en promedio?"],
  management: ["¿Cuántos m² les tocan a los desarrolladores?", "¿Qué gastos de HQ están en duda?"],
  egresos: ["¿En qué se fue más plata este año?", "¿Cuánto se gastó en hormigón?"],
  ingresos: ["¿Cuánto falta cobrar?", "¿Qué está atrasado?"],
  indicadores: ["¿Subió más el CAC o el dólar?", "¿Conviene comprar hierro ahora?"],
  inicio: ["¿Qué puedo hacer en el hub?", "¿Cómo está el dólar hoy?"],
  crm: ["¿A quién tengo que llamar hoy?", "¿Quién está más cerca de comprar?", "¿Quién busca un 2 ambientes?"],
};

function sugerenciasDe(ruta: string): string[] {
  if (ruta.includes("cuentas-corrientes")) return SUGERENCIAS["cuentas-corrientes"];
  if (ruta.includes("/crm")) return SUGERENCIAS.crm;
  for (const k of ["cobranzas", "management", "egresos", "ingresos", "indicadores", "comercial"]) if (ruta.includes(k)) return SUGERENCIAS[k];
  if (/^\/proyectos\/[^/]+$/.test(ruta)) return SUGERENCIAS.comercial;
  return SUGERENCIAS.inicio;
}

/**
 * Oliver: una burbuja abajo a la derecha que abre un chat. Responde con los datos de la página en la
 * que se está (los arma el servidor). La conversación sigue mientras se navega y se borra al cerrar
 * la pestaña: no se guarda en ningún lado.
 */
export function Oliver() {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lista = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLTextAreaElement>(null);
  const seccion = camino(ruta).slice(1).map((m) => m.nombre).join(" › ") || "Inicio";

  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight });
  }, [mensajes, abierto]);
  useEffect(() => {
    if (abierto) entrada.current?.focus();
  }, [abierto]);

  async function preguntar(pregunta: string) {
    const q = pregunta.trim();
    if (!q || pensando) return;
    const conversacion: Mensaje[] = [...mensajes, { role: "user", content: q }];
    setMensajes([...conversacion, { role: "assistant", content: "" }]);
    setTexto("");
    setError(null);
    setPensando(true);
    try {
      const res = await fetch("/api/oliver", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ruta, mensajes: conversacion }) });
      if (!res.ok || !res.body) {
        const datos = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(datos?.error ?? `Respondió ${res.status}`);
      }
      const lector = res.body.getReader();
      const dec = new TextDecoder();
      let respuesta = "";
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        respuesta += dec.decode(value, { stream: true });
        setMensajes([...conversacion, { role: "assistant", content: respuesta }]);
      }
      if (!respuesta.trim()) setMensajes([...conversacion, { role: "assistant", content: "No pude responder. Probá de nuevo." }]);
    } catch (e) {
      setMensajes(conversacion);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPensando(false);
    }
  }

  if (!abierto) {
    return (
      <button type="button" className="oliver__burbuja solo-pantalla" onClick={() => setAbierto(true)} aria-label="Abrir el chat con Oliver">
        <Icono nombre="mensaje" size={22} />
        <span>Oliver</span>
        {mensajes.length > 0 && <span className="oliver__punto" aria-hidden="true" />}
      </button>
    );
  }

  return (
    <section className="oliver solo-pantalla" aria-label="Chat con Oliver">
      <header className="oliver__encabezado">
        <span className="oliver__avatar" aria-hidden="true">
          O
        </span>
        <div>
          <strong>Oliver</strong>
          <span>Mirando: {seccion}</span>
        </div>
        {mensajes.length > 0 && (
          <button type="button" className="oliver__accion" onClick={() => setMensajes([])} title="Empezar de nuevo" aria-label="Empezar una conversación nueva" disabled={pensando}>
            <Icono nombre="recargar" size={16} />
          </button>
        )}
        <button type="button" className="oliver__accion" onClick={() => setAbierto(false)} title="Minimizar" aria-label="Minimizar el chat">
          <Icono nombre="cerrar" size={16} />
        </button>
      </header>

      <div className="oliver__mensajes" ref={lista} aria-live="polite">
        {mensajes.length === 0 && (
          <div className="oliver__bienvenida">
            <p>
              Hola, soy <strong>Oliver</strong>. Te ayudo a entender los datos de esta sección: te explico de dónde sale cada número y hago cuentas con lo que hay acá. Si algo no está, te lo digo.
            </p>
            <div className="oliver__sugerencias">
              {sugerenciasDe(ruta).map((s) => (
                <button key={s} type="button" onClick={() => void preguntar(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {mensajes.map((m, i) => (
          <div key={i} className={`oliver__mensaje oliver__mensaje--${m.role === "user" ? "yo" : "oliver"}`}>
            {m.role === "assistant" && !m.content ? <span className="oliver__escribiendo">Mirando los datos…</span> : m.role === "assistant" ? <Texto texto={m.content} /> : <p>{m.content}</p>}
          </div>
        ))}
        {error && (
          <p role="alert" className="oliver__error">
            {error}
          </p>
        )}
      </div>

      <form
        className="oliver__entrada"
        onSubmit={(e) => {
          e.preventDefault();
          void preguntar(texto);
        }}
      >
        <textarea
          ref={entrada}
          value={texto}
          rows={1}
          maxLength={2000}
          placeholder="Preguntale a Oliver…"
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void preguntar(texto);
            }
          }}
        />
        <button type="submit" className="btn btn--primario btn--chico" disabled={pensando || !texto.trim()} aria-label="Enviar">
          <Icono nombre="flecha" size={16} />
        </button>
      </form>
      <p className="oliver__pie">Responde con los datos de esta página. No guarda la conversación.</p>
    </section>
  );
}
