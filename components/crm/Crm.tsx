"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { alarmasDe, dias, hoyBA, tablero, temperatura, todasLasAlarmas, ultimoTrato, type Alarma } from "@/lib/crm/alarmas";
import { abierto, DESCRIPCION_ETAPA, ETAPAS, ETAPAS_ABIERTAS, NOMBRE_TEMPERATURA, ORIGENES, TEMPERATURAS, type Contacto, type Etapa } from "@/lib/crm/modelo";
import { Icono } from "../Icono";
import { useBaseProyecto } from "../proyecto";
import { ChipTemperatura, Ficha } from "./Ficha";
import { fechaCorta, useCrm, usd, type Crm } from "./datos";

const SECCIONES = [
  ["", "Dashboard"],
  ["/embudo", "Embudo"],
  ["/contactos", "Base de datos"],
] as const;

/** Lo común a las tres vistas: pestañas, actualizar, errores, importar y la ficha abierta. */
function Marco({ crm, actual, children, abrir, abierta }: { crm: Crm; actual: string; children: ReactNode; abrir: (id: string | null) => void; abierta: string | null }) {
  const base = `${useBaseProyecto()}/comercial/crm`;
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  return (
    <div className="ingresos crm">
      <div className="crm__barra">
        <nav className="crm__pestanias" aria-label="Secciones del CRM">
          {SECCIONES.map(([sub, nombre]) => (
            <Link key={sub} href={`${base}${sub}`} className={`crm__pestania${actual === sub ? " crm__pestania--activa" : ""}`} aria-current={actual === sub ? "page" : undefined}>
              {nombre}
            </Link>
          ))}
        </nav>
        <button type="button" className="btn btn--borde btn--chico" onClick={() => void crm.recargar()} disabled={crm.cargando}>
          <Icono nombre="recargar" size={14} /> {crm.cargando ? "Leyendo…" : "Actualizar"}
        </button>
      </div>
      {crm.error && (
        <p role="alert" className="alerta alerta--error">
          <Icono nombre="alerta" size={18} />
          <span>{crm.error}</span>
        </p>
      )}
      {crm.datos && crm.contactos.length === 0 && (
        <section className="card crm__vacio">
          <h2>Todavía no hay contactos</h2>
          <p>Podés traer los de la pestaña &quot;CRM&quot; del Excel madre (174 contactos, con su etapa y origen) o cargar uno nuevo desde Base de datos.</p>
          <button
            type="button"
            className="btn btn--primario"
            disabled={importando}
            onClick={async () => {
              setImportando(true);
              try {
                setAviso(`Listo: se importaron ${await crm.importar()} contactos.`);
              } catch (e) {
                setAviso(e instanceof Error ? e.message : String(e));
              } finally {
                setImportando(false);
              }
            }}
          >
            {importando ? "Importando…" : "Importar del Excel madre"}
          </button>
          {aviso && <p className="crm-ficha__aviso">{aviso}</p>}
        </section>
      )}
      {crm.datos && children}
      {abierta && <Ficha crm={crm} id={abierta} cerrar={() => abrir(null)} />}
    </div>
  );
}

function ListaAlarmas({ alarmas, abrir, max }: { alarmas: Alarma[]; abrir: (id: string) => void; max?: number }) {
  const lista = max ? alarmas.slice(0, max) : alarmas;
  if (!alarmas.length) return <p className="crm-ficha__sub">Nada pendiente. 👌</p>;
  return (
    <ul className="crm-alarmas">
      {lista.map((a, i) => (
        <li key={i}>
          <button type="button" className={`crm-alarma crm-alarma--${a.nivel}`} onClick={() => abrir(a.contactoId)}>
            <span className="crm-alarma__punto" aria-hidden="true" />
            <span>{a.texto}</span>
            <Icono nombre="flecha" size={14} />
          </button>
        </li>
      ))}
      {max && alarmas.length > max && <li className="crm-ficha__sub">Y {alarmas.length - max} más.</li>}
    </ul>
  );
}

/** Dashboard: los números, a quién hablarle hoy y lo que vence. */
export function CrmDashboard() {
  const crm = useCrm();
  const [abierta, setAbierta] = useState<string | null>(null);
  const d = crm.datos;
  const t = useMemo(() => (d ? tablero(crm.contactos, d.actividad, d.ahora, crm.precioMinimo) : null), [crm.contactos, d, crm.precioMinimo]);
  const alarmas = useMemo(() => (d ? todasLasAlarmas(crm.contactos, d.ahora, crm.precioMinimo) : []), [crm.contactos, d, crm.precioMinimo]);
  const hoy = d ? hoyBA(new Date(d.ahora)) : "";
  const semana = crm.contactos
    .filter((c) => abierto(c) && c.proximaFecha && c.proximaFecha > hoy && dias(hoy, c.proximaFecha) <= 7)
    .sort((a, b) => a.proximaFecha!.localeCompare(b.proximaFecha!));
  return (
    <Marco crm={crm} actual="" abrir={setAbierta} abierta={abierta}>
      {t && crm.contactos.length > 0 && (
        <>
          <div className="ingresos__cifras crm__cifras">
            <Cifra titulo="Para hablar hoy" valor={String(alarmas.filter((a) => a.nivel !== "atencion").length)} nota={`${t.seguimientos.vencidos} ${t.seguimientos.vencidos === 1 ? "seguimiento vencido" : "seguimientos vencidos"} · ${t.seguimientos.hoy} de hoy`} destacada />
            <Cifra titulo="Abiertos" valor={String(t.abiertos)} nota={`🔥 ${t.porTemperatura.hot} hot · 🌤 ${t.porTemperatura.tibio} tibios · ❄️ ${t.porTemperatura.frio} fríos`} />
            <Cifra titulo="Nuevos esta semana" valor={String(t.nuevosSemana)} nota={`${t.vendidos30} vendidos en 30 días`} />
            <Cifra
              titulo="Pronóstico"
              valor={usd(t.pronosticoUsd)}
              nota={`Presupuestos de los abiertos × probabilidad de su etapa · conversión ${t.conversion != null ? `${Math.round(t.conversion * 100)}%` : "—"}`}
            />
          </div>
          <div className="crm__dos">
            <section className="card ingresos__seccion crm__bloque">
              <h2>Hablale a…</h2>
              <ListaAlarmas alarmas={alarmas.filter((a) => a.nivel !== "atencion")} abrir={setAbierta} />
              {alarmas.some((a) => a.nivel === "atencion") && (
                <>
                  <h3 className="crm__subtitulo">Para ordenar</h3>
                  <ListaAlarmas alarmas={alarmas.filter((a) => a.nivel === "atencion")} abrir={setAbierta} max={8} />
                </>
              )}
            </section>
            <div className="crm__columna">
              <section className="card ingresos__seccion crm__bloque">
                <h2>Esta semana</h2>
                {semana.length === 0 ? (
                  <p className="crm-ficha__sub">Sin seguimientos agendados para los próximos 7 días.</p>
                ) : (
                  <ul className="crm-agenda">
                    {semana.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => setAbierta(c.id)}>
                          <strong>{fechaCorta(c.proximaFecha)}</strong> {c.nombre}
                          <span>{c.proximoPaso}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="card ingresos__seccion crm__bloque">
                <h2>Por etapa</h2>
                <ul className="crm-barras">
                  {ETAPAS.map((e) => (
                    <li key={e} title={DESCRIPCION_ETAPA[e]}>
                      <span>{e}</span>
                      <span className="crm-barras__pista">
                        <span className={`crm-barras__barra crm-etapa--${e.toLowerCase()}`} style={{ width: `${(t.porEtapa[e] / Math.max(1, ...Object.values(t.porEtapa))) * 100}%` }} />
                      </span>
                      <strong>{t.porEtapa[e]}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
          <div className="crm__dos">
            <section className="card ingresos__seccion crm__bloque">
              <h2>De dónde vienen</h2>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Origen</th>
                    <th className="tabla__numero">Contactos</th>
                    <th className="tabla__numero">Vendidos</th>
                    <th className="tabla__numero">Conversión</th>
                  </tr>
                </thead>
                <tbody>
                  {t.porOrigen.map((o) => (
                    <tr key={o.origen}>
                      <td data-etiqueta="Origen">{o.origen}</td>
                      <td data-etiqueta="Contactos" className="tabla__numero">
                        {o.total}
                      </td>
                      <td data-etiqueta="Vendidos" className="tabla__numero">
                        {o.vendidos}
                      </td>
                      <td data-etiqueta="Conversión" className="tabla__numero">
                        {o.total ? `${Math.round((o.vendidos / o.total) * 100)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="card ingresos__seccion crm__bloque">
              <h2>Por qué se pierden</h2>
              {t.motivosPerdida.length === 0 ? (
                <p className="crm-ficha__sub">Sin perdidos.</p>
              ) : (
                <ul className="crm-barras">
                  {t.motivosPerdida.map((m) => (
                    <li key={m.motivo}>
                      <span>{m.motivo}</span>
                      <span className="crm-barras__pista">
                        <span className="crm-barras__barra crm-etapa--perdido" style={{ width: `${(m.total / t.motivosPerdida[0].total) * 100}%` }} />
                      </span>
                      <strong>{m.total}</strong>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="crm__subtitulo">Actividad de la semana</h3>
              <p className="crm-ficha__sub">{t.actividadSemana.length ? t.actividadSemana.map((a) => `${a.usuario || "—"}: ${a.total}`).join(" · ") : "Nadie registró actividad esta semana."}</p>
            </section>
          </div>
        </>
      )}
    </Marco>
  );
}

function Cifra({ titulo, valor, nota, destacada }: { titulo: string; valor: string; nota: string; destacada?: boolean }) {
  return (
    <div className={`cifra${destacada ? " cifra--destacada" : ""}`}>
      <span className="cifra__titulo">{titulo}</span>
      <span className="cifra__valor">{valor}</span>
      <span className="cifra__nota">{nota}</span>
    </div>
  );
}

function Tarjeta({ c, crm, abrir }: { c: Contacto; crm: Crm; abrir: (id: string) => void }) {
  const d = crm.datos!;
  const hoy = hoyBA(new Date(d.ahora));
  const t = temperatura(c, hoy, crm.precioMinimo);
  const alarmas = alarmasDe(c, d.ahora, crm.precioMinimo).filter((a) => a.nivel !== "atencion");
  const sinHablar = dias(ultimoTrato(c), hoy);
  return (
    <button
      type="button"
      className={`crm-tarjeta${alarmas.length ? " crm-tarjeta--alarma" : ""}`}
      onClick={() => abrir(c.id)}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
    >
      <span className="crm-tarjeta__arriba">
        <strong>{c.nombre}</strong>
        <ChipTemperatura t={t} manual={!!c.temperaturaManual} />
      </span>
      <span className="crm-tarjeta__datos">
        {[c.presupuestoUsd ? usd(c.presupuestoUsd) : null, c.ambientes || null, c.unidades.length ? c.unidades.join(", ") : null].filter(Boolean).join(" · ") || "Sin calificar"}
      </span>
      <span className={`crm-tarjeta__paso${c.proximaFecha && c.proximaFecha < hoy ? " crm-tarjeta__paso--vencido" : ""}`}>
        {c.proximaFecha ? `${fechaCorta(c.proximaFecha)} · ${c.proximoPaso || "seguimiento"}` : "Sin próximo paso"}
      </span>
      <span className="crm-tarjeta__pie">
        {sinHablar === 0 ? "Hablamos hoy" : `Hace ${sinHablar} ${sinHablar === 1 ? "día" : "días"}`}
        {alarmas.length > 0 && (
          <span className="crm-tarjeta__alarma">
            <Icono nombre="alerta" size={12} /> {alarmas.length}
          </span>
        )}
      </span>
    </button>
  );
}

/** Embudo: una columna por etapa; se arrastra una tarjeta para cambiarla de etapa. */
export function CrmEmbudo() {
  const crm = useCrm();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [verCerrados, setVerCerrados] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const columnas: Etapa[] = verCerrados ? [...ETAPAS] : ETAPAS_ABIERTAS;
  const hoy = crm.datos ? hoyBA(new Date(crm.datos.ahora)) : "";
  const mover = async (id: string, etapa: Etapa) => {
    const c = crm.contactos.find((x) => x.id === id);
    if (!c || c.etapa === etapa) return;
    // Para perder o cerrar hay que dar el motivo o registrar: se abre la ficha.
    if (etapa === "Perdido" || etapa === "Vendido") {
      setAbierta(id);
      return;
    }
    setError(null);
    try {
      await crm.actualizar(id, { etapa });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Marco crm={crm} actual="/embudo" abrir={setAbierta} abierta={abierta}>
      {crm.contactos.length > 0 && (
        <>
          <div className="crm__opciones">
            <p className="crm-ficha__sub">Arrastrá una tarjeta a otra columna para cambiarla de etapa. Para Vendido o Perdido se abre la ficha.</p>
            <label className="crm__check">
              <input type="checkbox" checked={verCerrados} onChange={(e) => setVerCerrados(e.target.checked)} /> Ver vendidos, perdidos y dormidos
            </label>
          </div>
          {error && (
            <p role="alert" className="alerta alerta--error">
              {error}
            </p>
          )}
          <div className="crm-embudo">
            {columnas.map((e) => {
              const lista = crm.contactos
                .filter((c) => c.etapa === e)
                .sort((a, b) => (a.proximaFecha ?? "9999").localeCompare(b.proximaFecha ?? "9999"));
              const conAlarma = lista.filter((c) => c.proximaFecha && c.proximaFecha <= hoy).length;
              return (
                <section
                  key={e}
                  className="crm-embudo__columna"
                  onDragOver={(ev) => ev.preventDefault()}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    void mover(ev.dataTransfer.getData("text/plain"), e);
                  }}
                >
                  <header title={DESCRIPCION_ETAPA[e]}>
                    <span className={`crm-etapa crm-etapa--${e.toLowerCase()}`}>{e}</span>
                    <span>
                      {lista.length}
                      {conAlarma > 0 && <span className="crm-tarjeta__alarma"> · {conAlarma} para hoy</span>}
                    </span>
                  </header>
                  <div className="crm-embudo__tarjetas">
                    {lista.map((c) => (
                      <Tarjeta key={c.id} c={c} crm={crm} abrir={setAbierta} />
                    ))}
                    {lista.length === 0 && <p className="crm-ficha__sub">Vacío</p>}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </Marco>
  );
}

/** Base de datos: todos los contactos, con búsqueda y filtros, y el alta de uno nuevo. */
export function CrmContactos() {
  const crm = useCrm();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");
  const [etapa, setEtapa] = useState("");
  const [temp, setTemp] = useState("");
  const [origen, setOrigen] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const hoy = crm.datos ? hoyBA(new Date(crm.datos.ahora)) : "";
  const q = buscar.trim().toLowerCase();
  const lista = crm.contactos
    .filter((c) => !q || [c.nombre, c.mail, c.telefono, c.referido, c.notas].some((x) => x.toLowerCase().includes(q)))
    .filter((c) => !etapa || c.etapa === etapa)
    .filter((c) => !temp || temperatura(c, hoy, crm.precioMinimo) === temp)
    .filter((c) => !origen || c.origen === origen)
    .sort((a, b) => (b.ultimoContacto ?? b.creado).localeCompare(a.ultimoContacto ?? a.creado));
  return (
    <Marco crm={crm} actual="/contactos" abrir={setAbierta} abierta={abierta}>
      <section className="card ingresos__seccion">
        <div className="ingresos__titulo cuentas__controles">
          <h2>Contactos ({lista.length})</h2>
          <button type="button" className="btn btn--primario btn--chico" onClick={() => setNuevo((v) => !v)}>
            {nuevo ? "Cancelar" : "+ Nuevo contacto"}
          </button>
        </div>
        {nuevo && <Alta crm={crm} listo={(id) => (setNuevo(false), setAbierta(id))} />}
        <div className="crm__filtros">
          <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar nombre, mail, teléfono, notas…" aria-label="Buscar" />
          <select value={etapa} onChange={(e) => setEtapa(e.target.value)} aria-label="Etapa">
            <option value="">Todas las etapas</option>
            {ETAPAS.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
          <select value={temp} onChange={(e) => setTemp(e.target.value)} aria-label="Temperatura">
            <option value="">Todas las temperaturas</option>
            {TEMPERATURAS.map((t) => (
              <option key={t} value={t}>
                {NOMBRE_TEMPERATURA[t]}
              </option>
            ))}
          </select>
          <select value={origen} onChange={(e) => setOrigen(e.target.value)} aria-label="Origen">
            <option value="">Todos los orígenes</option>
            {[...new Set([...ORIGENES, ...crm.contactos.map((c) => c.origen).filter(Boolean)])].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th>Contacto</th>
                <th>Etapa</th>
                <th>Próximo paso</th>
                <th className="tabla__numero">Presupuesto</th>
                <th>Último contacto</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td data-etiqueta="Contacto">
                    <button type="button" className="ingresos__enlace" onClick={() => setAbierta(c.id)}>
                      {c.nombre}
                    </button>
                    <span className="tabla__sub">{[c.telefono, c.mail].filter(Boolean).join(" · ") || "Sin datos de contacto"}</span>
                  </td>
                  <td data-etiqueta="Etapa">
                    <span className={`crm-etapa crm-etapa--${c.etapa.toLowerCase()}`}>{c.etapa}</span> <ChipTemperatura t={temperatura(c, hoy, crm.precioMinimo)} manual={!!c.temperaturaManual} />
                    <span className="tabla__sub">{[c.origen, c.referido].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td data-etiqueta="Próximo paso">
                    {c.proximaFecha ? <span className={c.proximaFecha < hoy ? "ingresos__vencido" : undefined}>{fechaCorta(c.proximaFecha)}</span> : "—"}
                    <span className="tabla__sub">{c.proximoPaso}</span>
                  </td>
                  <td data-etiqueta="Presupuesto" className="tabla__numero">
                    {c.presupuestoUsd ? usd(c.presupuestoUsd) : "—"}
                  </td>
                  <td data-etiqueta="Último contacto">{c.ultimoContacto ? fechaCorta(c.ultimoContacto.slice(0, 10)) : "Nunca"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Marco>
  );
}

function Alta({ crm, listo }: { crm: Crm; listo: (id: string) => void }) {
  const [f, setF] = useState({ nombre: "", telefono: "", mail: "", origen: "", referido: "", nota: "" });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const poner = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="crm-alta"
      onSubmit={async (e) => {
        e.preventDefault();
        setGuardando(true);
        setError(null);
        try {
          const c = await crm.crear({ nombre: f.nombre, telefono: f.telefono, mail: f.mail, origen: f.origen, referido: f.referido }, f.nota);
          listo(c.id);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setGuardando(false);
        }
      }}
    >
      <label className="campo">
        Nombre y apellido
        <input required value={f.nombre} onChange={poner("nombre")} />
      </label>
      <label className="campo">
        Teléfono
        <input value={f.telefono} onChange={poner("telefono")} placeholder="11 5555-5555" />
      </label>
      <label className="campo">
        Mail
        <input type="email" value={f.mail} onChange={poner("mail")} />
      </label>
      <label className="campo">
        Origen
        <select value={f.origen} onChange={poner("origen")}>
          <option value="">—</option>
          {ORIGENES.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
      <label className="campo">
        Referido por
        <input value={f.referido} onChange={poner("referido")} />
      </label>
      <label className="campo crm-alta__nota">
        Nota
        <input value={f.nota} onChange={poner("nota")} placeholder="Qué busca, cómo llegó…" />
      </label>
      {error && <p className="oliver__error">{error}</p>}
      <button type="submit" className="btn btn--primario" disabled={guardando}>
        {guardando ? "Guardando…" : "Crear y abrir la ficha"}
      </button>
    </form>
  );
}
