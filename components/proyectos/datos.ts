"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { DatosComercial } from "@/lib/finanzas/fuente";
import { PROYECTO_PRINCIPAL } from "@/lib/modulos";
import { leerJson } from "../formato";

export type RespuestaComercial = DatosComercial & { leido: string };

/** El id del proyecto en el que se está ("lerma-439"). */
export function useProyectoId(): string {
  return usePathname().match(/^\/proyectos\/([^/]+)/)?.[1] ?? PROYECTO_PRINCIPAL.id;
}

/** Unidades, lista, superficies y management del proyecto, con "Actualizar". */
export function useComercial() {
  const id = useProyectoId();
  const [datos, setDatos] = useState<RespuestaComercial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const cargar = useCallback(
    async (fresco = false) => {
      setCargando(true);
      try {
        setDatos(await leerJson<RespuestaComercial>(await fetch(`/api/proyectos/${id}/comercial${fresco ? "?fresco=1" : ""}`)));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setCargando(false);
      }
    },
    [id],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);
  return { datos, error, cargando, actualizar: () => cargar(true) };
}

export const usd = (n: number | null | undefined) => (n == null ? "—" : `US$ ${Math.round(n).toLocaleString("es-AR")}`);
export const m2 = (n: number | null | undefined, decimales = 2) => (n == null ? "—" : `${n.toLocaleString("es-AR", { maximumFractionDigits: decimales })} m²`);
export const pct = (n: number | null | undefined) => (n == null ? "—" : `${(n * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`);
