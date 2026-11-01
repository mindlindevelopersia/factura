"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icono } from "./Icono";

/**
 * Dictado por voz: habla y se escribe. Usa el reconocimiento de voz del navegador (Chrome, Edge,
 * Safari en la Mac y el iPhone), en castellano rioplatense, sin instalar nada. El audio lo procesa
 * el servicio del navegador (Google en Chrome, Apple en Safari); el hub no lo guarda. En los
 * navegadores que no lo tienen (Firefox), el botón no aparece.
 */

interface Resultado {
  isFinal: boolean;
  0: { transcript: string };
}
interface EventoVoz {
  resultIndex: number;
  results: ArrayLike<Resultado>;
}
interface Reconocedor {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: EventoVoz) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type ConstructorVoz = new () => Reconocedor;

function constructorVoz(): ConstructorVoz | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ConstructorVoz; webkitSpeechRecognition?: ConstructorVoz };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORES: Record<string, string> = {
  "not-allowed": "El navegador no tiene permiso para usar el micrófono. Habilitalo en el candado de la barra de direcciones.",
  "service-not-allowed": "El navegador no permite el dictado acá. Probá con Chrome o Safari.",
  "audio-capture": "No se encontró un micrófono.",
  network: "El dictado necesita internet. Probá de nuevo.",
};

/** Une lo dictado a lo que ya estaba escrito (con un espacio, y mayúscula si empieza una frase). */
export function sumarDictado(antes: string, dictado: string): string {
  const d = dictado.trim();
  if (!d) return antes;
  if (!antes.trim()) return d.charAt(0).toUpperCase() + d.slice(1);
  const finFrase = /[.!?…:\n]\s*$/.test(antes);
  return `${antes.replace(/\s+$/, "")}${antes.endsWith("\n") ? "\n" : " "}${finFrase ? d.charAt(0).toUpperCase() + d.slice(1) : d}`;
}

/** El dictado: `alDictar` recibe cada frase terminada; `parcial` es lo que se está escuchando. */
export function useDictado(alDictar: (texto: string) => void) {
  const [soportado, setSoportado] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [parcial, setParcial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Reconocedor | null>(null);
  const callback = useRef(alDictar);
  callback.current = alDictar;

  useEffect(() => {
    setSoportado(!!constructorVoz());
    return () => rec.current?.stop();
  }, []);

  const parar = useCallback(() => rec.current?.stop(), []);

  const empezar = useCallback(() => {
    const C = constructorVoz();
    if (!C || rec.current) return;
    const r = new C();
    r.lang = "es-AR";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let enCurso = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) callback.current(res[0].transcript);
        else enCurso += res[0].transcript;
      }
      setParcial(enCurso);
    };
    r.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") setError(ERRORES[e.error] ?? "No se pudo usar el dictado. Probá de nuevo.");
    };
    r.onend = () => {
      rec.current = null;
      setEscuchando(false);
      setParcial("");
    };
    setError(null);
    rec.current = r;
    try {
      r.start();
      setEscuchando(true);
    } catch {
      rec.current = null;
    }
  }, []);

  return { soportado, escuchando, parcial, error, empezar, parar, alternar: () => (rec.current ? parar() : empezar()) };
}

/**
 * El botón del micrófono para un campo de texto: tocás, hablás, y lo que decís se suma al texto.
 * Tocás de nuevo (o hacés silencio un rato) y para.
 */
export function BotonDictar({ valor, onCambio, className, etiqueta = "Dictar" }: { valor: string; onCambio: (v: string) => void; className?: string; etiqueta?: string }) {
  // El último valor, para ir sumando frase por frase aunque lleguen seguidas.
  const actual = useRef(valor);
  actual.current = valor;
  const d = useDictado((t) => {
    actual.current = sumarDictado(actual.current, t);
    onCambio(actual.current);
  });
  if (!d.soportado) return null;
  return (
    <span className={`dictar${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className={`dictar__boton${d.escuchando ? " dictar__boton--escuchando" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={d.alternar}
        aria-pressed={d.escuchando}
        aria-label={d.escuchando ? "Dejar de dictar" : etiqueta}
        title={d.escuchando ? "Escuchando… tocá para terminar" : `${etiqueta} (hablá y se escribe)`}
      >
        <Icono nombre={d.escuchando ? "detener" : "microfono"} size={15} />
      </button>
      {(d.escuchando || d.error) && (
        <span className={`dictar__aviso${d.error ? " dictar__aviso--error" : ""}`} role="status">
          {d.error ?? (d.parcial || "Escuchando… hablá")}
        </span>
      )}
    </span>
  );
}

/** Envuelve un campo (input o textarea) y le pone el micrófono adentro, abajo a la derecha. */
export function ConDictado({ valor, onCambio, linea, children }: { valor: string; onCambio: (v: string) => void; linea?: boolean; children: React.ReactNode }) {
  return (
    <span className={`con-dictado${linea ? " con-dictado--linea" : ""}`}>
      {children}
      <BotonDictar valor={valor} onCambio={onCambio} className="dictar--en-campo" />
    </span>
  );
}
