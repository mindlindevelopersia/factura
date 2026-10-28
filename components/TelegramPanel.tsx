"use client";

import { useCallback, useEffect, useState } from "react";
import { leerJson } from "./formato";

interface Estado {
  configurado: boolean;
  bot?: string;
  activo?: boolean;
  webhook?: string | null;
  ultimoError?: string | null;
  conectadoComo?: string | null;
  linkConectar?: string;
}

/** Mandar facturas por Telegram: activar el bot (una vez) y conectar la cuenta de cada persona. */
export function TelegramPanel() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activando, setActivando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setEstado(await leerJson<Estado>(await fetch("/api/telegram", { cache: "no-store" })));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function activar() {
    setActivando(true);
    try {
      await leerJson(await fetch("/api/telegram", { method: "POST" }));
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActivando(false);
    }
  }

  return (
    <div className="card telegram">
      <h2>Por Telegram</h2>
      {error && <p className="alerta alerta--error">{error}</p>}
      {!estado && !error && <p className="carga__resumen">Cargando…</p>}
      {estado && !estado.configurado && <p>El bot no está configurado: falta TELEGRAM_API_KEY en el servidor.</p>}
      {estado?.configurado && (
        <>
          <p>
            Mandale las facturas en PDF o como foto a{" "}
            <a href={`https://t.me/${estado.bot}`} target="_blank" rel="noreferrer">
              @{estado.bot}
            </a>
            . Quedan acá, en &quot;Para revisar&quot;, y el bot te avisa cuando las lee y cuando se cargan.
          </p>
          {!estado.activo && (
            <div className="alerta alerta--aviso telegram__activar">
              <span>
                El bot no está recibiendo mensajes en esta app{estado.webhook ? ` (apunta a ${estado.webhook})` : ""}. Activalo una
                vez, desde la dirección de producción.
              </span>
              <button type="button" className="btn btn--primario btn--chico" disabled={activando} onClick={activar}>
                {activando ? "Activando…" : "Activar bot"}
              </button>
            </div>
          )}
          {estado.activo && estado.ultimoError && <p className="factura__nota">Último error de Telegram: {estado.ultimoError}</p>}
          {estado.conectadoComo ? (
            <p className="alerta alerta--ok">Tu Telegram está conectado ({estado.conectadoComo}).</p>
          ) : (
            <p>
              <a className="btn btn--borde" href={estado.linkConectar} target="_blank" rel="noreferrer">
                Conectar mi Telegram
              </a>{" "}
              <span className="factura__nota">Abre el bot: tocá &quot;Iniciar&quot; y queda conectado a tu mail.</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
