"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AREAS } from "@/lib/modulos";
import { EtiquetaBeta } from "./Beta";
import { Icono } from "./Icono";

/** El menú lateral del hub: el inicio, cada área y sus módulos. */
export function Navegacion() {
  const ruta = usePathname();
  const actual = (href: string) => (ruta === href ? "page" : undefined);
  const dentro = (href: string) => ruta === href || ruta.startsWith(`${href}/`);

  // En el celular el menú es una franja con scroll: que se vea dónde estás.
  useEffect(() => {
    document
      .querySelector(".navegacion__modulo--activo, .navegacion [aria-current='page']")
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [ruta]);

  return (
    <nav className="navegacion" aria-label="Áreas de Mindlin">
      <Link
        href="/"
        className={`navegacion__area${ruta === "/" ? " navegacion__area--activa" : ""}`}
        aria-current={actual("/")}
      >
        <Icono nombre="hub" size={18} />
        Inicio
      </Link>
      {AREAS.map((area) => (
        <div key={area.href} className="navegacion__grupo">
          <Link
            href={area.href}
            className={`navegacion__area${dentro(area.href) ? " navegacion__area--activa" : ""}`}
            aria-current={actual(area.href)}
          >
            <Icono nombre={area.icono} size={18} />
            {area.nombre}
            {area.modulos.length === 0 && <span className="navegacion__pronto">Pronto</span>}
          </Link>
          {area.modulos.length > 0 && (
            <ul className="navegacion__modulos">
              {area.modulos.map((m) => (
                <li key={m.href}>
                  <Link
                    href={m.href}
                    className={`navegacion__modulo${dentro(m.href) ? " navegacion__modulo--activo" : ""}`}
                    aria-current={actual(m.href)}
                  >
                    {m.nombre}
                    {m.beta && <EtiquetaBeta />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}
