"use client";

import { useCallback, useEffect, useState } from "react";
import { fechaHora, leerJson } from "./formato";

interface Estado {
  configurado: boolean;
  bot?: string;
  activo?: boolean;
  webhook?: string | null;
  ultimoError?: string | null;
  conectados?: { id: number; usuario: string; conectado: string }[];
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
    // El link de "Conectar" vence a la hora: se renueva solo si la página queda abierta.
    const intervalo = setInterval(() => void cargar(), 20 * 60 * 1000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  async function desconectar(id: number, usuario: string) {
    if (!window.confirm(`¿Desconectar ${usuario}? Ese Telegram ya no va a poder mandar facturas.`)) return;
    try {
      await leerJson(
        await fetch("/api/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ desconectar: id }) }),
      );
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

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
          {(estado.conectados?.length ?? 0) > 0 && (
            <ul className="telegram__cuentas">
              {estado.conectados!.map((c) => (
                <li key={c.id}>
                  <span>
                    Conectado: <strong>{c.usuario}</strong>
                    {c.conectado && <span className="factura__nota"> · desde {fechaHora(c.conectado)}</span>}
                  </span>
                  <button type="button" className="btn btn--borde btn--chico" onClick={() => desconectar(c.id, c.usuario)}>
                    Desconectar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p>
            <a className="btn btn--borde" href={estado.linkConectar} target="_blank" rel="noreferrer">
              {estado.conectados?.length ? "Conectar otro Telegram" : "Conectar mi Telegram"}
            </a>{" "}
            <span className="factura__nota">
              Abrilo desde el teléfono con el Telegram que quieras conectar y tocá &quot;Iniciar&quot;. Queda conectado a tu mail. El
              link dura una hora.
            </span>
          </p>
        </>
      )}
    </div>
  );
}
