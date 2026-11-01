"use client";

import { useCallback, useEffect, useState } from "react";
import type { IndicesCac } from "@/lib/inversores/pesos";
import type { CuentasCorrientes } from "@/lib/inversores/cuentas";
import { leerJson } from "../formato";

export interface RespuestaCuentas {
  cuentas: CuentasCorrientes;
  leido: string;
  /** Para mostrar las cuentas en pesos ajustados por CAC. Null si no se pudo leer. */
  cac?: IndicesCac | null;
  errorCac?: string | null;
}

/** Las cuentas corrientes desde la API, con "Actualizar" para volver a leer la planilla. */
export function useCuentas() {
  const [datos, setDatos] = useState<RespuestaCuentas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async (fresco = false) => {
    setCargando(true);
    try {
      setDatos(await leerJson<RespuestaCuentas>(await fetch(`/api/inversores/cuentas${fresco ? "?fresco=1" : ""}`)));
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

export const usd = (n: number | null) => (n == null ? "—" : `US$ ${Math.round(n).toLocaleString("es-AR")}`);
export const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toLocaleString("es-AR", { maximumFractionDigits: 0 })}%`);
export const fechaCorta = (f: string | null) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : "—");
