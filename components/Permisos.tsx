"use client";

import { createContext, useContext, type ReactNode } from "react";
import { puedeRuta, type Acceso } from "@/lib/permisos/modelo";

const Contexto = createContext<Acceso | null>(null);

/** Lo que puede ver la persona, para esconder del menú y del buscador lo que no (el control de verdad está en el servidor). */
export function PermisosProvider({ acceso, children }: { acceso: Acceso | null; children: ReactNode }) {
  return <Contexto.Provider value={acceso}>{children}</Contexto.Provider>;
}

export const useAcceso = () => useContext(Contexto);

/** ¿Se muestra este link? Sin datos de permisos, se muestra (el servidor igual controla). */
export function usePuedeRuta(): (ruta: string) => boolean {
  const a = useContext(Contexto);
  return (ruta) => !a || puedeRuta(a, ruta);
}
