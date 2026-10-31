"use client";

import { useCallback, useEffect, useState } from "react";
import type { DolarHoy as Datos } from "@/lib/finanzas/fuente";
import { brecha, type Cotizacion } from "@/lib/indicadores/dolar";
import { leerJson } from "../formato";
import { Icono } from "../Icono";

export type RespuestaDolar = Datos & { leido: string };

/** El dólar de hoy, con "Actualizar". */
export function useDolarHoy() {
  const [datos, setDatos] = useState<RespuestaDolar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const cargar = useCallback(async (fresco = false) => {
    setCargando(true);
    try {
      setDatos(await leerJson<RespuestaDolar>(await fetch(`/api/indicadores/dolar${fresco ? "?fresco=1" : ""}`)));
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
  const de = (casa: Cotizacion["casa"]) => datos?.cotizaciones.find((c) => c.casa === casa);
  return { datos, error, cargando, actualizar: () => cargar(true), de };
}

const pesos = (n: number | null) => (n == null ? "—" : `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`);
const cuando = (iso: string | null) => {
  if (!iso) return null;
  const solo = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = new Date(solo ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleString("es-AR", solo ? { day: "2-digit", month: "2-digit" } : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" });
};

/** Oficial, blue y MEP de hoy: compra y venta, cuándo se actualizó y la brecha contra el oficial. */
export function DolarHoy() {
  const { datos, error, cargando, actualizar, de } = useDolarHoy();
  const oficial = de("oficial");
  return (
    <section className="dolar" aria-label="El dólar hoy">
      <div className="dolar__titulo">
        <h2 className="cac__titulo-seccion">El dólar hoy</h2>
        <button type="button" className="btn btn--texto btn--chico" onClick={actualizar} disabled={cargando}>
          <Icono nombre="recargar" size={14} />
          {cargando ? "Leyendo…" : "Actualizar"}
        </button>
      </div>
      {error && !datos && (
        <p role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" size={18} />
          <span>{error}</span>
        </p>
      )}
      <div className="dolar__tarjetas">
        {(datos?.cotizaciones ?? []).map((c) => {
          const b = c.casa === "oficial" ? null : brecha(c, oficial);
          return (
            <div key={c.casa} className={`dolar__tarjeta dolar__tarjeta--${c.casa}`}>
              <span className="dolar__nombre">{c.nombre}</span>
              <div className="dolar__precios">
                <div>
                  <span>Compra</span>
                  <strong>{pesos(c.compra)}</strong>
                </div>
                <div>
                  <span>Venta</span>
                  <strong className="dolar__venta">{pesos(c.venta)}</strong>
                </div>
              </div>
              <span className="dolar__nota">
                {b != null && `Brecha ${b >= 0 ? "+" : ""}${(b * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}% · `}
                {cuando(c.fecha) ? `al ${cuando(c.fecha)}` : "sin fecha"} · {c.fuente}
              </span>
            </div>
          );
        })}
        {!datos && !error && <p className="dolar__cargando">Leyendo el dólar…</p>}
      </div>
    </section>
  );
}
