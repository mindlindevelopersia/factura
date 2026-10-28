"use client";

import { useEffect, useState } from "react";
import { leerJson } from "./formato";

interface Chequeo {
  titulo: string;
  ok: boolean;
  detalle: string;
}

const GUIA = "https://github.com/mindlindevelopersia/factura/blob/main/docs/puesta-en-marcha.md";

/** Qué está configurado y qué falta. Aparece sola cuando la cola no está lista. */
export function EstadoConfiguracion() {
  const [estado, setEstado] = useState<{ listo: boolean; chequeos: Chequeo[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/estado", { cache: "no-store" })
      .then((r) => leerJson<{ listo: boolean; chequeos: Chequeo[] }>(r))
      .then(setEstado)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="card estado-config">
      <h2>Estado de la configuración</h2>
      {error && <p className="alerta alerta--error">{error}</p>}
      {!estado && !error && <p className="carga__resumen">Revisando…</p>}
      {estado && (
        <>
          <p>
            {estado.listo
              ? "Todo lo necesario está configurado."
              : "Falta configurar algo para que la app pueda recibir facturas. Los pasos están en la "}
            {!estado.listo && (
              <a href={GUIA} target="_blank" rel="noreferrer">
                guía de puesta en marcha
              </a>
            )}
            {!estado.listo && "."}
          </p>
          <ul className="estado-config__lista">
            {estado.chequeos.map((c) => (
              <li key={c.titulo} className={c.ok ? "estado-config__ok" : "estado-config__falta"}>
                <span aria-hidden="true">{c.ok ? "✓" : "✗"}</span>
                <div>
                  <strong>{c.titulo}</strong>
                  <span className="estado-config__detalle">{c.detalle}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
