"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AREAS_EMPRESA, areasDeProyecto, PROYECTOS, rutaProyecto, type Area } from "@/lib/modulos";
import { EtiquetaBeta } from "./Beta";
import { Icono } from "./Icono";

/**
 * El menú lateral del hub: lo de la empresa arriba y, abajo, cada proyecto con sus áreas y módulos.
 * Cada grupo (Indicadores, un proyecto, un área) se abre y se cierra con su flechita. De entrada
 * está todo cerrado, salvo el camino hasta la página en la que se está.
 */
export function Navegacion({ cerrar }: { cerrar?: ReactNode }) {
  const ruta = usePathname();
  const actual = (href: string) => (ruta === href ? "page" : undefined);
  const dentro = (href: string) => ruta === href || ruta.startsWith(`${href}/`);

  // Lo que la persona abrió o cerró a mano (por href del grupo). Lo demás sigue a la página actual.
  const [elegidos, setElegidos] = useState<Record<string, boolean>>({});
  const abierto = (href: string) => elegidos[href] ?? dentro(href);
  const alternar = (href: string) => setElegidos((e) => ({ ...e, [href]: !abierto(href) }));

  // Al entrar a una página, su camino se abre aunque antes se haya cerrado a mano.
  useEffect(() => {
    setElegidos((e) => Object.fromEntries(Object.entries(e).filter(([href]) => !(ruta === href || ruta.startsWith(`${href}/`)))));
  }, [ruta]);

  // En el celular el menú es una franja con scroll: que se vea dónde estás.
  useEffect(() => {
    document
      .querySelector(".navegacion__modulo--activo, .navegacion [aria-current='page']")
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [ruta]);

  /** Un renglón con su link y, si tiene algo adentro, la flechita para abrirlo o cerrarlo. */
  const fila = (href: string, nombre: string, link: ReactNode, conHijos: boolean) => (
    <div className="navegacion__fila">
      {link}
      {conHijos && (
        <button
          type="button"
          className={`navegacion__desplegar${abierto(href) ? " navegacion__desplegar--abierto" : ""}`}
          onClick={() => alternar(href)}
          aria-expanded={abierto(href)}
          aria-label={`${abierto(href) ? "Cerrar" : "Abrir"} ${nombre}`}
        >
          <Icono nombre="desplegar" size={14} />
        </button>
      )}
    </div>
  );

  const modulos = (area: Area) =>
    area.modulos.length > 0 &&
    abierto(area.href) && (
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
      <div className="navegacion__fila">
        <Link href="/" className={`navegacion__area${ruta === "/" ? " navegacion__area--activa" : ""}`} aria-current={actual("/")}>
          <Icono nombre="hub" size={18} />
          Inicio
        </Link>
        {cerrar}
      </div>
      {AREAS_EMPRESA.map((area) => (
        <div key={area.href} className="navegacion__grupo">
          {fila(
            area.href,
            area.nombre,
            <Link href={area.href} className={`navegacion__area${dentro(area.href) ? " navegacion__area--activa" : ""}`} aria-current={actual(area.href)}>
              <Icono nombre={area.icono} size={18} />
              {area.nombre}
            </Link>,
            area.modulos.length > 0,
          )}
          {modulos(area)}
        </div>
      ))}

      <span className="navegacion__titulo">Proyectos</span>
      {PROYECTOS.map((p) => {
        if (p.estado === "bloqueado") {
          return (
            <Link
              key={p.id}
              href={rutaProyecto(p.id)}
              className={`navegacion__area navegacion__area--bloqueada${dentro(rutaProyecto(p.id)) ? " navegacion__area--activa" : ""}`}
              aria-current={actual(rutaProyecto(p.id))}
              title="En preparación: ver qué falta para abrirlo"
            >
              <Icono nombre="proyecto" size={18} />
              {p.nombre}
              <EtiquetaBeta />
            </Link>
          );
        }
        const base = rutaProyecto(p.id);
        return (
          <div key={p.id} className="navegacion__grupo navegacion__proyecto">
            {fila(
              base,
              p.nombre,
              <Link href={base} className={`navegacion__area${dentro(base) ? " navegacion__area--activa" : ""}`} aria-current={actual(base)}>
                <Icono nombre="proyecto" size={18} />
                {p.nombre}
              </Link>,
              true,
            )}
            {abierto(base) &&
              areasDeProyecto(p.id).map((area) => (
                <div key={area.href} className="navegacion__subgrupo">
                  {fila(
                    area.href,
                    area.nombre,
                    <Link href={area.href} className={`navegacion__subarea${dentro(area.href) ? " navegacion__subarea--activa" : ""}`} aria-current={actual(area.href)}>
                      {area.nombre}
                    </Link>,
                    area.modulos.length > 0,
                  )}
                  {modulos(area)}
                </div>
              ))}
          </div>
        );
      })}
    </nav>
  );
}
