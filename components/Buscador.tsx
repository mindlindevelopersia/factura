"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buscar, paginas, type Resultado } from "@/lib/buscador/indice";
import { leerJson } from "./formato";
import { Icono } from "./Icono";
import { usePuedeRuta } from "./Permisos";

const EVENTO = "abrir-buscador";
const VIGENCIA = 5 * 60 * 1000;

// Lo leído de los datos queda para toda la sesión del navegador (se vuelve a pedir a los 5 minutos).
let cache: { resultados: Resultado[]; faltan: string[]; cuando: number } | null = null;
let pedido: Promise<void> | null = null;
function cargarDatos(): Promise<void> {
  if (cache && Date.now() - cache.cuando < VIGENCIA) return Promise.resolve();
  pedido ??= fetch("/api/buscar")
    .then((r) => leerJson<{ resultados: Resultado[]; faltan: string[] }>(r))
    .then((d) => {
      cache = { ...d, cuando: Date.now() };
    })
    .finally(() => {
      pedido = null;
    });
  return pedido;
}

export const abrirBuscador = () => window.dispatchEvent(new Event(EVENTO));

/** La caja de búsqueda (en el inicio y en cada proyecto): abre el buscador. */
export function CajaBuscar({ placeholder = "Buscar leads, propuestas, unidades, inversores, tareas…" }: { placeholder?: string }) {
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return (
    <button type="button" className="caja-buscar" onClick={abrirBuscador}>
      <Icono nombre="buscar" size={18} />
      <span>{placeholder}</span>
      <kbd>{mac ? "⌘" : "Ctrl"}</kbd>
      <kbd>K</kbd>
    </button>
  );
}

/** El omni de todo el hub: se abre con ⌘K / Ctrl+K o con la caja, y busca mientras escribís. */
export function Buscador() {
  const router = useRouter();
  const ruta = usePathname();
  const proyecto = ruta.match(/^\/proyectos\/([^/]+)/)?.[1] ?? "";
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [elegido, setElegido] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setVersion] = useState(0);
  const lista = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const abrir = () => setAbierto(true);
    const tecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto((x) => !x);
      }
    };
    window.addEventListener(EVENTO, abrir);
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener(EVENTO, abrir);
      window.removeEventListener("keydown", tecla);
    };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    setCargando(true);
    setError(null);
    cargarDatos()
      .then(() => setVersion((v) => v + 1))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setCargando(false));
  }, [abierto]);

  const ve = usePuedeRuta();
  const todas = paginas().filter((r) => ve(r.href));
  const resultados = q.trim() ? buscar([...todas, ...(cache?.resultados ?? [])], q, proyecto) : [];
  // Sin escribir nada: las áreas del proyecto en el que estás (o las de la empresa).
  const sugeridos = q.trim() ? [] : todas.filter((r) => r.tipo === "Página" && (proyecto ? r.proyecto === proyecto && !r.etiqueta.includes(" · ") : r.proyecto === "" || r.etiqueta === "Proyecto"));
  const mostrar = q.trim() ? resultados : sugeridos;

  useEffect(() => setElegido(0), [q]);
  useEffect(() => {
    lista.current?.querySelector(`[data-i="${elegido}"]`)?.scrollIntoView({ block: "nearest" });
  }, [elegido]);

  if (!abierto) return null;
  const cerrar = () => {
    setAbierto(false);
    setQ("");
  };
  const ir = (r: Resultado | undefined) => {
    if (!r) return;
    cerrar();
    router.push(r.href);
  };

  return (
    <div className="omni__fondo" onClick={cerrar}>
      <div className="omni" role="dialog" aria-label="Buscar en el hub" onClick={(e) => e.stopPropagation()}>
        <div className="omni__campo">
          <Icono nombre="buscar" size={18} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscá lo que sea: un lead, una unidad, un inversor, una tarea, una página…"
            aria-label="Buscar"
            onKeyDown={(e) => {
              if (e.key === "Escape") cerrar();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setElegido((i) => Math.min(mostrar.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setElegido((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") ir(mostrar[elegido]);
            }}
          />
          {cargando && <span className="omni__cargando">Buscando en los datos…</span>}
        </div>
        {!q.trim() && <p className="omni__ayuda">{proyecto ? "Ir a un área del proyecto, o escribí para buscar en todo." : "Ir a un proyecto o área, o escribí para buscar en todo."}</p>}
        <ul className="omni__lista" ref={lista} role="listbox">
          {mostrar.map((r, i) => (
            <li key={`${r.tipo}-${r.href}-${r.titulo}`} data-i={i} role="option" aria-selected={i === elegido}>
              <button type="button" className={`omni__resultado${i === elegido ? " omni__resultado--elegido" : ""}`} onMouseEnter={() => setElegido(i)} onClick={() => ir(r)}>
                <span className="omni__textos">
                  <strong data-sensible={r.tipo === "Inversor" || r.tipo === "Lead" || r.tipo === "Propuesta" ? "" : undefined}>{r.titulo}</strong>
                  {r.detalle && <small>{r.detalle}</small>}
                </span>
                <span className={`omni__tag omni__tag--${r.tipo === "Página" ? "pagina" : r.tipo.toLowerCase()}${r.etiqueta === "Cobro vencido" ? " omni__tag--vencido" : ""}`}>{r.etiqueta}</span>
              </button>
            </li>
          ))}
        </ul>
        {q.trim() && !resultados.length && !cargando && <p className="omni__ayuda">No encontré nada con &quot;{q}&quot;.</p>}
        {error && <p className="omni__ayuda">No pude leer los datos ({error}): busco solo en las páginas.</p>}
        {!!cache?.faltan.length && <p className="omni__ayuda">No pude leer: {cache.faltan.join(", ")}.</p>}
        <footer className="omni__pie">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> para moverte · <kbd>Enter</kbd> para abrir · <kbd>Esc</kbd> para cerrar
          </span>
        </footer>
      </div>
    </div>
  );
}
