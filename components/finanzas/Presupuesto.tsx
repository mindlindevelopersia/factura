"use client";

import { useCallback, useEffect, useState } from "react";
import type { DatosPresupuesto } from "@/lib/presupuesto/fuente";
import { ESTADOS_ITEM, NOMBRE_ESTADO, posiblesTerminados, rubrosFaltantes, type ItemCalculado, type PagoCaja } from "@/lib/presupuesto/modelo";
import { GRUPOS_PRESUPUESTO, RUBROS_BASE, type GrupoPresupuesto } from "@/lib/presupuesto/rubros";
import { ExportarExcel } from "../ExportarExcel";
import { leerJson } from "../formato";
import { Icono } from "../Icono";
import { m2, useProyectoId, usd } from "../proyectos/datos";
import { BarraLectura } from "./comun";

const pesos = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;
const mesCorto = (m: string | null) => (m ? `${m.slice(5, 7)}/${m.slice(2, 4)}` : "");
const fecha = (f: string | null) => (f ? f.split("-").reverse().join("/") : "sin fecha");
const numero = (t: string) => (t.trim() === "" ? null : Number(t.replace(/\./g, "").replace(",", ".")));

/** El presupuesto de obra (base 0) contra lo pagado: por rubro, con lo que falta, el costo final y el costo del m². */
export function Presupuesto() {
  const id = useProyectoId();
  const base = `/api/proyectos/${id}/presupuesto`;
  const [d, setD] = useState<DatosPresupuesto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState<string | "nuevo" | null>(null);
  const [verSinItem, setVerSinItem] = useState<GrupoPresupuesto | null>(null);
  const [ocultos, setOcultos] = useState<string[]>([]);
  const [marcando, setMarcando] = useState(false);
  useEffect(() => {
    try {
      setOcultos(JSON.parse(localStorage.getItem("presupuesto-rubros-ocultos") ?? "[]"));
    } catch {
      /* nada guardado */
    }
  }, []);

  const cargar = useCallback(
    async (fresco = false) => {
      setCargando(true);
      try {
        setD(await leerJson<DatosPresupuesto>(await fetch(`${base}${fresco ? "?fresco=1" : ""}`)));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setCargando(false);
      }
    },
    [base],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const pedir = async (url: string, metodo: string, cuerpo?: unknown) => {
    await leerJson(await fetch(url, { method: metodo, headers: { "content-type": "application/json" }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }));
    await cargar();
  };

  if (error && !d) return <p className="alerta alerta--error">{error}</p>;
  if (!d) return <p className="ficha__nota">Armando el presupuesto…</p>;
  const p = d.presupuesto;
  const item = typeof abierto === "string" && abierto !== "nuevo" ? p.items.find((i) => i.id === abierto) : undefined;

  if (!p.items.length) {
    return (
      <section className="card presupuesto__vacio">
        <h2>Todavía no hay presupuesto</h2>
        <p>
          Arrancá con los rubros base (terreno, costo hard, costo soft e impuestos). Donde el cash flow del Excel madre tiene un monto, se carga como &quot;estimado&quot; en dólares; después corregís cada ítem con los presupuestos reales, en dólares o en pesos.
        </p>
        {error && <p className="oliver__error">{error}</p>}
        <button type="button" className="btn btn--primario" disabled={cargando} onClick={() => void pedir(base, "POST", { plantilla: true }).catch((e) => setError(e instanceof Error ? e.message : String(e)))}>
          Cargar los rubros base
        </button>
      </section>
    );
  }

  const desvio = p.total.costoFinalUsd - p.total.presupuestoUsd;
  const terminados = posiblesTerminados(p.items);
  const faltantes = rubrosFaltantes(p.items).filter((x) => !ocultos.includes(x));
  // Terminado: vale lo pagado. Si no tenía presupuesto, lo pagado queda como presupuesto (en dólares).
  const usarLoPagado = (i: ItemCalculado) => pedir(`${base}/${i.id}`, "PATCH", { estado: "terminado", faltaUsd: null, ...(i.monto == null ? { moneda: "USD", monto: Math.round(i.pagadoUsd), baseCac: null } : {}) });
  return (
    <div className="ingresos presupuesto">
      <BarraLectura
        leido={null}
        cargando={cargando}
        actualizar={() => void cargar(true)}
        extra={
          <ExportarExcel
            nombre={`Presupuesto ${id}`}
            hojas={() => [
              {
                nombre: "Presupuesto",
                titulo: `Presupuesto de obra · en dólares (MEP de hoy ${d.mepHoy ? pesos(d.mepHoy) : "—"})`,
                columnas: [
                  { titulo: "Rubro" },
                  { titulo: "Ítem", ancho: 34 },
                  { titulo: "Moneda" },
                  { titulo: "Monto original", formato: "numero" },
                  { titulo: "Base CAC" },
                  { titulo: "Presupuesto hoy", formato: "usd", total: true },
                  { titulo: "Pagado", formato: "usd", total: true },
                  { titulo: "Falta", formato: "usd", total: true },
                  { titulo: "Costo final", formato: "usd", total: true },
                  { titulo: "Estado" },
                  { titulo: "Proveedor" },
                ],
                filas: [
                  ...p.items.map((i) => [GRUPOS_PRESUPUESTO.find((g) => g.id === i.grupo)?.nombre, i.nombre, i.moneda, i.monto, i.baseCac ?? "", i.presupuestoUsd, i.pagadoUsd, i.faltaCalculadaUsd, i.costoFinalUsd, NOMBRE_ESTADO[i.estado], i.proveedor]),
                  ...p.grupos.filter((g) => g.sinItemUsd).map((g) => [g.nombre, "Pagado sin ítem", "", null, "", null, g.sinItemUsd, null, g.sinItemUsd, "", ""]),
                ],
              },
              {
                nombre: "Pagos",
                columnas: [{ titulo: "Fecha", formato: "fecha" }, { titulo: "Ítem", ancho: 30 }, { titulo: "Descripción", ancho: 40 }, { titulo: "Moneda" }, { titulo: "Monto", formato: "numero" }, { titulo: "En US$", formato: "usd", total: true }],
                filas: [...p.items.flatMap((i) => i.pagos.map((x) => [x.fecha, i.nombre, x.descripcion, x.moneda, x.monto, x.usd])), ...p.grupos.flatMap((g) => g.sinItem.map((x) => [x.fecha, `Sin ítem (${g.nombre})`, x.descripcion, x.moneda, x.monto, x.usd]))],
              },
            ]}
          />
        }
      />
      {d.avisos.map((a) => (
        <p key={a} className="alerta alerta--aviso">
          {a}
        </p>
      ))}

      <div className="ingresos__cifras">
        <div className="cifra cifra--destacada">
          <span className="cifra__titulo">Costo final estimado</span>
          <span className="cifra__valor">{usd(p.total.costoFinalUsd)}</span>
          <span className="cifra__nota">pagado + lo que falta</span>
        </div>
        <div className="cifra">
          <span className="cifra__titulo">Costo del m²</span>
          <span className="cifra__valor">{usd(p.costoM2)}</span>
          <span className="cifra__nota">÷ {m2(p.m2Venta)} vendibles · lo usan los honorarios</span>
        </div>
        <div className="cifra">
          <span className="cifra__titulo">Pagado</span>
          <span className="cifra__valor">{usd(p.total.pagadoUsd)}</span>
          <span className="cifra__nota">{p.total.costoFinalUsd ? `${Math.round((p.total.pagadoUsd / p.total.costoFinalUsd) * 100)}% del costo final` : ""}</span>
        </div>
        <div className="cifra">
          <span className="cifra__titulo">Falta</span>
          <span className="cifra__valor">{usd(p.total.faltaUsd)}</span>
          <span className={`cifra__nota${desvio > 0 ? " presupuesto--mal" : ""}`}>
            {desvio > 0 ? `${usd(desvio)} arriba del presupuesto` : desvio < 0 ? `${usd(-desvio)} abajo del presupuesto` : "en presupuesto"}
          </span>
        </div>
      </div>
      <p className="ficha__nota">
        Todo en dólares: lo pagado al MEP del día de cada pago; los presupuestos en pesos, ajustados por CAC desde su mes base{d.cacHoy ? ` hasta ${mesCorto(d.cacHoy.mes)}` : ""} y al MEP de hoy{d.mepHoy ? ` (${pesos(d.mepHoy)})` : ""}.
        {p.sinPresupuesto ? ` ${p.sinPresupuesto} ítems todavía sin monto.` : ""}
        {p.sinMep ? ` ${p.sinMep} pagos sin MEP del día (no suman en dólares).` : ""}
      </p>

      {terminados.length > 0 && (
        <section className="card presupuesto__aviso" aria-label="Ítems que parecen terminados">
          <div>
            <strong>
              {terminados.length === 1 ? "1 ítem parece terminado" : `${terminados.length} ítems parecen terminados`}
            </strong>
            <span className="ficha__nota">Ya tienen pagos y, o no tenían presupuesto, o se pagó casi todo. Marcalos como terminados para que valga lo pagado (lo que falta queda en cero).</span>
          </div>
          <ul>
            {terminados.map((i) => (
              <li key={i.id}>
                <span>
                  {i.nombre}: pagado <strong>{usd(i.pagadoUsd)}</strong>
                  {i.presupuestoUsd != null ? ` de ${usd(i.presupuestoUsd)} presupuestado` : " (sin presupuesto)"}
                </span>
                <button type="button" className="btn btn--borde btn--chico" disabled={marcando} onClick={() => void usarLoPagado(i).catch((e) => setError(e instanceof Error ? e.message : String(e)))}>
                  Usar lo pagado
                </button>
              </li>
            ))}
          </ul>
          {terminados.length > 1 && (
            <button
              type="button"
              className="btn btn--primario btn--chico"
              disabled={marcando}
              onClick={async () => {
                setMarcando(true);
                try {
                  for (const i of terminados) await usarLoPagado(i);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setMarcando(false);
                }
              }}
            >
              {marcando ? "Marcando…" : `Marcar los ${terminados.length} como terminados`}
            </button>
          )}
        </section>
      )}
      {faltantes.length > 0 && (
        <p className="alerta alerta--aviso presupuesto__faltantes">
          <span>
            Hay rubros nuevos en la plantilla: <strong>{faltantes.map((x) => RUBROS_BASE.find((r) => r.id === x)?.nombre).join(", ")}</strong>.
          </span>
          <button type="button" className="btn btn--borde btn--chico" onClick={() => void pedir(base, "POST", { faltantes: true }).catch((e) => setError(e instanceof Error ? e.message : String(e)))}>
            Agregarlos
          </button>
          <button
            type="button"
            className="btn btn--texto btn--chico"
            onClick={() => {
              const l = [...ocultos, ...faltantes];
              setOcultos(l);
              localStorage.setItem("presupuesto-rubros-ocultos", JSON.stringify(l));
            }}
          >
            No
          </button>
        </p>
      )}
      {error && <p className="alerta alerta--error">{error}</p>}

      <div className="tareas__barra">
        <button type="button" className="btn btn--primario btn--chico" onClick={() => setAbierto("nuevo")}>
          + Agregar ítem
        </button>
      </div>

      <section className="card tabla-contenedor presupuesto__tabla">
        <table className="tabla">
          <thead>
            <tr>
              <th>Ítem</th>
              <th className="tabla__numero">Presupuesto</th>
              <th className="tabla__numero">Pagado</th>
              <th className="tabla__numero">Falta</th>
              <th className="tabla__numero">Costo final</th>
              <th className="tabla__numero">Desvío</th>
            </tr>
          </thead>
          {p.grupos.map((g) => (
            <tbody key={g.id}>
              <tr className="presupuesto__grupo">
                <td colSpan={6}>
                  <strong>{g.nombre}</strong> · {g.detalle}
                </td>
              </tr>
              {p.items
                .filter((i) => i.grupo === g.id)
                .map((i) => (
                  <Fila key={i.id} i={i} abrir={() => setAbierto(i.id)} />
                ))}
              {g.sinItemUsd > 0 && (
                <tr className="presupuesto__sin-item">
                  <td>
                    <button type="button" className="ingresos__enlace" onClick={() => setVerSinItem(verSinItem === g.id ? null : g.id)}>
                      Pagado sin ítem ({g.sinItem.length} pagos)
                    </button>
                    <span className="tabla__sub">Asignalos a su ítem para comparar bien</span>
                  </td>
                  <td></td>
                  <td className="tabla__numero">{usd(g.sinItemUsd)}</td>
                  <td></td>
                  <td className="tabla__numero">{usd(g.sinItemUsd)}</td>
                  <td></td>
                </tr>
              )}
              {verSinItem === g.id && (
                <tr>
                  <td colSpan={6}>
                    <ListaPagos pagos={g.sinItem} items={p.items} asignar={(x, item) => pedir(`${base}/asignar`, "POST", { clave: x.clave, item, descripcion: x.descripcion })} />
                  </td>
                </tr>
              )}
              <tr className="tabla__total">
                <td>Subtotal {g.nombre.toLowerCase()}</td>
                <td className="tabla__numero">{usd(g.presupuestoUsd)}</td>
                <td className="tabla__numero">{usd(g.pagadoUsd)}</td>
                <td className="tabla__numero">{usd(g.faltaUsd)}</td>
                <td className="tabla__numero">{usd(g.costoFinalUsd)}</td>
                <td className="tabla__numero">{usd(g.costoFinalUsd - g.presupuestoUsd)}</td>
              </tr>
            </tbody>
          ))}
          <tbody>
            <tr className="tabla__total presupuesto__total">
              <td>Total del proyecto</td>
              <td className="tabla__numero">{usd(p.total.presupuestoUsd)}</td>
              <td className="tabla__numero">{usd(p.total.pagadoUsd)}</td>
              <td className="tabla__numero">{usd(p.total.faltaUsd)}</td>
              <td className="tabla__numero">{usd(p.total.costoFinalUsd)}</td>
              <td className="tabla__numero">{usd(desvio)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {(item || abierto === "nuevo") && (
        <FichaItem
          key={abierto ?? ""}
          item={item ?? null}
          items={p.items}
          cerrar={() => setAbierto(null)}
          guardar={async (c) => {
            if (item) await pedir(`${base}/${item.id}`, "PATCH", c);
            else await pedir(base, "POST", { item: c });
            setAbierto(null);
          }}
          borrar={item ? async () => (await pedir(`${base}/${item.id}`, "DELETE"), setAbierto(null)) : undefined}
          usarLoPagado={item && item.pagos.length && item.estado !== "terminado" ? async () => (await usarLoPagado(item), setAbierto(null)) : undefined}
          asignar={(x, destino) => pedir(`${base}/asignar`, "POST", { clave: x.clave, item: destino, descripcion: x.descripcion })}
        />
      )}
    </div>
  );
}

function Fila({ i, abrir }: { i: ItemCalculado; abrir: () => void }) {
  // Sin monto y sin pagos: todavía no hay nada que mostrar.
  const vacio = i.monto == null && !i.pagos.length && i.faltaUsd == null;
  return (
    <tr className="presupuesto__fila" onClick={abrir}>
      <td data-etiqueta="Ítem">
        <button type="button" className="ingresos__enlace" onClick={abrir}>
          {i.nombre}
        </button>
        <span className="tabla__sub">
          <span className={`presupuesto__estado presupuesto__estado--${i.estado}`}>{NOMBRE_ESTADO[i.estado]}</span>
          {i.proveedor ? ` · ${i.proveedor}` : ""}
        </span>
      </td>
      <td data-etiqueta="Presupuesto" className="tabla__numero">
        {i.monto == null ? <span className="tabla__sub">sin monto</span> : usd(i.presupuestoUsd)}
        {i.moneda === "ARS" && i.monto != null && (
          <span className="tabla__sub">
            {pesos(i.monto)}
            {i.baseCac ? ` · base CAC ${mesCorto(i.baseCac)}` : " · sin base CAC"}
          </span>
        )}
      </td>
      <td data-etiqueta="Pagado" className="tabla__numero">
        {i.pagadoUsd ? usd(i.pagadoUsd) : "—"}
        {i.pagos.length > 0 && <span className="tabla__sub">{i.pagos.length} pagos</span>}
      </td>
      <td data-etiqueta="Falta" className="tabla__numero">
        {vacio ? "—" : usd(i.faltaCalculadaUsd)}
        {i.estado === "terminado" ? <span className="tabla__sub">terminado</span> : i.faltaUsd != null && <span className="tabla__sub">a mano</span>}
      </td>
      <td data-etiqueta="Costo final" className="tabla__numero">
        {vacio ? "—" : <strong>{usd(i.costoFinalUsd)}</strong>}
      </td>
      <td data-etiqueta="Desvío" className={`tabla__numero${(i.desvioUsd ?? 0) > 0 ? " presupuesto--mal" : ""}`}>
        {i.desvioUsd == null || Math.round(i.desvioUsd) === 0 ? "—" : `${i.desvioUsd > 0 ? "+" : ""}${usd(i.desvioUsd)}`}
      </td>
    </tr>
  );
}

function ListaPagos({ pagos, items, asignar }: { pagos: PagoCaja[]; items: ItemCalculado[]; asignar: (p: PagoCaja, item: string) => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="presupuesto__pagos">
      {error && <p className="oliver__error">{error}</p>}
      <ul>
        {pagos.map((x) => (
          <li key={x.clave}>
            <span>
              <strong>{fecha(x.fecha)}</strong> · {x.descripcion || "(sin descripción)"}
              <small>
                {x.moneda === "USD" ? usd(x.monto) : pesos(x.monto)}
                {x.moneda === "ARS" && x.usd != null ? ` · ${usd(x.usd)}` : ""}
              </small>
            </span>
            <select
              defaultValue=""
              aria-label={`A qué ítem va ${x.descripcion}`}
              onChange={(e) => {
                if (!e.target.value) return;
                setError(null);
                void asignar(x, e.target.value === "-" ? "" : e.target.value).catch((er) => setError(er instanceof Error ? er.message : String(er)));
              }}
            >
              <option value="">Mover a…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
              <option value="-">Ninguno (sin ítem)</option>
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FichaItem({
  item,
  items,
  cerrar,
  guardar,
  borrar,
  asignar,
  usarLoPagado,
}: {
  item: ItemCalculado | null;
  items: ItemCalculado[];
  cerrar: () => void;
  guardar: (c: Record<string, unknown>) => Promise<void>;
  borrar?: () => Promise<void>;
  usarLoPagado?: () => Promise<void>;
  asignar: (p: PagoCaja, item: string) => Promise<void>;
}) {
  const [f, setF] = useState({
    nombre: item?.nombre ?? "",
    grupo: item?.grupo ?? ("hard" as GrupoPresupuesto),
    moneda: item?.moneda ?? "USD",
    monto: item?.monto != null ? String(item.monto) : "",
    baseCac: item?.baseCac ?? "",
    proveedor: item?.proveedor ?? "",
    estado: item?.estado ?? "estimado",
    falta: item?.faltaUsd != null ? String(item.faltaUsd) : "",
    notas: item?.notas ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const poner = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const enviar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await guardar({ nombre: f.nombre, grupo: f.grupo, moneda: f.moneda, monto: numero(f.monto), baseCac: f.moneda === "ARS" ? f.baseCac || null : null, proveedor: f.proveedor, estado: f.estado, faltaUsd: numero(f.falta), notas: f.notas });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setGuardando(false);
    }
  };
  return (
    <div className="crm-ficha__fondo" onClick={cerrar}>
      <aside className="crm-ficha" aria-label={item ? `Ítem ${item.nombre}` : "Nuevo ítem"} onClick={(e) => e.stopPropagation()}>
        <header className="crm-ficha__encabezado">
          <div>
            <h2>{item ? item.nombre : "Nuevo ítem"}</h2>
            {item && (
              <span className="crm-ficha__sub">
                Costo final {usd(item.costoFinalUsd)} · pagado {usd(item.pagadoUsd)}
              </span>
            )}
          </div>
          <button type="button" className="oliver__accion crm-ficha__cerrar" onClick={cerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" size={18} />
          </button>
        </header>
        <div className="crm-ficha__cuerpo">
          <section className="crm-ficha__seccion">
            <div className="tarea-ficha__grilla">
              <label className="campo">
                Ítem
                <input value={f.nombre} onChange={(e) => poner("nombre", e.target.value)} placeholder="Ej.: Albañilería" />
              </label>
              <label className="campo">
                Rubro
                <select value={f.grupo} onChange={(e) => poner("grupo", e.target.value)}>
                  {GRUPOS_PRESUPUESTO.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="campo">
                Moneda del presupuesto
                <select value={f.moneda} onChange={(e) => poner("moneda", e.target.value)}>
                  <option value="USD">Dólares</option>
                  <option value="ARS">Pesos (se ajusta por CAC)</option>
                </select>
              </label>
              <label className="campo">
                Presupuesto del ítem completo ({f.moneda === "USD" ? "US$" : "$"})
                <input inputMode="decimal" value={f.monto} onChange={(e) => poner("monto", e.target.value)} placeholder="Ej.: 120000" />
              </label>
              {f.moneda === "ARS" && (
                <label className="campo">
                  Mes base CAC (de cuándo es el precio)
                  <input type="month" value={f.baseCac} onChange={(e) => poner("baseCac", e.target.value)} />
                </label>
              )}
              <label className="campo">
                Estado
                <select value={f.estado} onChange={(e) => poner("estado", e.target.value)}>
                  {ESTADOS_ITEM.map((x) => (
                    <option key={x} value={x}>
                      {NOMBRE_ESTADO[x]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="campo">
                Proveedor
                <input value={f.proveedor} onChange={(e) => poner("proveedor", e.target.value)} placeholder="Ej.: JH / Miranda" />
              </label>
              <label className="campo">
                Falta pagar, a mano (US$)
                <input inputMode="decimal" value={f.falta} onChange={(e) => poner("falta", e.target.value)} placeholder={item ? `Automático: ${Math.round(Math.max(0, (item.presupuestoUsd ?? 0) - item.pagadoUsd))}` : "Automático"} />
              </label>
            </div>
            <label className="campo">
              Notas
              <textarea rows={2} value={f.notas} onChange={(e) => poner("notas", e.target.value)} />
            </label>
            {error && <p className="oliver__error">{error}</p>}
            <div className="tarea-ficha__acciones">
              <button type="button" className="btn btn--primario btn--chico" disabled={guardando || !f.nombre.trim()} onClick={() => void enviar()}>
                {guardando ? "Guardando…" : item ? "Guardar" : "Agregar"}
              </button>
              {usarLoPagado && (
                <button type="button" className="btn btn--borde btn--chico" disabled={guardando} onClick={() => void usarLoPagado().catch((e) => setError(e instanceof Error ? e.message : String(e)))} title="Marca el ítem como terminado: vale lo pagado y no falta nada">
                  <Icono nombre="check" size={14} /> Terminado: usar lo pagado ({usd(item?.pagadoUsd ?? 0)})
                </button>
              )}
              {borrar && (
                <button type="button" className="btn btn--texto btn--chico" onClick={() => window.confirm(`¿Borrar "${item?.nombre}"? Sus pagos quedan sin ítem.`) && void borrar()}>
                  Borrar ítem
                </button>
              )}
            </div>
          </section>
          {item && (
            <section className="crm-ficha__seccion">
              <h3>Pagos de la caja ({item.pagos.length})</h3>
              {item.pagos.length ? <ListaPagos pagos={item.pagos} items={items.filter((x) => x.id !== item.id)} asignar={asignar} /> : <p className="crm-ficha__sub">Todavía no hay pagos asignados. Los de la caja se asignan solos por la descripción; los que no, se mueven desde &quot;Pagado sin ítem&quot;.</p>}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
