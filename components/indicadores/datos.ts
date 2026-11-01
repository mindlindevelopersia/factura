"use client";

import { useCallback, useEffect, useState } from "react";
import type { Panorama } from "@/lib/finanzas/fuente";
import type { Resumen, Senal } from "@/lib/indicadores/materiales";
import { leerJson } from "../formato";

export type RespuestaPanorama = Panorama & { leido: string };

/** Los datos del Panorama y de Materiales, con "Actualizar". */
export function usePanorama() {
  const [datos, setDatos] = useState<RespuestaPanorama | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const cargar = useCallback(async (fresco = false) => {
    setCargando(true);
    try {
      setDatos(await leerJson<RespuestaPanorama>(await fetch(`/api/indicadores/panorama${fresco ? "?fresco=1" : ""}`)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  return { datos, error, cargando, actualizar: () => cargar(true) };
}

/** Un color fijo por serie: el color sigue a la serie, no a su posición. */
export const COLOR_SERIE: Record<string, string> = {
  cac: "#006dbb",
  ipc: "#eb6834",
  blue: "#1baf7a",
  oficial: "#eda100",
  "insumo-142001": "#e87ba4",
  "insumo-4001": "#008300",
  "cac-materiales": "#6250d6",
  "cac-mano": "#e34948",
};

export const pctSigno = (n: number | null, decimales = 1) =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${(n * 100).toLocaleString("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}%`;

export const CLASE_SENAL: Record<Resumen, string> = { comprar: "senal--comprar", normal: "senal--normal", esperar: "senal--esperar", depende: "senal--depende" };
export const TEXTO_CORTO: Record<Senal, string> = { comprar: "Barato", normal: "Normal", esperar: "Caro" };
