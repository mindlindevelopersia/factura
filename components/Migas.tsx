"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AREAS_EMPRESA, areasDeProyecto, PROYECTOS, rutaProyecto, SECCIONES_DE_PROYECTO } from "@/lib/modulos";
import { Icono } from "./Icono";

/** El nombre de cada ruta conocida del hub (inicio, áreas, proyectos y módulos). */
function nombres(): Map<string, string> {
  const m = new Map<string, string>([["/", "Inicio"]]);
  for (const a of AREAS_EMPRESA) {
    m.set(a.href, a.nombre);
    for (const mod of a.modulos) m.set(mod.href, mod.nombre);
  }
  for (const p of PROYECTOS) {
    m.set(rutaProyecto(p.id), p.nombre);
    for (const a of areasDeProyecto(p.id)) {
      m.set(a.href, a.nombre);
      for (const mod of a.modulos) m.set(mod.href, mod.nombre);
    }
    for (const s of SECCIONES_DE_PROYECTO) m.set(rutaProyecto(p.id, s.sub), s.nombre);
  }
  return m;
}
const NOMBRES = nombres();

/** El camino hasta la página: Inicio › Lerma 439 › Comercial › Unidades (lo que no tiene nombre, "Detalle"). */
export function camino(ruta: string): { href: string; nombre: string }[] {
  const partes = ruta.split("/").filter(Boolean);
  const migas = [{ href: "/", nombre: "Inicio" }];
  partes.forEach((_, i) => {
    const href = `/${partes.slice(0, i + 1).join("/")}`;
    const nombre = NOMBRES.get(href);
    if (nombre) migas.push({ href, nombre });
    else if (i === partes.length - 1) migas.push({ href, nombre: "Detalle" });
  });
  return migas;
}

/** Arriba de cada página: la flecha para volver un nivel y el camino, con cada paso clickeable. */
export function Migas() {
  const ruta = usePathname();
  if (ruta === "/") return null;
  const migas = camino(ruta);
  const anterior = migas.at(-2);
  if (!anterior) return null;
  return (
    <nav className="migas solo-pantalla" aria-label="Estás en">
      <Link href={anterior.href} className="migas__volver" aria-label={`Volver a ${anterior.nombre}`} title={`Volver a ${anterior.nombre}`}>
        <Icono nombre="volver" size={16} />
      </Link>
      <ol>
        {migas.map((m, i) => (
          <li key={m.href}>
            {i < migas.length - 1 ? <Link href={m.href}>{m.nombre}</Link> : <span aria-current="page">{m.nombre}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
