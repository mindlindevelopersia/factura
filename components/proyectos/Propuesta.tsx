"use client";

/* eslint-disable @next/next/no-img-element -- las imágenes del PDF van como <img> para que se impriman tal cual. */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { nombreMes, sumarMeses } from "@/lib/finanzas/ingresos";
import { IMAGENES, planoDe } from "@/lib/proyectos/planos";
import { calcularPropuesta, nombreDelPdf, parametrosIniciales, propuestaAUrl, propuestaDeUrl, resumenPropuesta, type ParametrosPropuesta, type Propuesta as CalculoPropuesta } from "@/lib/proyectos/propuesta";
import { mensajePropuesta, whatsappPropuesta, type PropuestaGuardada } from "@/lib/proyectos/propuestasGuardadas";
import { proyecto as buscarProyecto } from "@/lib/modulos";
import { leerJson } from "../formato";
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
const pct = (x: number) => `${(Math.round(x * 1000) / 10).toLocaleString("es-AR")}%`;

interface LineaPlan {
  concepto: string;
  detalle?: string;
  monto: string;
  aparte?: string;
  clase?: string;
}

/**
 * Cómo se paga cada parte, como en la planilla de Virginia: A (boleto certificado) con su anticipo,
 * saldo, cuotas y cada refuerzo con su mes y su %; B (compromiso de deuda) con su anticipo, saldo y
 * refuerzos. Si no se muestra B, un solo plan con todo junto.
 */
function planesDePago(p: ParametrosPropuesta, r: CalculoPropuesta) {
  const cuotas = p.cuotas.cantidad;
  const hasta = sumarMeses(p.cuotas.desde, Math.max(0, cuotas - 1));
  const lineaCuotas = (): LineaPlan[] =>
    cuotas && r.A.cuotaArs
      ? [{ concepto: `Cuotas mensuales`, detalle: `${cuotas === 1 ? nombreMes(p.cuotas.desde) : `${nombreMes(p.cuotas.desde)} a ${nombreMes(hasta)}`} · total ${ars(r.A.cuotaArs * cuotas)}`, monto: `${cuotas} × ${ars(r.A.cuotaArs)}` }]
      : [];
  const refuerzos = (lista: { mes: string; ars: number }[]): LineaPlan[] =>
    lista.map((x, i) => ({
      concepto: `Refuerzo${lista.length > 1 ? ` ${i + 1}` : ""} · ${nombreMes(x.mes)}`,
      detalle: `${pct(x.ars / r.totalArs)} del valor`,
      monto: ars(x.ars),
    }));
  const anticipo = (u: number, a: number): LineaPlan[] => (u ? [{ concepto: "Anticipo (a la firma)", monto: usd(u), aparte: ars(a) }] : []);
  const saldo = (n: number, cuotas: number, refuerzos: number): LineaPlan => ({
    concepto: "Saldo en pesos",
    detalle: `${[cuotas ? `${cuotas} ${cuotas === 1 ? "cuota" : "cuotas"}` : "", refuerzos ? `${refuerzos} ${refuerzos === 1 ? "refuerzo" : "refuerzos"}` : ""].filter(Boolean).join(" + ")} · se ajusta por CAC`,
    monto: ars(n),
    clase: "propuesta-doc__saldo",
  });

  if (!p.mostrarB) {
    const meses = new Map<string, number>();
    for (const x of [...r.A.refuerzos, ...r.B.refuerzos]) meses.set(x.mes, (meses.get(x.mes) ?? 0) + x.ars);
    return [
      {
        titulo: "Plan de pagos",
        subtitulo: `${usd(p.precioUsd)} · ${ars(r.totalArs)}`,
        lineas: [
          ...anticipo(r.A.anticipoUsd + r.B.anticipoUsd, r.A.anticipoArs + r.B.anticipoArs),
          saldo(r.A.saldoArs + r.B.saldoArs, cuotas, meses.size),
          ...lineaCuotas(),
          ...refuerzos([...meses].sort(([x], [y]) => x.localeCompare(y)).map(([mes, ars]) => ({ mes, ars }))),
        ],
      },
    ];
  }
  return [
    {
      titulo: `A · Boleto certificado (${pct(p.formal)})`,
      subtitulo: `${usd(r.A.usd)} · ${ars(r.A.ars)}`,
      lineas: [...anticipo(r.A.anticipoUsd, r.A.anticipoArs), saldo(r.A.saldoArs, cuotas, r.A.refuerzos.length), ...lineaCuotas(), ...refuerzos(r.A.refuerzos)],
    },
    {
      titulo: `B · Compromiso de deuda (${pct(1 - p.formal)})`,
      subtitulo: `${usd(r.B.usd)} · ${ars(r.B.ars)}`,
      lineas: [...anticipo(r.B.anticipoUsd, r.B.anticipoArs), saldo(r.B.saldoArs, 0, r.B.refuerzos.length), ...refuerzos(r.B.refuerzos)],
    },
  ];
}

/** Cada pago en su renglón (la cuota y el refuerzo por separado, con su parte) y el total de cada mes. */
function detalleMesAMes(p: ParametrosPropuesta, r: CalculoPropuesta) {
  let lineas = r.cronograma.map((x) => ({
    ...x,
    concepto: x.concepto.replace(/^Anticipo [AB] \(a la firma\)$/, "Anticipo").replace(/^Refuerzo [AB]( \d+)?$/, (_, n) => `Refuerzo${n ?? ""}`),
  }));
  if (!p.mostrarB) {
    // Sin B, el anticipo y los refuerzos del mismo mes van juntos.
    const juntas: typeof lineas = [];
    for (const l of lineas) {
      const tipo = l.concepto.startsWith("Cuota") ? null : l.concepto.split(" ")[0];
      const igual = tipo && juntas.find((x) => x.mes === l.mes && x.concepto.startsWith(tipo));
      if (igual) igual.monto += l.monto;
      else juntas.push({ ...l, concepto: tipo ?? l.concepto });
    }
    lineas = juntas;
  }
  const meses = [...new Set(lineas.map((x) => x.mes ?? ""))];
  return meses.map((mes) => {
    const del = lineas.filter((x) => (x.mes ?? "") === mes);
    return { mes, lineas: del, total: del.reduce((s, x) => s + x.monto, 0) };
  });
}

/** Arma la propuesta comercial de una unidad (como la de Virginia) y la deja lista para guardar en PDF. */
export function Propuesta() {
  const id = useProyectoId();
  const proyecto = buscarProyecto(id);
  const q = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { datos, error } = useComercial();
  const dolar = useDolarHoy();
  const contactoId = q.get("contacto");
  const crm = useCrm();
  const contacto = contactoId ? crm.contactos.find((c) => c.id === contactoId) ?? null : null;
  const [p, setP] = useState<ParametrosPropuesta | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // La propuesta guardada que se está editando (si viene de la lista o ya se guardó) y lo último guardado.
  const [guardadaId, setGuardadaId] = useState<string | null>(q.get("id"));
  const [guardado, setGuardado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

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
    const inicial = propuestaDeUrl(q, base);
    setP(inicial);
    if (q.get("id")) setGuardado(propuestaAUrl(inicial));
  }, [p, datos, mep, dolar.error, q, contacto, disponibles, id]);

  const r = useMemo(() => (p ? calcularPropuesta(p) : null), [p]);
  const u = datos?.comercial.unidades.find((x) => x.codigo === p?.unidad) ?? null;
  const img = IMAGENES[id];
  const plano = u ? planoDe(id, u) : null;
  const poner = <K extends keyof ParametrosPropuesta>(k: K, v: ParametrosPropuesta[K]) => setP((x) => (x ? { ...x, [k]: v } : x));
  const consulta = (x: ParametrosPropuesta, idGuardada = guardadaId) => `${idGuardada ? `id=${idGuardada}&` : ""}${propuestaAUrl(x)}${contactoId ? `&contacto=${contactoId}` : ""}`;
  const link = p ? `${typeof window !== "undefined" ? window.location.origin : ""}${typeof window !== "undefined" ? window.location.pathname : ""}?${consulta(p)}` : "";
  const sinGuardar = p ? guardado !== propuestaAUrl(p) : false;

  // Desde la lista, "PDF" abre la propuesta y la manda a imprimir sola (una vez, con las imágenes cargadas).
  const imprimio = useRef(false);
  useEffect(() => {
    if (!r || imprimio.current || q.get("imprimir") !== "1") return;
    imprimio.current = true;
    const t = setTimeout(() => window.print(), 1200);
    return () => clearTimeout(t);
  }, [r, q]);

  async function guardar(): Promise<string | null> {
    if (!p || !r) return null;
    setGuardando(true);
    setAviso(null);
    try {
      const cuerpo = JSON.stringify({ cliente: p.cliente, contactoId: contactoId ?? "", unidad: p.unidad, precioUsd: p.precioUsd, totalArs: r.totalArs, vence: r.hasta, parametros: propuestaAUrl(p) });
      const base = `/api/proyectos/${id}/propuestas`;
      const { propuesta } = await leerJson<{ propuesta: PropuestaGuardada }>(
        await fetch(guardadaId ? `${base}/${guardadaId}` : base, { method: guardadaId ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: cuerpo }),
      );
      setGuardadaId(propuesta.id);
      setGuardado(propuesta.parametros);
      router.replace(`?${consulta(p, propuesta.id)}`, { scroll: false });
      setAviso("Guardada: está en la lista de propuestas.");
      return propuesta.id;
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setGuardando(false);
    }
  }

  // El nombre del PDF sale del título de la página: "UF 2C - LERMA 439 - Virginia Alegre by Mindlin Developers".
  const titulo = p ? nombreDelPdf(p, proyecto?.nombre ?? id) : null;
  useEffect(() => {
    if (!titulo) return;
    const antes = document.title;
    document.title = titulo;
    return () => {
      document.title = antes;
    };
  }, [titulo]);

  async function registrar() {
    if (!p || !r || !contacto) return;
    const idGuardada = sinGuardar || !guardadaId ? await guardar() : guardadaId;
    if (!idGuardada) return;
    setAviso(null);
    try {
      const hoy = p.fecha;
      const d = new Date(`${hoy}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 2);
      await crm.actualizar(
        contacto.id,
        {
          etapa: "Propuesta enviada",
          unidades: [...new Set([...contacto.unidades, p.unidad])],
          proximoPaso: `Seguimiento de la propuesta de la ${p.unidad} (vence el ${r.hasta.split("-").reverse().join("/")})`,
          proximaFecha: d.toISOString().slice(0, 10),
        },
        { tipo: "Nota", detalle: `${resumenPropuesta(p, r)} Ver: ${window.location.origin}${window.location.pathname}?${consulta(p, idGuardada)}` },
      );
      setAviso("Listo: quedó en el historial del contacto, en Propuesta enviada, con seguimiento en 2 días.");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
    }
  }

  if (error) return <p className="alerta alerta--error">{error}</p>;
  if (!p || !r || !datos) return <p className="ficha__nota">Preparando la propuesta (lista de precios y dólar del día)…</p>;

  const planes = planesDePago(p, r);
  const porMes = detalleMesAMes(p, r);

  return (
    <div className="propuesta">
      <section className="card propuesta__editor solo-pantalla" aria-label="Armar la propuesta">
        <Link href={pathname} className="btn btn--texto btn--chico propuesta__volver">
          ← Todas las propuestas
        </Link>
        <div className="propuesta__acciones">
          <button type="button" className="btn btn--primario" onClick={() => void guardar()} disabled={guardando || (!sinGuardar && !!guardadaId)}>
            {guardando ? "Guardando…" : !sinGuardar && guardadaId ? "Guardada ✓" : guardadaId ? "Guardar cambios" : "Guardar"}
          </button>
          <button type="button" className="btn btn--borde btn--chico" onClick={() => window.print()}>
            <Icono nombre="imprimir" size={16} /> Descargar PDF
          </button>
          <a className="btn btn--borde btn--chico" href={whatsappPropuesta(contacto?.telefono ?? "", mensajePropuesta(p, r, proyecto?.nombre.toUpperCase() ?? id))} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <button
            type="button"
            className="btn btn--borde btn--chico"
            onClick={async () => {
              router.replace(`?${consulta(p)}`, { scroll: false });
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
        <p className="crm-ficha__sub">
          En &quot;Descargar PDF&quot; elegí <strong>Guardar como PDF</strong>, tamaño A4, sin encabezados. WhatsApp abre el chat {contacto?.telefono ? `con ${contacto.nombre}` : "(elegís a quién)"} con el mensaje armado: adjuntale el PDF.
          {sinGuardar && guardadaId && <strong> Hay cambios sin guardar.</strong>}
        </p>
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
          <span className="propuesta-doc__nombre-proyecto">
            <strong>{proyecto?.nombre.toUpperCase()}</strong>
            {img && <small>{img.frase.split(" · ")[0]}</small>}
          </span>
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
          </div>
        </section>

        <section className="propuesta-doc__pagos">
          <h2>Cómo se paga</h2>
          {p.mostrarB && (
            <table className="propuesta-doc__tabla propuesta-doc__aportes">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th className="tabla__numero">US$</th>
                  <th className="tabla__numero">$</th>
                  <th className="tabla__numero">%</th>
                </tr>
              </thead>
              <tbody>
                <tr className="propuesta-doc__fuerte">
                  <td>Valor estimado</td>
                  <td className="tabla__numero">{usd(p.precioUsd)}</td>
                  <td className="tabla__numero">{ars(r.totalArs)}</td>
                  <td className="tabla__numero">100%</td>
                </tr>
                <tr>
                  <td>Aporte A · Boleto certificado</td>
                  <td className="tabla__numero">{usd(r.A.usd)}</td>
                  <td className="tabla__numero">{ars(r.A.ars)}</td>
                  <td className="tabla__numero">{pct(p.formal)}</td>
                </tr>
                <tr>
                  <td>Aporte B · Compromiso de deuda</td>
                  <td className="tabla__numero">{usd(r.B.usd)}</td>
                  <td className="tabla__numero">{ars(r.B.ars)}</td>
                  <td className="tabla__numero">{pct(1 - p.formal)}</td>
                </tr>
              </tbody>
            </table>
          )}

          <div className={`propuesta-doc__planes${p.mostrarB ? "" : " propuesta-doc__planes--uno"}`}>
            {planes.map((plan) => (
              <div key={plan.titulo} className="propuesta-doc__plan">
                <header>
                  <span>{plan.titulo}</span>
                  {plan.subtitulo && <small>{plan.subtitulo}</small>}
                </header>
                <dl>
                  {plan.lineas.map((l) => (
                    <div key={l.concepto} className={l.clase}>
                      <dt>
                        {l.concepto}
                        {l.detalle && <small>{l.detalle}</small>}
                      </dt>
                      <dd>
                        {l.monto}
                        {l.aparte && <small>{l.aparte}</small>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          <h3 className="propuesta-doc__subtitulo">Detalle mes a mes</h3>
          <table className="propuesta-doc__tabla">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Concepto</th>
                {p.mostrarB && <th>Parte</th>}
                <th className="tabla__numero">Monto</th>
                <th className="tabla__numero">Total del mes</th>
              </tr>
            </thead>
            <tbody>
              {porMes.map(({ mes, lineas, total }) =>
                lineas.map((l, i) => (
                  <tr key={`${mes}-${l.concepto}-${l.parte}`} className={i === lineas.length - 1 ? "propuesta-doc__fin-mes" : undefined}>
                    {i === 0 && <td rowSpan={lineas.length}>{mes ? mesCorto(mes) : "Firma"}</td>}
                    <td>{l.concepto}</td>
                    {p.mostrarB && (
                      <td>
                        <span className={`propuesta-doc__parte propuesta-doc__parte--${l.parte}`}>{l.parte}</span>
                      </td>
                    )}
                    <td className="tabla__numero">{l.moneda === "USD" ? usd(l.monto) : ars(l.monto)}</td>
                    {i === 0 && (
                      <td className="tabla__numero propuesta-doc__total-mes" rowSpan={lineas.length}>
                        {lineas.every((x) => x.moneda === "USD") ? usd(total) : lineas.every((x) => x.moneda === "ARS") ? ars(total) : "—"}
                      </td>
                    )}
                  </tr>
                )),
              )}
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
