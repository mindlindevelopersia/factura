"use client";

import { usePathname } from "next/navigation";
import { PROYECTO_PRINCIPAL, rutaProyecto } from "@/lib/modulos";

/** La ruta del proyecto en el que se está ("/proyectos/lerma-439"), para armar links internos. */
export function useBaseProyecto(): string {
  const m = usePathname().match(/^\/proyectos\/([^/]+)/);
  return rutaProyecto(m?.[1] ?? PROYECTO_PRINCIPAL.id);
}
