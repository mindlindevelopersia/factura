"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CATEGORIAS_AGENDA, semanasDelMes, TIPOS_EVENTO, type Evento, type TipoEvento } from "@/lib/calendario/eventos";
import { nombreMes, sumarMeses } from "@/lib/finanzas/ingresos";
import { leerJson } from "../formato";
import { Icono } from "../Icono";
import { useBaseProyecto } from "../proyecto";
import { useProyectoId } from "./datos";

interface Datos {
  eventos: Evento[];
  faltan: { tipo: TipoEvento; error: string }[];
  hoy: string;
}

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const monto = (e: Evento) => (e.monto ? `${e.monto.moneda === "USD" ? "US$" : "$"} ${Math.round(e.monto.valor).toLocaleString("es-AR")}` : "");
const nombreTipo = (t: TipoEvento) => TIPOS_EVENTO.find((x) => x.tipo === t)!.nombre;
const fechaLarga = (f: string) => {
  const d = new Date(`${f}T12:00:00Z`);
  const s = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d);
  return s[0].toUpperCase() + s.slice(1);
};

/** Totales por moneda de una lista de eventos ("$ 12.000.000 + US$ 5.000"). */
function totales(eventos: Evento[]): string {
  const t = { ARS: 0, USD: 0 };
  for (const e of eventos) if (e.monto) t[e.monto.moneda] += e.monto.valor;
  return [t.ARS ? `$ ${Math.round(t.ARS).toLocaleString("es-AR")}` : "", t.USD ? `US$ ${Math.round(t.USD).toLocaleString("es-AR")}` : ""].filter(Boolean).join(" + ");
}

/** El calendario del proyecto: cobros, pagos, leads, propuestas y lo que se carga a mano, por día. */
export function Calendario() {
  const id = useProyectoId();
  const base = useBaseProyecto();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mes, setMes] = useState<string | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const [ver, setVer] = useState<Set<TipoEvento>>(new Set(TIPOS_EVENTO.map((t) => t.tipo)));

  const cargar = useCallback(
    async (fresco = false) => {
      setCargando(true);
      try {
        const d = await leerJson<Datos>(await fetch(`/api/proyectos/${id}/calendario${fresco ? "?fresco=1" : ""}`));
        setDatos(d);
        setMes((m) => m ?? d.hoy.slice(0, 7));
        setDia((x) => x ?? d.hoy);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setCargando(false);
      }
    },
    [id],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const visibles = useMemo(() => (datos?.eventos ?? []).filter((e) => ver.has(e.tipo)), [datos, ver]);
  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of visibles) m.set(e.fecha, [...(m.get(e.fecha) ?? []), e]);
    return m;
  }, [visibles]);

  if (error && !datos) return <p className="alerta alerta--error">{error}</p>;
  if (!datos || !mes || !dia) return <p className="ficha__nota">Armando el calendario (cobros, pagos, leads y propuestas)…</p>;

  const delMes = (datos.eventos ?? []).filter((e) => e.fecha.startsWith(mes));
  const delDia = porDia.get(dia) ?? [];
  const atrasados = visibles.filter((e) => e.vencido);
  const irA = (m: string) => {
    setMes(m);
    setDia(m === datos.hoy.slice(0, 7) ? datos.hoy : `${m}-01`);
  };

  return (
    <div className="calendario">
      <section className="card calendario__principal">
        <div className="calendario__barra">
          <div className="calendario__mes">
            <button type="button" className="btn btn--borde btn--chico" onClick={() => irA(sumarMeses(mes, -1))} aria-label="Mes anterior">
              ‹
            </button>
            <h2>{nombreMes(mes)}</h2>
            <button type="button" className="btn btn--borde btn--chico" onClick={() => irA(sumarMeses(mes, 1))} aria-label="Mes siguiente">
              ›
            </button>
            <button type="button" className="btn btn--texto btn--chico" onClick={() => irA(datos.hoy.slice(0, 7))}>
              Hoy
            </button>
          </div>
          <button type="button" className="btn btn--texto btn--chico" onClick={() => void cargar(true)} disabled={cargando}>
            <Icono nombre="recargar" size={14} /> {cargando ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
        <div className="calendario__filtros" role="group" aria-label="Qué mostrar">
          {TIPOS_EVENTO.map(({ tipo, nombre }) => {
            const n = delMes.filter((e) => e.tipo === tipo).length;
            return (
              <label key={tipo} className={`calendario__filtro calendario__filtro--${tipo}`}>
                <input
                  type="checkbox"
                  checked={ver.has(tipo)}
                  onChange={(e) => {
                    const s = new Set(ver);
                    if (e.target.checked) s.add(tipo);
                    else s.delete(tipo);
                    setVer(s);
                  }}
                />
                {nombre} <small>{n}</small>
              </label>
            );
          })}
        </div>
        {datos.faltan.map((f) => (
          <p key={f.tipo} className="alerta alerta--error">
            No pude leer {nombreTipo(f.tipo).toLowerCase()}: {f.error}
          </p>
        ))}

        <div className="calendario__grilla" role="grid" aria-label={`Calendario de ${nombreMes(mes)}`}>
          {DIAS.map((d) => (
            <div key={d} className="calendario__dia-semana" role="columnheader">
              {d}
            </div>
          ))}
          {semanasDelMes(mes)
            .flat()
            .map((f, i) => {
              if (!f) return <div key={`v${i}`} className="calendario__celda calendario__celda--vacia" />;
              const evs = porDia.get(f) ?? [];
              const grupos = TIPOS_EVENTO.map(({ tipo }) => ({ tipo, lista: evs.filter((e) => e.tipo === tipo) })).filter((g) => g.lista.length);
              return (
                <button
                  key={f}
                  type="button"
                  role="gridcell"
                  className={["calendario__celda", f === datos.hoy && "calendario__celda--hoy", f === dia && "calendario__celda--elegida", evs.some((e) => e.vencido) && "calendario__celda--vencido"].filter(Boolean).join(" ")}
                  onClick={() => setDia(f)}
                  aria-label={`${fechaLarga(f)}: ${evs.length ? `${evs.length} eventos` : "sin eventos"}`}
                >
                  <span className="calendario__numero">{Number(f.slice(8))}</span>
                  {grupos.slice(0, 3).map((g) => (
                    <span key={g.tipo} className={`calendario__chip calendario__chip--${g.tipo}`}>
                      {g.lista.length === 1 ? g.lista[0].titulo : `${g.lista.length} ${nombreTipo(g.tipo).toLowerCase()}`}
                    </span>
                  ))}
                  {grupos.length > 3 && <span className="calendario__mas">+{grupos.length - 3}</span>}
                </button>
              );
            })}
        </div>
      </section>

      <aside className="card calendario__panel">
        <h3>{fechaLarga(dia)}</h3>
        {!delDia.length && <p className="ficha__nota">Nada para este día.</p>}
        {TIPOS_EVENTO.map(({ tipo, nombre }) => {
          const lista = delDia.filter((e) => e.tipo === tipo);
          if (!lista.length) return null;
          const total = totales(lista);
          return (
            <section key={tipo} className="calendario__grupo">
              <h4 className={`calendario__titulo-grupo calendario__titulo-grupo--${tipo}`}>
                {nombre} <small>{lista.length > 1 ? `${lista.length}${total ? ` · ${total}` : ""}` : ""}</small>
              </h4>
              <ul>
                {lista.map((e) => (
                  <li key={e.id} className={e.vencido ? "calendario__evento calendario__evento--vencido" : "calendario__evento"}>
                    <div>
                      <strong>{e.titulo}</strong>
                      {e.detalle && <small>{e.detalle}</small>}
                      {e.vencido && <small className="ingresos__vencido">{e.tipo === "cobro" ? "Vencido sin cobrar" : "Atrasado"}</small>}
                    </div>
                    <div className="calendario__evento-lado">
                      {e.monto && <span>{monto(e)}</span>}
                      {e.donde && (
                        <Link href={`${base}/${e.donde}`} className="btn btn--texto btn--chico">
                          Ver
                        </Link>
                      )}
                      {e.tipo === "agenda" && <Borrar id={e.id.replace(/^agenda-/, "")} proyecto={id} listo={() => void cargar()} />}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <NuevoEvento proyecto={id} fecha={dia} listo={() => void cargar()} />
        {atrasados.length > 0 && (
          <section className="calendario__grupo">
            <h4 className="calendario__titulo-grupo calendario__titulo-grupo--vencido">
              Atrasado <small>{atrasados.length}</small>
            </h4>
            <ul>
              {atrasados.slice(0, 8).map((e) => (
                <li key={e.id} className="calendario__evento">
                  <button type="button" className="ingresos__enlace" onClick={() => (setMes(e.fecha.slice(0, 7)), setDia(e.fecha))}>
                    {e.fecha.split("-").reverse().join("/")} · {e.titulo}
                  </button>
                  {e.monto && <span>{monto(e)}</span>}
                </li>
              ))}
            </ul>
            {atrasados.length > 8 && <p className="ficha__nota">Y {atrasados.length - 8} más: el detalle de los cobros está en Cobranzas y el de los leads en el CRM.</p>}
          </section>
        )}
      </aside>
    </div>
  );
}

function NuevoEvento({ proyecto, fecha, listo }: { proyecto: string; fecha: string; listo: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({ fecha, categoria: "Pago", titulo: "", detalle: "" });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  if (!abierto)
    return (
      <button type="button" className="btn btn--borde btn--chico calendario__agregar" onClick={() => (setF((x) => ({ ...x, fecha })), setAbierto(true))}>
        + Agregar a la agenda
      </button>
    );
  return (
    <form
      className="calendario__form"
      onSubmit={async (e) => {
        e.preventDefault();
        setGuardando(true);
        setError(null);
        try {
          await leerJson(await fetch(`/api/proyectos/${proyecto}/calendario`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) }));
          setAbierto(false);
          setF({ fecha, categoria: "Pago", titulo: "", detalle: "" });
          listo();
        } catch (x) {
          setError(x instanceof Error ? x.message : String(x));
        } finally {
          setGuardando(false);
        }
      }}
    >
      <div className="calendario__form-fila">
        <label className="campo">
          Día
          <input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} required />
        </label>
        <label className="campo">
          Qué es
          <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
            {CATEGORIAS_AGENDA.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="campo">
        Título
        <input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ej.: pagar el certificado de la constructora" required />
      </label>
      <label className="campo">
        Detalle (opcional)
        <input value={f.detalle} onChange={(e) => setF({ ...f, detalle: e.target.value })} placeholder="Monto, con quién, dónde…" />
      </label>
      {error && <p className="oliver__error">{error}</p>}
      <div className="calendario__form-fila">
        <button type="submit" className="btn btn--primario btn--chico" disabled={guardando}>
          {guardando ? "Guardando…" : "Agregar"}
        </button>
        <button type="button" className="btn btn--texto btn--chico" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Borrar({ id, proyecto, listo }: { id: string; proyecto: string; listo: () => void }) {
  const [borrando, setBorrando] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--texto btn--chico"
      disabled={borrando}
      onClick={async () => {
        if (!window.confirm("¿Borrar este evento de la agenda?")) return;
        setBorrando(true);
        try {
          await leerJson(await fetch(`/api/proyectos/${proyecto}/calendario/${id}`, { method: "DELETE" }));
          listo();
        } catch (e) {
          window.alert(e instanceof Error ? e.message : String(e));
        } finally {
          setBorrando(false);
        }
      }}
    >
      Borrar
    </button>
  );
}
