"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { nombreMes, type Moneda } from "@/lib/finanzas/ingresos";
import { CANALES_AVISO, ESTADOS_AVISO, ultimoPorCuenta, type AvisoCobranza } from "@/lib/inversores/avisos";
import type { Cobranza, ItemCobranza, totalesCobranzas } from "@/lib/inversores/cobranzas";
import { fechaHora, leerJson } from "../formato";
import { Icono } from "../Icono";
import { useBaseProyecto } from "../proyecto";
import { BarraLectura, monto, redondo } from "../finanzas/comun";
import { fechaCorta } from "./datos";

interface Respuesta {
  cobranzas: Cobranza[];
  totales: ReturnType<typeof totalesCobranzas>;
  hoy: string;
  cacUltimo: string | null;
  errorCac: string | null;
  leido: string;
}

type Vista = "vencidos" | "esteMes" | "proximoMes" | "seguimiento";

/** Cobranzas: vencidos actualizados por CAC, lo que vence este mes y el próximo, avisos y seguimiento. */
export function Cobranzas() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [avisos, setAvisos] = useState<AvisoCobranza[] | null>(null);
  const [errorRegistro, setErrorRegistro] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("vencidos");

  const cargar = useCallback(async (fresco = false) => {
    setCargando(true);
    try {
      setDatos(await leerJson<Respuesta>(await fetch(`/api/inversores/cobranzas${fresco ? "?fresco=1" : ""}`)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, []);
  const cargarAvisos = useCallback(async () => {
    try {
      setAvisos((await leerJson<{ avisos: AvisoCobranza[] }>(await fetch("/api/inversores/cobranzas/avisos"))).avisos);
      setErrorRegistro(null);
    } catch (e) {
      setErrorRegistro(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void cargar();
    void cargarAvisos();
  }, [cargar, cargarAvisos]);

  const registrar = useCallback(
    async (aviso: Partial<AvisoCobranza>) => {
      const r = await leerJson<{ aviso: AvisoCobranza }>(
        await fetch("/api/inversores/cobranzas/avisos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(aviso) }),
      );
      setAvisos((a) => [r.aviso, ...(a ?? [])]);
    },
    [],
  );

  const ultimos = useMemo(() => ultimoPorCuenta(avisos ?? []), [avisos]);
  const lista = datos ? datos.cobranzas.filter((c) => (vista === "seguimiento" ? false : c[vista].length > 0)) : [];
  const t = datos?.totales;
  const cantidad = (v: Exclude<Vista, "seguimiento">) => datos?.cobranzas.filter((c) => c[v].length > 0).length ?? 0;

  return (
    <div className="ingresos">
      <BarraLectura
        leido={datos?.leido ?? null}
        cargando={cargando}
        actualizar={() => {
          void cargar(true);
          void cargarAvisos();
        }}
      />
      {error && (
        <p role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" size={18} />
          <span>{error}</span>
        </p>
      )}
      {datos?.errorCac && (
        <p role="alert" className="alerta alerta--aviso">
          <Icono nombre="alerta" size={18} />
          <span>Los montos no están actualizados por CAC: {datos.errorCac}</span>
        </p>
      )}
      {datos && t && (
        <>
          <div className="ingresos__cifras cuentas__cifras">
            <div className="cifra cifra--destacada">
              <span className="cifra__titulo">Vencido, actualizado a hoy</span>
              <span className="cifra__valor">{totalTexto(t.vencido)}</span>
              <span className="cifra__nota">{t.cuentasConVencidos} cuentas con vencidos</span>
            </div>
            <div className="cifra">
              <span className="cifra__titulo">Vence este mes</span>
              <span className="cifra__valor">{totalTexto(t.esteMes)}</span>
              <span className="cifra__nota">Todavía no venció</span>
            </div>
            <div className="cifra">
              <span className="cifra__titulo">Vence el mes próximo</span>
              <span className="cifra__valor">{totalTexto(t.proximoMes)}</span>
            </div>
            <div className="cifra">
              <span className="cifra__titulo">Para verificar antes de avisar</span>
              <span className="cifra__valor">{t.paraVerificar}</span>
              <span className="cifra__nota">cuentas</span>
            </div>
          </div>
          <p className="cobranzas__nota">
            Hoy es {fechaCorta(datos.hoy)}. Las cuotas vencen el día 10 de cada mes (las de Marcelo Martín, el 20). Los vencidos se actualizan con el último CAC publicado
            {datos.cacUltimo ? ` (${nombreMes(datos.cacUltimo).toLowerCase()})` : ""}. El mensaje al inversor lleva solo lo formal.
          </p>

          <div className="ingresos__atajos cobranzas__vistas" role="tablist">
            {(
              [
                ["vencidos", `Vencidos (${cantidad("vencidos")})`],
                ["esteMes", `Vencen este mes (${cantidad("esteMes")})`],
                ["proximoMes", `Mes próximo (${cantidad("proximoMes")})`],
                ["seguimiento", `Seguimiento${avisos ? ` (${avisos.length})` : ""}`],
              ] as const
            ).map(([id, texto]) => (
              <button key={id} type="button" role="tab" aria-selected={vista === id} className={`btn btn--chico ${vista === id ? "btn--primario" : "btn--borde"}`} onClick={() => setVista(id)}>
                {texto}
              </button>
            ))}
          </div>

          {errorRegistro && (
            <p className="alerta alerta--info">
              <Icono nombre="alerta" size={18} />
              <span>{errorRegistro} Se puede avisar igual, pero no queda anotado.</span>
            </p>
          )}

          {vista === "seguimiento" ? (
            <Seguimiento avisos={avisos} />
          ) : lista.length === 0 ? (
            <p className="card ingresos__vacio">No hay nada en esta lista.</p>
          ) : (
            <div className="cobranzas__lista">
              {lista.map((c) => (
                <TarjetaCobranza key={c.id} c={c} items={c[vista]} vista={vista} ultimo={ultimos.get(c.id) ?? null} registrar={errorRegistro ? null : registrar} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function totalTexto(t: Record<Moneda, number>): string {
  return [t.ARS || !t.USD ? redondo(t.ARS, "ARS") : null, t.USD ? redondo(t.USD, "USD") : null].filter(Boolean).join(" + ");
}

function TarjetaCobranza({
  c,
  items,
  vista,
  ultimo,
  registrar,
}: {
  c: Cobranza;
  items: ItemCobranza[];
  vista: Exclude<Vista, "seguimiento">;
  ultimo: AvisoCobranza | null;
  registrar: ((a: Partial<AvisoCobranza>) => Promise<void>) | null;
}) {
  const [verificado, setVerificado] = useState(false);
  const base = useBaseProyecto();
  const [formulario, setFormulario] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bloqueado = c.verificar.length > 0 && !verificado;
  const total = (m: Moneda) => items.filter((i) => i.pago.moneda === m).reduce((s, i) => s + (i.actualizado ?? i.pago.monto), 0);
  const montoAviso = totalTexto({ ARS: c.totalVencidoFormal.ARS, USD: c.totalVencidoFormal.USD });

  const whatsapp = async () => {
    if (!c.whatsapp) return;
    window.open(c.whatsapp, "_blank", "noopener");
    if (registrar) {
      await registrar({ cuenta: c.id, inversor: c.inversor, unidad: c.unidad, canal: "WhatsApp", estado: "Avisado", monto: montoAviso, nota: "Se abrió WhatsApp con el mensaje." }).catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
    }
  };
  const copiar = async () => {
    if (!c.mensaje) return;
    await navigator.clipboard.writeText(c.mensaje);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <article className={`card cobranza${c.verificar.length ? " cobranza--verificar" : ""}`}>
      <header className="cobranza__cabecera">
        <div>
          <h2>
            <Link href={`${base}/inversores/cuentas-corrientes/${c.id}`} className="ingresos__enlace">
              {c.inversor}
            </Link>
          </h2>
          <span className="tabla__sub">
            UF {c.unidad} · vence el día {c.dia}
            {c.telefono ? ` · ${c.telefono}` : " · sin teléfono"}
          </span>
        </div>
        <div className="cobranza__total">
          <strong>{totalTexto({ ARS: total("ARS"), USD: total("USD") })}</strong>
          {vista === "vencidos" && items[0] && <span className="ingresos__vencido">hace {items[0].diasVencido} días</span>}
        </div>
      </header>

      {ultimo && (
        <p className="cobranza__ultimo">
          <Icono nombre="reloj" size={14} /> Último aviso: <strong>{ultimo.estado}</strong> por {ultimo.canal.toLowerCase()} el {fechaHora(ultimo.fecha)} ({ultimo.usuario})
          {ultimo.nota && ` · ${ultimo.nota}`}
        </p>
      )}

      {c.verificar.length > 0 && (
        <div className="alerta alerta--aviso cobranza__verificar">
          <Icono nombre="alerta" size={18} />
          <div>
            <strong>Verificar antes de avisar</strong>
            <ul>
              {c.verificar.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
            {c.pagosPosteriores.length > 0 && (
              <p>
                Pagos registrados:{" "}
                {c.pagosPosteriores.map((p) => `${fechaCorta(p.fecha)} ${p.concepto || "pago"} ${monto(p.monto, p.moneda)} (${p.formal ? "formal" : "informal"})`).join(" · ")}
              </p>
            )}
            <label className="cuentas__check">
              <input type="checkbox" checked={verificado} onChange={(e) => setVerificado(e.target.checked)} />
              Ya lo verifiqué: corresponde avisar
            </label>
          </div>
        </div>
      )}

      <div className="tabla-contenedor">
        <table className="tabla">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Vence</th>
              <th className="tabla__numero">Según el Flujo</th>
              <th className="tabla__numero">{vista === "vencidos" ? "Actualizado a hoy" : "A pagar"}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.pago.celda}>
                <td data-etiqueta="Concepto">
                  {i.pago.detalle} {nombreMes(i.pago.mes!).toLowerCase()}
                  <span className="tabla__sub">{i.formal ? "Formal" : "Informal (no va en el mensaje)"}</span>
                </td>
                <td data-etiqueta="Vence">
                  {fechaCorta(i.vence)}
                  {i.vencido && <span className="tabla__sub ingresos__vencido">hace {i.diasVencido} días</span>}
                </td>
                <td data-etiqueta="Según el Flujo" className="tabla__numero">
                  {monto(i.pago.monto, i.pago.moneda)}
                </td>
                <td data-etiqueta={vista === "vencidos" ? "Actualizado a hoy" : "A pagar"} className="tabla__numero">
                  <strong>{i.actualizado != null ? monto(i.actualizado, i.pago.moneda) : "—"}</strong>
                  <span className="tabla__sub" title={i.calculo}>
                    {i.calculo}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {c.mensaje && (
        <details className="cobranza__mensaje">
          <summary>Ver el mensaje</summary>
          <pre>{c.mensaje}</pre>
        </details>
      )}

      {error && <p className="alerta alerta--error">{error}</p>}

      <div className="cobranza__acciones">
        {c.whatsapp ? (
          <button type="button" className="btn btn--primario btn--chico" onClick={whatsapp} disabled={bloqueado} title={bloqueado ? "Primero verificá lo de arriba" : undefined}>
            <Icono nombre="mensaje" size={16} />
            Avisar por WhatsApp
          </button>
        ) : (
          <span className="tabla__sub">{!c.mensaje ? "Solo hay montos informales: avisar por otra vía." : "Sin teléfono para WhatsApp."}</span>
        )}
        {c.mensaje && (
          <button type="button" className="btn btn--borde btn--chico" onClick={copiar} disabled={bloqueado}>
            <Icono nombre={copiado ? "check" : "archivo"} size={16} />
            {copiado ? "Copiado" : "Copiar mensaje"}
          </button>
        )}
        {registrar && (
          <button type="button" className="btn btn--texto btn--chico" onClick={() => setFormulario((f) => !f)}>
            Anotar respuesta o aviso
          </button>
        )}
      </div>

      {formulario && registrar && (
        <FormularioAviso
          enviar={async (a) => {
            await registrar({ cuenta: c.id, inversor: c.inversor, unidad: c.unidad, monto: montoAviso, ...a });
            setFormulario(false);
          }}
        />
      )}
    </article>
  );
}

function FormularioAviso({ enviar }: { enviar: (a: Pick<AvisoCobranza, "estado" | "canal" | "nota">) => Promise<void> }) {
  const [estado, setEstado] = useState<string>("Prometió pagar");
  const [canal, setCanal] = useState<string>("WhatsApp");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="cobranza__formulario"
      onSubmit={async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
          await enviar({ estado, canal, nota });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setGuardando(false);
        }
      }}
    >
      <label className="campo campo--filtro">
        Qué pasó
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          {ESTADOS_AVISO.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="campo campo--filtro">
        Por dónde
        <select value={canal} onChange={(e) => setCanal(e.target.value)}>
          {CANALES_AVISO.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="campo campo--filtro cobranza__nota">
        Nota
        <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} placeholder="Ej.: paga el viernes" />
      </label>
      <button type="submit" className="btn btn--primario btn--chico" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar"}
      </button>
      {error && <p className="alerta alerta--error">{error}</p>}
    </form>
  );
}

function Seguimiento({ avisos }: { avisos: AvisoCobranza[] | null }) {
  const [buscar, setBuscar] = useState("");
  if (!avisos) return <p className="card ingresos__vacio">El registro de avisos no está disponible.</p>;
  const q = buscar.toLowerCase().trim();
  const filtrados = avisos.filter((a) => !q || `${a.inversor} ${a.unidad} ${a.estado}`.toLowerCase().includes(q));
  return (
    <section className="card ingresos__seccion">
      <div className="ingresos__titulo cuentas__controles">
        <h2>Seguimiento de avisos ({filtrados.length})</h2>
        <label className="campo campo--filtro">
          <span className="sr-only">Buscar</span>
          <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar inversor o estado" />
        </label>
      </div>
      {filtrados.length === 0 ? (
        <p className="ficha__vacio">Todavía no hay avisos anotados.</p>
      ) : (
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th>Inversor</th>
                <th>Fecha</th>
                <th>Qué pasó</th>
                <th>Quién</th>
                <th className="tabla__numero">Monto avisado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((a, i) => (
                <tr key={`${a.fecha}-${i}`}>
                  <td data-etiqueta="Inversor">
                    {a.inversor}
                    <span className="tabla__sub">UF {a.unidad}</span>
                  </td>
                  <td data-etiqueta="Fecha">{fechaHora(a.fecha)}</td>
                  <td data-etiqueta="Qué pasó">
                    {a.estado} · {a.canal}
                    {a.nota && <span className="tabla__sub">{a.nota}</span>}
                  </td>
                  <td data-etiqueta="Quién">{a.usuario}</td>
                  <td data-etiqueta="Monto avisado" className="tabla__numero">
                    {a.monto || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
