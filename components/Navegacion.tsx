"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AREAS_EMPRESA, areasDeProyecto, PROYECTO_PRINCIPAL, PROYECTOS, rutaProyecto, type Area } from "@/lib/modulos";
import { EtiquetaBeta } from "./Beta";
import { Icono } from "./Icono";

/** El menú lateral del hub: lo de la empresa arriba y, abajo, cada proyecto con sus áreas y módulos. */
export function Navegacion() {
  const ruta = usePathname();
  const actual = (href: string) => (ruta === href ? "page" : undefined);
  const dentro = (href: string) => ruta === href || ruta.startsWith(`${href}/`);
  // Se despliega el proyecto en el que se está; si no se está en ninguno, el principal.
  const abierto = PROYECTOS.find((p) => dentro(rutaProyecto(p.id)))?.id ?? PROYECTO_PRINCIPAL.id;

  // En el celular el menú es una franja con scroll: que se vea dónde estás.
  useEffect(() => {
    document
      .querySelector(".navegacion__modulo--activo, .navegacion [aria-current='page']")
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [ruta]);

  const modulos = (area: Area) =>
    area.modulos.length > 0 && (
      <ul className="navegacion__modulos">
        {area.modulos.map((m) => (
          <li key={m.href}>
            <Link href={m.href} className={`navegacion__modulo${dentro(m.href) ? " navegacion__modulo--activo" : ""}`} aria-current={actual(m.href)}>
              {m.nombre}
              {m.beta && <EtiquetaBeta />}
            </Link>
          </li>
        ))}
      </ul>
    );

  return (
    <nav className="navegacion" aria-label="Mindlin Developers">
      <Link href="/" className={`navegacion__area${ruta === "/" ? " navegacion__area--activa" : ""}`} aria-current={actual("/")}>
        <Icono nombre="hub" size={18} />
        Inicio
      </Link>
      {AREAS_EMPRESA.map((area) => (
        <div key={area.href} className="navegacion__grupo">
          <Link href={area.href} className={`navegacion__area${dentro(area.href) ? " navegacion__area--activa" : ""}`} aria-current={actual(area.href)}>
            <Icono nombre={area.icono} size={18} />
            {area.nombre}
          </Link>
          {modulos(area)}
        </div>
      ))}

      <span className="navegacion__titulo">Proyectos</span>
      {PROYECTOS.map((p) =>
        p.estado === "bloqueado" ? (
          <span key={p.id} className="navegacion__area navegacion__area--bloqueada" title="Todavía no se puede entrar: está en preparación">
            <Icono nombre="proyecto" size={18} />
            {p.nombre}
            <EtiquetaBeta />
          </span>
        ) : (
          <div key={p.id} className="navegacion__grupo navegacion__proyecto">
            <Link
              href={rutaProyecto(p.id)}
              className={`navegacion__area${dentro(rutaProyecto(p.id)) ? " navegacion__area--activa" : ""}`}
              aria-current={actual(rutaProyecto(p.id))}
            >
              <Icono nombre="proyecto" size={18} />
              {p.nombre}
            </Link>
            {abierto === p.id &&
              areasDeProyecto(p.id).map((area) => (
                <div key={area.href} className="navegacion__subgrupo">
                  <Link href={area.href} className={`navegacion__subarea${dentro(area.href) ? " navegacion__subarea--activa" : ""}`} aria-current={actual(area.href)}>
                    {area.nombre}
                  </Link>
                  {modulos(area)}
                </div>
              ))}
          </div>
        ),
      )}
    </nav>
  );
}
