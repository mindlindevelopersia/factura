"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icono } from "./Icono";

/** Arriba a la derecha: el nombre con una flechita; abre Mi perfil, Notificaciones y Salir. */
export function MenuUsuario({ nombre, email, salir }: { nombre: string; email: string; salir: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => !caja.current?.contains(e.target as Node) && setAbierto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);
  const iniciales = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");
  return (
    <div className="menu-usuario" ref={caja}>
      <button type="button" className="menu-usuario__boton" onClick={() => setAbierto((x) => !x)} aria-expanded={abierto} aria-haspopup="menu">
        <span className="menu-usuario__avatar" aria-hidden="true">
          {iniciales || "?"}
        </span>
        <span className="menu-usuario__nombre">{nombre}</span>
        <span className={`menu-usuario__flecha${abierto ? " menu-usuario__flecha--abierta" : ""}`} aria-hidden="true">
          <Icono nombre="desplegar" size={14} />
        </span>
      </button>
      {abierto && (
        <div className="menu-usuario__panel" role="menu">
          <div className="menu-usuario__quien">
            <strong>{nombre}</strong>
            <small>{email}</small>
          </div>
          <Link href="/perfil" role="menuitem" className="menu-usuario__item" onClick={() => setAbierto(false)}>
            <Icono nombre="inversores" size={16} /> Mi perfil
          </Link>
          <Link href="/perfil#notificaciones" role="menuitem" className="menu-usuario__item" onClick={() => setAbierto(false)}>
            <Icono nombre="campana" size={16} /> Notificaciones
          </Link>
          <div className="menu-usuario__salir">{salir}</div>
        </div>
      )}
    </div>
  );
}
