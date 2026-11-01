"use client";

import { useEffect, useRef, useState } from "react";
import { leerJson } from "./formato";

/**
 * El código de 6 números al ingresar. La primera vez, primero se da de alta la app (Google
 * Authenticator u otra): QR, o la clave a mano en el celular.
 */
export function Verificar({ email, tieneApp, destino }: { email: string; tieneApp: boolean; destino: string }) {
  const [alta, setAlta] = useState<{ qr: string; clave: string; link: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [recordar, setRecordar] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const pedido = useRef(false);

  useEffect(() => {
    if (tieneApp || pedido.current) return;
    pedido.current = true;
    void fetch("/api/tfa/alta", { method: "POST" })
      .then((r) => leerJson<{ qr?: string; clave?: string; link?: string; yaTiene?: boolean }>(r))
      .then((d) => (d.yaTiene ? window.location.reload() : setAlta({ qr: d.qr!, clave: d.clave!, link: d.link! })))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [tieneApp]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await leerJson(await fetch("/api/tfa/verificar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ codigo, recordar }) }));
      window.location.href = destino;
    } catch (x) {
      setError(x instanceof Error ? x.message : String(x));
      setCodigo("");
      setEnviando(false);
    }
  }

  return (
    <>
      {tieneApp ? (
        <>
          <h1>Poné tu código</h1>
          <p>
            Abrí Google Authenticator en el celular y escribí el código de 6 números de <strong>Hub Mindlin</strong>.
          </p>
        </>
      ) : (
        <>
          <h1>Activá la verificación</h1>
          <p>Es una sola vez. Con esto, aunque alguien tenga tu contraseña de Google, no puede entrar al hub sin tu celular.</p>
          <ol className="verificar__pasos">
            <li>
              Bajate <strong>Google Authenticator</strong> en el celular (App Store o Google Play).
            </li>
            <li>En la app tocá &quot;+&quot; y &quot;Escanear un código QR&quot;, y apuntá a este código:</li>
          </ol>
          {alta ? (
            <div className="verificar__qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={alta.qr} alt="Código QR para Google Authenticator" width={200} height={200} />
              <small>
                ¿Estás en el celular? <a href={alta.link}>Abrilo en la app</a>. O cargá la clave a mano: <code data-privado-no="">{alta.clave}</code>
              </small>
            </div>
          ) : (
            !error && <p>Preparando el código…</p>
          )}
          <ol className="verificar__pasos" start={3}>
            <li>Escribí el código de 6 números que te muestra la app.</li>
          </ol>
        </>
      )}
      <form className="verificar__form" onSubmit={(e) => void enviar(e)}>
        <input
          className="verificar__codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          placeholder="123 456"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          aria-label="Código de 6 números"
          autoFocus
          data-privado-no=""
        />
        <label className="verificar__recordar">
          <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} /> Recordar este navegador por 30 días
        </label>
        {error && (
          <p role="alert" className="alerta alerta--error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primario" disabled={enviando || codigo.replace(/\D/g, "").length !== 6 || (!tieneApp && !alta)}>
          {enviando ? "Verificando…" : "Verificar"}
        </button>
      </form>
      <p className="login__acceso">Ingresaste como {email}.</p>
    </>
  );
}
