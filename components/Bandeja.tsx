"use client";

import { useCallback, useEffect, useState } from "react";
import type { ItemCola } from "@/lib/cola/item";
import type { Pendiente } from "@/lib/cola/servicio";
import { FichaRevision } from "./FichaRevision";
import { leerJson } from "./formato";
import { Historial } from "./Historial";
import { Subir } from "./Subir";
import { TelegramPanel } from "./TelegramPanel";

type Vista = "revisar" | "subir" | "historial";

/** Cada cuánto se busca si llegaron comprobantes nuevos (por Telegram, o de otra persona). */
const REFRESCO_MS = 20_000;

/**
 * La pantalla principal: lo que espera revisión (venga de la web o de Telegram), la carga de
 * archivos y el historial de lo aprobado y descartado.
 */
export function Bandeja({ revisar }: { revisar?: string }) {
  const [datos, setDatos] = useState<{ pendientes: Pendiente[]; historial: ItemCola[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("revisar");

  const cargar = useCallback(async () => {
    try {
      setDatos(await leerJson(await fetch("/api/cola", { cache: "no-store" })));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void cargar();
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") void cargar();
    }, REFRESCO_MS);
    return () => clearInterval(intervalo);
  }, [cargar]);

  const pendientes = datos?.pendientes ?? [];
  const pestanias: { vista: Vista; texto: string }[] = [
    { vista: "revisar", texto: `Para revisar${datos ? ` (${pendientes.length})` : ""}` },
    { vista: "subir", texto: "Subir" },
    { vista: "historial", texto: "Historial" },
  ];

  return (
    <div className="bandeja">
      <nav className="pestanias" aria-label="Secciones">
        {pestanias.map((p) => (
          <button
            key={p.vista}
            type="button"
            className={`pestania${vista === p.vista ? " pestania--activa" : ""}`}
            aria-current={vista === p.vista ? "page" : undefined}
            onClick={() => setVista(p.vista)}
          >
            {p.texto}
          </button>
        ))}
      </nav>

      {error && (
        <p role="alert" className="alerta alerta--error">
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className="alerta alerta--ok">
          {aviso}
        </p>
      )}

      {vista === "revisar" && (
        <section aria-label="Para revisar">
          {!datos && !error && <p className="carga__resumen">Cargando…</p>}
          {datos && pendientes.length === 0 && (
            <div className="card vacio">
              <p>No hay comprobantes para revisar.</p>
              <button type="button" className="btn btn--primario" onClick={() => setVista("subir")}>
                Subir facturas
              </button>
            </div>
          )}
          {pendientes.map((item) => (
            <FichaRevision
              key={item.id}
              item={item}
              resaltar={item.id === revisar}
              onResuelto={(mensaje) => {
                setAviso(mensaje);
                void cargar();
              }}
            />
          ))}
        </section>
      )}

      {vista === "subir" && (
        <section aria-label="Subir">
          <Subir
            onSubida={() => void cargar()}
            onIrARevisar={() => {
              setAviso(null);
              setVista("revisar");
            }}
          />
          <TelegramPanel />
        </section>
      )}

      {vista === "historial" && (
        <section aria-label="Historial">
          <Historial items={datos?.historial ?? []} />
        </section>
      )}
    </div>
  );
}
