"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fechaHora, leerJson } from "./formato";
import { Icono } from "./Icono";
import { Confirmacion } from "./Confirmacion";

interface Estado {
  configurado: boolean;
  bot?: string;
  activo?: boolean;
  webhook?: string | null;
  ultimoError?: string | null;
  conectados?: Cuenta[];
  linkConectar?: string;
  /** El link de conectar como QR (SVG). */
  qrConectar?: string;
}

interface Cuenta {
  id: number;
  usuario: string;
  conectado: string;
}

/** Mientras se ve el QR, cada cuánto se mira si ya se conectó la cuenta, y hasta cuándo. */
const ESPERA_CONEXION_MS = 4000;
const ESPERA_CONEXION_MAXIMA_MS = 10 * 60 * 1000;

/** En una compu (mouse, pantalla ancha) se muestra el QR; en el celular, el botón. */
const esCompu = () =>
  typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 641px)").matches;

/** Casi nadie tiene Telegram en la compu: el link de conectar, como QR para escanear con el celular. */
function Qr({ estado, texto }: { estado: Estado; texto: string }) {
  return (
    <div className="telegram__qr">
      {estado.qrConectar && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(estado.qrConectar)}`}
          alt="Código QR para conectar Telegram"
          width={184}
          height={184}
        />
      )}
      <div>
        <p>
          <strong>{texto}</strong>
        </p>
        <ol className="telegram__pasos">
          <li>Abrí la cámara del celular y apuntá al código.</li>
          <li>Tocá el link: se abre el bot en Telegram.</li>
          <li>Tocá &quot;Iniciar&quot;. Acá aparece conectado solo.</li>
        </ol>
        <p className="factura__nota">
          El código dura una hora y se renueva solo.{" "}
          <a href={estado.linkConectar} target="_blank" rel="noreferrer">
            ¿Tenés Telegram en esta compu? Abrilo acá
          </a>
          .
        </p>
      </div>
    </div>
  );
}

/** Mandar facturas por Telegram: activar el bot (una vez) y conectar la cuenta de cada persona. */
export function TelegramPanel() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activando, setActivando] = useState(false);
  const [desconectando, setDesconectando] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const conocidas = useRef<Set<number> | null>(null);
  const [confirmar, setConfirmar] = useState<{
    id: number;
    usuario: string;
  } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const nuevo = await leerJson<Estado>(await fetch("/api/telegram", { cache: "no-store" }));
      conocidas.current = new Set((nuevo.conectados ?? []).map((c) => c.id));
      setEstado(nuevo);
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

  // Con el QR a la vista en la compu, se avisa apenas la persona toca "Iniciar" en el celular.
  const listo = estado?.configurado === true && estado.activo === true;
  useEffect(() => {
    if (!listo || !esCompu()) return;
    const hasta = Date.now() + ESPERA_CONEXION_MAXIMA_MS;
    const intervalo = setInterval(async () => {
      if (Date.now() > hasta) return clearInterval(intervalo);
      if (document.visibilityState !== "visible") return;
      try {
        const { conectados } = await leerJson<{ conectados: Cuenta[] }>(
          await fetch("/api/telegram?solo=cuentas", { cache: "no-store" }),
        );
        const nueva = conectados.find((c) => !conocidas.current?.has(c.id));
        if (nueva) {
          setAviso(`Listo: ${nueva.usuario} quedó conectado. Ya podés mandarle facturas al bot.`);
          await cargar();
        }
      } catch {
        // Se vuelve a probar en el próximo intervalo.
      }
    }, ESPERA_CONEXION_MS);
    return () => clearInterval(intervalo);
  }, [listo, cargar]);

  async function desconectar(id: number) {
    setConfirmar(null);
    setDesconectando(id);
    setError(null);
    try {
      await leerJson(
        await fetch("/api/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ desconectar: id }),
        }),
      );
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDesconectando(null);
    }
  }

  async function activar() {
    setActivando(true);
    setError(null);
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
      <h2>
        <Icono nombre="telegram" />
        También podés enviar por Telegram
      </h2>
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
      {!estado && !error && <p className="carga__resumen">Cargando…</p>}
      {estado && !estado.configurado && (
        <p>
          Telegram todavía no está conectado. Pedile al administrador que revise
          las conexiones de la app.
        </p>
      )}
      {estado?.configurado && (
        <>
          <p>
            Mandale las facturas en PDF o como foto a{" "}
            <a
              href={`https://t.me/${estado.bot}`}
              target="_blank"
              rel="noreferrer"
            >
              @{estado.bot}
            </a>
            . Quedan acá, en la bandeja. Sobre tu mensaje el bot marca en qué
            quedó cada una: 👀 recibida, 👌 lista para revisar, 🤔 necesita
            atención, 👍 cargada en la planilla. Además te escribe cuando la lee
            y cuando se carga.
          </p>
          {!estado.activo && (
            <div className="alerta alerta--aviso telegram__activar">
              <span>
                El bot todavía no está recibiendo comprobantes en esta app.
                Activá la conexión para empezar.
              </span>
              <button
                type="button"
                className="btn btn--primario btn--chico"
                disabled={activando}
                onClick={activar}
              >
                {activando ? "Activando…" : "Activar bot"}
              </button>
            </div>
          )}
          {estado.activo && estado.ultimoError && (
            <p className="factura__nota">
              Último error de Telegram: {estado.ultimoError}
            </p>
          )}
          {(estado.conectados?.length ?? 0) > 0 && (
            <ul className="telegram__cuentas">
              {estado.conectados!.map((c) => (
                <li key={c.id}>
                  <span>
                    Conectado: <strong>{c.usuario}</strong>
                    {c.conectado && (
                      <span className="factura__nota">
                        {" "}
                        · desde {fechaHora(c.conectado)}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="btn btn--borde btn--chico"
                    disabled={desconectando !== null}
                    onClick={() =>
                      setConfirmar({ id: c.id, usuario: c.usuario })
                    }
                  >
                    {desconectando === c.id ? "Desconectando…" : "Desconectar"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {/* En la compu: el QR para escanear con el celular. */}
          <div className="solo-compu">
            {(estado.conectados?.length ?? 0) === 0 ? (
              <Qr estado={estado} texto="Conectá tu Telegram: escaneá este código con el celular" />
            ) : (
              <details className="telegram__otro">
                <summary>Conectar otro Telegram</summary>
                <Qr estado={estado} texto="Escaneá este código con el celular que querés conectar" />
              </details>
            )}
          </div>
          {/* En el celular: el botón abre Telegram directo. */}
          <p className="solo-celular">
            <a
              className="btn btn--primario"
              href={estado.linkConectar}
              target="_blank"
              rel="noreferrer"
            >
              {estado.conectados?.length
                ? "Conectar otro Telegram"
                : "Conectar mi Telegram"}
            </a>
            <span className="factura__nota">
              Se abre Telegram: tocá &quot;Iniciar&quot; y queda conectado a tu
              mail. El link dura una hora.
            </span>
          </p>
        </>
      )}
      {confirmar && (
        <Confirmacion
          titulo="¿Desconectar este Telegram?"
          confirmar="Desconectar"
          peligro
          onCancelar={() => setConfirmar(null)}
          onConfirmar={() => void desconectar(confirmar.id)}
        >
          <p>
            <strong>{confirmar.usuario}</strong> dejará de poder enviar
            comprobantes. Podés volver a conectarlo desde esta pantalla.
          </p>
        </Confirmacion>
      )}
    </div>
  );
}
