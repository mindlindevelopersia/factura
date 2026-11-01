"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { BotonDictar } from "./Dictado";
import { leerJson } from "./formato";

export interface UsuarioMencion {
  apodo: string;
  nombre: string;
}

let cache: UsuarioMencion[] | null = null;
let pedido: Promise<UsuarioMencion[]> | null = null;

/** Los usuarios del sistema, para mencionarlos con @ (se piden una vez). */
export function useUsuarios(): UsuarioMencion[] {
  const [lista, setLista] = useState<UsuarioMencion[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    pedido ??= fetch("/api/usuarios")
      .then((r) => leerJson<{ usuarios: UsuarioMencion[] }>(r))
      .then((d) => (cache = d.usuarios))
      .catch(() => []);
    void pedido.then((u) => setLista(u));
  }, []);
  return lista;
}

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  /** Un renglón (input) en vez de un textarea. */
  linea?: boolean;
  className?: string;
  "aria-label"?: string;
  autoFocus?: boolean;
  /** Sin el micrófono para dictar. */
  sinDictado?: boolean;
};

/** Un campo de texto donde escribir @ abre la lista de usuarios para mencionarlos (y les llega una notificación). */
export function CampoMenciones({ value, onChange, placeholder, rows = 3, linea, className, autoFocus, sinDictado, ...resto }: Props) {
  const usuarios = useUsuarios();
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const [busqueda, setBusqueda] = useState<{ desde: number; texto: string } | null>(null);
  const [elegido, setElegido] = useState(0);
  // Dónde dejar el cursor después de elegir una mención (se pone apenas React escribe el texto nuevo).
  const cursor = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (cursor.current == null || !ref.current) return;
    ref.current.setSelectionRange(cursor.current, cursor.current);
    cursor.current = null;
  }, [value]);

  const opciones = busqueda ? usuarios.filter((u) => sinTildes(u.apodo).startsWith(sinTildes(busqueda.texto)) || sinTildes(u.nombre).includes(sinTildes(busqueda.texto))).slice(0, 6) : [];

  const revisar = (texto: string, cursor: number) => {
    const m = texto.slice(0, cursor).match(/(?:^|\s)@([\p{L}\d._-]*)$/u);
    setBusqueda(m ? { desde: cursor - m[1].length - 1, texto: m[1] } : null);
    setElegido(0);
  };

  const elegir = (u: UsuarioMencion) => {
    if (!busqueda) return;
    const fin = busqueda.desde + 1 + busqueda.texto.length;
    const nuevo = `${value.slice(0, busqueda.desde)}@${u.apodo} ${value.slice(fin)}`;
    cursor.current = busqueda.desde + u.apodo.length + 2;
    onChange(nuevo);
    setBusqueda(null);
    ref.current?.focus();
  };

  const comunes = {
    ref,
    value,
    placeholder,
    className,
    autoFocus,
    "aria-label": resto["aria-label"],
    onChange: (e: { target: { value: string; selectionStart: number | null } }) => {
      onChange(e.target.value);
      revisar(e.target.value, e.target.selectionStart ?? e.target.value.length);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (!opciones.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setElegido((i) => (i + 1) % opciones.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setElegido((i) => (i - 1 + opciones.length) % opciones.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        elegir(opciones[elegido]);
      } else if (e.key === "Escape") {
        e.stopPropagation();
        setBusqueda(null);
      }
    },
    onBlur: () => setTimeout(() => setBusqueda(null), 150),
  };

  return (
    <span className={`menciones${sinDictado ? "" : " con-dictado"}${linea ? " con-dictado--linea" : ""}`}>
      {linea ? <input {...comunes} /> : <textarea {...comunes} rows={rows} />}
      {!sinDictado && <BotonDictar valor={value} onCambio={onChange} className="dictar--en-campo" />}
      {opciones.length > 0 && (
        <ul className="menciones__lista" role="listbox" aria-label="Mencionar a">
          {opciones.map((u, i) => (
            <li key={u.apodo} role="option" aria-selected={i === elegido}>
              <button type="button" className={i === elegido ? "menciones__opcion menciones__opcion--elegida" : "menciones__opcion"} onMouseDown={(e) => (e.preventDefault(), elegir(u))}>
                <strong>@{u.apodo}</strong>
                {u.nombre !== u.apodo && <small>{u.nombre}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

/** Un texto con las @menciones resaltadas. */
export function ConMenciones({ texto }: { texto: string }): ReactNode {
  const partes = texto.split(/((?:^|(?<=\s))@[\p{L}\d._-]+)/u);
  return partes.map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className="mencion">
        {p}
      </span>
    ) : (
      p
    ),
  );
}
