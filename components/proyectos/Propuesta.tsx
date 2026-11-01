"use client";

/* eslint-disable @next/next/no-img-element -- las imágenes del PDF van como <img> para que se impriman tal cual. */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { nombreMes, sumarMeses } from "@/lib/finanzas/ingresos";
import { IMAGENES, planoDe } from "@/lib/proyectos/planos";
import { calcularPropuesta, parametrosIniciales, propuestaAUrl, propuestaDeUrl, resumenPropuesta, type ParametrosPropuesta } from "@/lib/proyectos/propuesta";
import { proyecto as buscarProyecto } from "@/lib/modulos";
import { Icono } from "../Icono";
import { useDolarHoy } from "../indicadores/Dolar";
import { useCrm } from "../crm/datos";
import { m2, useComercial, useProyectoId } from "./datos";

/** Mes de entrega de la obra (hasta cuándo van las cuotas por defecto). */
const ENTREGA: Record<string, string> = { "lerma-439": "2028-04" };

const usd = (n: number) => `US$ ${Math.round(n).toLocaleString("es-AR")}`;
const ars = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;
const fechaLarga = (f: string) => {
  const [a, m, d] = f.split("-");
  return `${Number(d)} de ${nombreMes(`${a}-${m}`).toLowerCase().replace(/ \d{4}$/, "")} de ${a}`;
};
const mesCorto = (m: string) => nombreMes(m, true);

/** Arma la propuesta comercial de una unidad (como la de Virginia) y la deja lista para guardar en PDF. */
export function Propuesta() {
  const id = useProyectoId();
  const proyecto = buscarProyecto(id);
  const q = useSearchParams();
  const router = useRouter();
  const { datos, error } = useComercial();
  const dolar = useDolarHoy();
  const contactoId = q.get("contacto");
  const crm = useCrm();
  const contacto = contactoId ? crm.contactos.find((c) => c.id === contactoId) ?? null : null;
  const [p, setP] = useState<ParametrosPropuesta | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const disponibles = useMemo(() => (datos?.comercial.unidades ?? []).filter((u) => !u.esCochera && (u.estado === "libre" || u.reventa)), [datos]);
  const mep = dolar.de("mep")?.venta ?? null;

  // Arranca cuando están la lista y el dólar (o falla el dólar): con lo de la URL, si vino.
  useEffect(() => {
    if (p || !datos || (!mep && !dolar.error)) return;
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
    const unidad = q.get("unidad") ?? contacto?.unidades.find((c) => disponibles.some((u) => u.codigo === c)) ?? disponibles[0]?.codigo ?? "";
    const u = disponibles.find((x) => x.codigo === unidad);
    const base = parametrosIniciales({
      cliente: contacto?.nombre ?? "",
      unidad,
      precioUsd: u ? (u.estado === "libre" ? u.precioLista : u.reventa!) : 0,
      tipoCambio: mep ?? 1500,
      hoy,
      entrega: ENTREGA[id] ?? sumarMeses(hoy.slice(0, 7), 18),
    });
    setP(propuestaDeUrl(q, base));
  }, [p, datos, mep, dolar.error, q, contacto, disponibles, id]);

  const r = useMemo(() => (p ? calcularPropuesta(p) : null), [p]);
  const u = datos?.comercial.unidades.find((x) => x.codigo === p?.unidad) ?? null;
  const img = IMAGENES[id];
  const plano = u ? planoDe(id, u) : null;
  const poner = <K extends keyof ParametrosPropuesta>(k: K, v: ParametrosPropuesta[K]) => setP((x) => (x ? { ...x, [k]: v } : x));
  const link = p ? `${typeof window !== "undefined" ? window.location.origin : ""}${window.location.pathname}?${propuestaAUrl(p)}${contactoId ? `&contacto=${contactoId}` : ""}` : "";

  async function registrar() {
    if (!p || !r || !contacto) return;
    setAviso(null);
    try {
      const hoy = p.fecha;
      const d = new Date(`${hoy}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 2);
      await crm.actualizar(
        contacto.id,
        {
          etapa: contacto.etapa === "Negociando" ? "Negociando" : "Evaluando",
          unidades: [...new Set([...contacto.unidades, p.unidad])],
          proximoPaso: `Seguimiento de la propuesta de la ${p.unidad} (vence el ${r.hasta.split("-").reverse().join("/")})`,
          proximaFecha: d.toISOString().slice(0, 10),
        },
        { tipo: "Nota", detalle: `${resumenPropuesta(p, r)} Ver: ${link}` },
      );
      setAviso("Listo: quedó en el historial del contacto, en Evaluando, con seguimiento en 2 días.");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
    }
  }

  if (error) return <p className="alerta alerta--error">{error}</p>;
  if (!p || !r || !datos) return <p className="ficha__nota">Preparando la propuesta (lista de precios y dólar del día)…</p>;

  // Por mes: lo de A y B juntos (o por separado, si se muestra B).
  const meses = [...new Set(r.cronograma.map((x) => x.mes ?? ""))];
  const cuotasDesde = p.cuotas.desde;
  const cuotasHasta = sumarMeses(p.cuotas.desde, Math.max(0, p.cuotas.cantidad - 1));

  return (
    <div className="propuesta">
      <section className="card propuesta__editor solo-pantalla" aria-label="Armar la propuesta">
        <div className="propuesta__acciones">
          <button type="button" className="btn btn--primario" onClick={() => window.print()}>
            <Icono nombre="imprimir" size={16} /> Descargar PDF
          </button>
          <button
            type="button"
            className="btn btn--borde btn--chico"
            onClick={async () => {
              router.replace(`?${propuestaAUrl(p)}${contactoId ? `&contacto=${contactoId}` : ""}`, { scroll: false });
              await navigator.clipboard.writeText(link).catch(() => undefined);
              setAviso("Copié el link: abre esta misma propuesta.");
            }}
          >
            Copiar link
          </button>
          {contacto && (
            <button type="button" className="btn btn--borde btn--chico" onClick={() => void registrar()}>
              Registrar en el CRM
            </button>
          )}
        </div>
        <p className="crm-ficha__sub">En &quot;Descargar PDF&quot; elegí <strong>Guardar como PDF</strong>, tamaño A4, sin encabezados.</p>
        {aviso && <p className="crm-ficha__aviso">{aviso}</p>}
        {r.problemas.map((x) => (
          <p key={x} className="oliver__error">
            {x}
          </p>
        ))}

        <div className="propuesta__campos">
          <label className="campo">
            Para
            <input value={p.cliente} onChange={(e) => poner("cliente", e.target.value)} placeholder="Nombre del cliente" />
          </label>
          <label className="campo">
            Unidad
            <select
              value={p.unidad}
              onChange={(e) => {
                const x = disponibles.find((y) => y.codigo === e.target.value);
                setP({ ...p, unidad: e.target.value, precioUsd: x ? Math.round(x.estado === "libre" ? x.precioLista : x.reventa!) : p.precioUsd });
              }}
            >
              {disponibles.map((x) => (
                <option key={x.codigo} value={x.codigo}>
                  {x.codigo} · {x.tipologia} · {usd(x.estado === "libre" ? x.precioLista : x.reventa!)}
                  {x.reventa ? " (reventa)" : ""}
                </option>
              ))}
            </select>
          </label>
          <Numero etiqueta="Valor (US$)" valor={p.precioUsd} poner={(v) => poner("precioUsd", v)} />
          <Numero etiqueta={`Dólar MEP ($)${mep ? ` · hoy ${Math.round(mep)}` : ""}`} valor={p.tipoCambio} poner={(v) => poner("tipoCambio", v)} />
          <label className="campo">
            Base CAC
            <input type="month" value={p.mesBaseCac} onChange={(e) => poner("mesBaseCac", e.target.value)} />
          </label>
          <Numero etiqueta="Parte A (formal) %" valor={Math.round(p.formal * 100)} poner={(v) => poner("formal", Math.min(100, Math.max(0, v)) / 100)} />
          <Numero etiqueta="Anticipo A (US$)" valor={p.anticipoAUsd} poner={(v) => poner("anticipoAUsd", v)} />
          <Numero etiqueta="Anticipo B (US$)" valor={p.anticipoBUsd} poner={(v) => poner("anticipoBUsd", v)} />
          <Numero etiqueta="Cuotas mensuales" valor={p.cuotas.cantidad} poner={(v) => poner("cuotas", { ...p.cuotas, cantidad: v })} />
          <label className="campo">
            Primera cuota
            <input type="month" value={p.cuotas.desde} onChange={(e) => poner("cuotas", { ...p.cuotas, desde: e.target.value })} />
          </label>
          <Numero etiqueta="Vale por (días)" valor={p.vigenciaDias} poner={(v) => poner("vigenciaDias", v)} />
          <label className="campo propuesta__check">
            <input type="checkbox" checked={p.mostrarB} onChange={(e) => poner("mostrarB", e.target.checked)} /> Mostrar A y B por separado
          </label>
        </div>

        <h3 className="propuesta__subtitulo">Refuerzos de A (% del total en pesos)</h3>
        {p.refuerzosA.map((x, i) => (
          <div key={i} className="propuesta__fila">
            <input type="month" value={x.mes} onChange={(e) => poner("refuerzosA", p.refuerzosA.map((y, j) => (j === i ? { ...y, mes: e.target.value } : y)))} aria-label="Mes" />
            <input
              inputMode="decimal"
              value={String(Math.round(x.porcentaje * 1000) / 10)}
              onChange={(e) => poner("refuerzosA", p.refuerzosA.map((y, j) => (j === i ? { ...y, porcentaje: (Number(e.target.value.replace(",", ".")) || 0) / 100 } : y)))}
              aria-label="Porcentaje"
            />
            <span>% = {ars(r.totalArs * x.porcentaje)}</span>
            <button type="button" className="btn btn--texto btn--chico" onClick={() => poner("refuerzosA", p.refuerzosA.filter((_, j) => j !== i))}>
              Quitar
            </button>
          </div>
        ))}
        <button type="button" className="btn btn--texto btn--chico" onClick={() => poner("refuerzosA", [...p.refuerzosA, { mes: sumarMeses(p.refuerzosA.at(-1)?.mes ?? p.cuotas.desde, 6), porcentaje: 0.1 }])}>
          + Refuerzo A
        </button>
        <h3 className="propuesta__subtitulo">Refuerzos de B (se reparte el saldo)</h3>
        {p.refuerzosB.map((m, i) => (
          <div key={i} className="propuesta__fila">
            <input type="month" value={m} onChange={(e) => poner("refuerzosB", p.refuerzosB.map((y, j) => (j === i ? e.target.value : y)))} aria-label="Mes" />
            <span>{ars(r.B.refuerzos[i]?.ars ?? 0)}</span>
            <button type="button" className="btn btn--texto btn--chico" onClick={() => poner("refuerzosB", p.refuerzosB.filter((_, j) => j !== i))}>
              Quitar
            </button>
          </div>
        ))}
        <button type="button" className="btn btn--texto btn--chico" onClick={() => poner("refuerzosB", [...p.refuerzosB, sumarMeses(p.refuerzosB.at(-1) ?? p.cuotas.desde, 6)])}>
          + Refuerzo B
        </button>
      </section>

      <article className="propuesta-doc" aria-label="Propuesta comercial">
        <header className="propuesta-doc__encabezado">
          <img src="/brand/mindlin-logo.png" alt="Mindlin Developers" className="propuesta-doc__logo" />
          {img && <img src={img.logo} alt={proyecto?.nombre ?? ""} className="propuesta-doc__logo-proyecto" onError={ocultar} />}
        </header>
        {img && (
          <div className="propuesta-doc__portada" style={{ backgroundImage: `url(${img.render})` }}>
            <div>
              <span>Propuesta comercial</span>
              <h1>{p.cliente ? `Para ${p.cliente}` : proyecto?.nombre}</h1>
              <p>
                {proyecto?.nombre} · {img.frase}
              </p>
            </div>
          </div>
        )}
        <p className="propuesta-doc__fecha">
          {fechaLarga(p.fecha)} · Vale hasta el {fechaLarga(r.hasta)}
        </p>

        <section className="propuesta-doc__unidad">
          <div className="propuesta-doc__plano">{plano ? <img src={plano} alt={`Plano de la unidad ${p.unidad}`} onError={ocultar} /> : img ? <img src={img.plantaTipo} alt="Planta tipo" onError={ocultar} /> : null}</div>
          <div>
            <span className="propuesta-doc__etiqueta">Unidad</span>
            <h2>
              {p.unidad}
              {u && (
                <small>
                  {" "}
                  · {u.tipologia} · {u.orientacion} · {u.piso === "PB" ? "Planta baja" : `Piso ${u.piso}`}
                </small>
              )}
            </h2>
            {u && (
              <dl className="propuesta-doc__superficies">
                <div>
                  <dt>Cubierta</dt>
                  <dd>{m2(u.supCubierta)}</dd>
                </div>
                {u.supSemicubierta > 0 && (
                  <div>
                    <dt>Semicubierta (balcón)</dt>
                    <dd>{m2(u.supSemicubierta)}</dd>
                  </div>
                )}
                {u.supDescubierta > 0 && (
                  <div>
                    <dt>Descubierta</dt>
                    <dd>{m2(u.supDescubierta)}</dd>
                  </div>
                )}
                <div>
                  <dt>Propia</dt>
                  <dd>{m2(u.supPropia)}</dd>
                </div>
                <div>
                  <dt>Amenities (parte proporcional)</dt>
                  <dd>{m2(u.supAmenities)}</dd>
                </div>
                <div className="propuesta-doc__total">
                  <dt>Superficie total</dt>
                  <dd>{m2(u.supTotal)}</dd>
                </div>
              </dl>
            )}
            <div className="propuesta-doc__valor">
              <span className="propuesta-doc__etiqueta">Aporte estimado</span>
              <strong>{usd(p.precioUsd)}</strong>
              <span>
                {ars(r.totalArs)} al dólar MEP de ${p.tipoCambio.toLocaleString("es-AR")}
              </span>
            </div>
            {p.mostrarB && (
              <div className="propuesta-doc__partes">
                <div>
                  <span>A · Boleto ({Math.round(p.formal * 100)}%)</span>
                  <strong>{usd(r.A.usd)}</strong>
                  <small>{ars(r.A.ars)}</small>
                </div>
                <div>
                  <span>B · Compromiso ({Math.round((1 - p.formal) * 100)}%)</span>
                  <strong>{usd(r.B.usd)}</strong>
                  <small>{ars(r.B.ars)}</small>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="propuesta-doc__pagos">
          <h2>Cómo se paga</h2>
          <div className="propuesta-doc__resumen">
            <div>
              <span className="propuesta-doc__etiqueta">A la firma</span>
              <strong>{usd(p.anticipoAUsd + p.anticipoBUsd)}</strong>
              <small>{p.mostrarB ? `Anticipo A ${usd(p.anticipoAUsd)} + anticipo B ${usd(p.anticipoBUsd)}` : "Anticipo en dólares"}</small>
            </div>
            <div>
              <span className="propuesta-doc__etiqueta">Cuotas mensuales</span>
              <strong>
                {p.cuotas.cantidad} × {ars(r.A.cuotaArs)}
              </strong>
              <small>
                De {mesCorto(cuotasDesde)} a {mesCorto(cuotasHasta)}
              </small>
            </div>
            <div>
              <span className="propuesta-doc__etiqueta">Refuerzos</span>
              <strong>{r.A.refuerzos.length + r.B.refuerzos.length}</strong>
              <small>{[...new Set([...r.A.refuerzos.map((x) => x.mes), ...r.B.refuerzos.map((x) => x.mes)])].sort().map(mesCorto).join(" · ")}</small>
            </div>
          </div>
          <table className="propuesta-doc__tabla">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Concepto</th>
                {p.mostrarB ? (
                  <>
                    <th className="tabla__numero">A</th>
                    <th className="tabla__numero">B</th>
                  </>
                ) : (
                  <th className="tabla__numero">Monto</th>
                )}
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => {
                const del = r.cronograma.filter((x) => (x.mes ?? "") === m);
                const suma = (parte?: "A" | "B") => del.filter((x) => !parte || x.parte === parte).reduce((s, x) => s + x.monto, 0);
                const moneda = del[0]?.moneda ?? "ARS";
                const fmt = (n: number) => (n ? (moneda === "USD" ? usd(n) : ars(n)) : "—");
                const concepto = [...new Set(del.map((x) => x.concepto.replace(/ A( \d+)?$| B( \d+)?$/, "").replace(/^Anticipo [AB] \(a la firma\)$/, "Anticipo")))].join(" + ");
                return (
                  <tr key={m || "firma"}>
                    <td>{m ? mesCorto(m) : "Firma"}</td>
                    <td>{concepto}</td>
                    {p.mostrarB ? (
                      <>
                        <td className="tabla__numero">{fmt(suma("A"))}</td>
                        <td className="tabla__numero">{fmt(suma("B"))}</td>
                      </>
                    ) : (
                      <td className="tabla__numero">{fmt(suma())}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="propuesta-doc__notas">
          <h2>Para tener en cuenta</h2>
          <ul>
            <li>
              Es un <strong>desarrollo al costo</strong>: los montos son el aporte estimado. Al terminar la obra se liquida el costo real según el coeficiente de la unidad
              {u ? ` (${(u.coeficiente * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%)` : ""}.
            </li>
            <li>Los montos del valor de obra son previstos y se abonan en pesos a la cotización del día.</li>
            <li>
              Las cuotas y los refuerzos en pesos se actualizan por el índice <strong>CAC</strong> desde {nombreMes(p.mesBaseCac).toLowerCase()}.
            </li>
            <li>Los pagos se hacen en pesos argentinos, salvo los anticipos en dólares.</li>
            <li>Los meses de pago pueden adelantarse si se agilizan los trámites municipales.</li>
            <li>Los precios corresponden a la lista vigente y pueden cambiar: esta propuesta vale hasta el {fechaLarga(r.hasta)}.</li>
          </ul>
        </section>

        <footer className="propuesta-doc__pie">
          <span>#WeDevelopStories</span>
          <span>www.mindlindevelopers.com · @mindlindevelopers</span>
        </footer>
      </article>
    </div>
  );
}

/** Si una imagen no está (todavía no se cargaron los planos), no se muestra rota. */
const ocultar = (e: { currentTarget: HTMLImageElement }) => {
  e.currentTarget.style.display = "none";
};

function Numero({ etiqueta, valor, poner }: { etiqueta: string; valor: number; poner: (v: number) => void }) {
  return (
    <label className="campo">
      {etiqueta}
      <input inputMode="decimal" value={String(valor)} onChange={(e) => poner(Number(e.target.value.replace(/\./g, "").replace(",", ".")) || 0)} />
    </label>
  );
}
