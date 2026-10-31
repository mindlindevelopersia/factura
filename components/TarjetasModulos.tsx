import Link from "next/link";
import type { Area, Modulo } from "@/lib/modulos";
import { EtiquetaBeta } from "./Beta";
import { Icono } from "./Icono";

/** Tarjetas para entrar a un área o a un módulo, en el inicio y en la página de cada área. */
export function TarjetasModulos({ items }: { items: (Area | Modulo)[] }) {
  return (
    <ul className="tarjetas-modulos">
      {items.map((item) => {
        const pronto = "modulos" in item && item.modulos.length === 0;
        return (
          <li key={item.href}>
            <Link href={item.href} className="tarjeta-modulo">
              {"icono" in item && (
                <span className="tarjeta-modulo__icono">
                  <Icono nombre={item.icono} size={22} />
                </span>
              )}
              <span className="tarjeta-modulo__texto">
                <strong>
                  {item.nombre}
                  {pronto && <span className="navegacion__pronto">Próximamente</span>}
                  {"beta" in item && item.beta && <EtiquetaBeta />}
                </strong>
                <span>{item.descripcion}</span>
                {"modulos" in item && item.modulos.length > 0 && (
                  <span className="tarjeta-modulo__lista">{item.modulos.map((m) => m.nombre).join(" · ")}</span>
                )}
              </span>
              <Icono nombre="flecha" size={18} className="tarjeta-modulo__flecha" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
