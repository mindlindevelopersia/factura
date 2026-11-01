"use client";

import { useEffect, useMemo, useState } from "react";
import { alarmasDe, hoyBA, temperatura, temperaturaSugerida, unidadesPara } from "@/lib/crm/alarmas";
import { linkWhatsapp, mensajeSugerido, ZOHO_MAIL } from "@/lib/crm/mensajes";
import {
  abierto,
  DESCRIPCION_ETAPA,
  claseEtapa,
  ETAPAS,
  FORMAS_DE_PAGO,
  MOTIVOS_PERDIDA,
  NOMBRE_TEMPERATURA,
  ORIGENES,
  PLAZOS,
  TIPOS_ACTIVIDAD,
  TIPOS_CONTACTO,
  USOS,
  type CambiosContacto,
  type Contacto,
  type Etapa,
  type Temperatura,
} from "@/lib/crm/modelo";
import { telefonoWhatsapp } from "@/lib/inversores/cobranzas";
import { PROYECTOS, proyecto as buscarProyecto } from "@/lib/modulos";
import Link from "next/link";
import { Icono } from "../Icono";
import { useBaseProyecto } from "../proyecto";
import { fechaCorta, sumarDias, usd, type Crm } from "./datos";

export function ChipTemperatura({ t, manual }: { t: Temperatura | null; manual?: boolean }) {
  if (!t) return null;
  return (
    <span className={`crm-temp crm-temp--${t}`} title={manual ? "Puesta a mano" : "Calculada por el hub"}>
      {t === "hot" ? "🔥 " : t === "frio" ? "❄️ " : "🌤 "}
      {NOMBRE_TEMPERATURA[t]}
      {manual && " ✋"}
    </span>
  );
}

/** La ficha de un contacto: contactarlo, registrar lo que pasó con el próximo paso, sus datos y su historial. */
export function Ficha({ crm, id, cerrar }: { crm: Crm; id: string; cerrar: () => void }) {
  const c = crm.contactos.find((x) => x.id === id) ?? crm.datos?.contactos.find((x) => x.id === id);
  if (!c || !crm.datos) return null;
  return <Contenido key={c.id} crm={crm} c={c} cerrar={cerrar} />;
}

function Contenido({ crm, c, cerrar }: { crm: Crm; c: Contacto; cerrar: () => void }) {
  const datos = crm.datos!;
  const hoy = hoyBA(new Date(datos.ahora));
  const proyecto = buscarProyecto(crm.proyecto)?.nombre ?? "el proyecto";
  const temp = temperatura(c, hoy, crm.precioMinimo);
  const sirven = useMemo(() => unidadesPara(c, datos.unidades), [c, datos.unidades]);
  const alarmas = alarmasDe(c, datos.ahora, crm.precioMinimo, crm.estados);
  const historial = datos.actividad.filter((a) => a.contactoId === c.id);
  const baseProyecto = useBaseProyecto();

  // Mensaje
  const plantilla = useMemo(() => mensajeSugerido(c, sirven, proyecto, datos.usuario), [c, sirven, proyecto, datos.usuario]);
  const [canal, setCanal] = useState<"whatsapp" | "mail">(c.telefono ? "whatsapp" : "mail");
  const [whatsapp, setWhatsapp] = useState(plantilla.whatsapp);
  const [asunto, setAsunto] = useState(plantilla.asunto);
  const [mail, setMail] = useState(plantilla.mail);
  const [indicacion, setIndicacion] = useState("");
  const [pidiendo, setPidiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Registro
  const [tipo, setTipo] = useState<string>("Llamada");
  const [detalle, setDetalle] = useState("");
  const [etapa, setEtapa] = useState<Etapa>(c.etapa);
  const [motivo, setMotivo] = useState(c.motivoPerdida);
  const [volver, setVolver] = useState(c.volverAContactar ?? "");
  const [paso, setPaso] = useState(c.proximoPaso);
  const [fecha, setFecha] = useState(c.proximaFecha ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendida, setVendida] = useState(c.unidadVendida || c.unidades[0] || "");
  const precioDe = (cod: string) => datos.unidades.find((u) => u.codigo === cod)?.precioUsd ?? null;
  const [precioVenta, setPrecioVenta] = useState(c.precioVentaUsd != null ? String(c.precioVentaUsd) : String(precioDe(c.unidadVendida || c.unidades[0] || "") ?? ""));

  // Datos
  const [perfil, setPerfil] = useState<CambiosContacto>({});
  const valor = <K extends keyof CambiosContacto>(k: K) => (k in perfil ? perfil[k] : (c[k as keyof Contacto] as CambiosContacto[K]));
  const cambiar = (k: keyof CambiosContacto, v: unknown) => setPerfil((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [cerrar]);

  const sigueAbierto = abierto({ etapa }) || etapa === "Dormido";
  async function registrar() {
    if (sigueAbierto && (!paso.trim() || !fecha)) {
      setError("Definí el próximo paso y su fecha: ningún contacto abierto queda sin próximo paso.");
      return;
    }
    if (etapa === "Perdido" && !motivo) {
      setError("Elegí el motivo de pérdida.");
      return;
    }
    if (etapa === "Vendido" && (!vendida || !Number(precioVenta.replace(/\D/g, "")))) {
      setError("Decí qué unidad compró y a cuánto, para cruzarlo con la Lista de precios.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await crm.actualizar(
        c.id,
        {
          etapa,
          proximoPaso: sigueAbierto ? paso.trim() : "",
          proximaFecha: sigueAbierto ? fecha : null,
          ...(etapa === "Perdido" ? { motivoPerdida: motivo, volverAContactar: volver || null } : {}),
          ...(etapa === "Vendido" ? { unidadVendida: vendida, precioVentaUsd: Number(precioVenta.replace(/\D/g, "")) } : {}),
        },
        { tipo, detalle },
      );
      setDetalle("");
      setAviso("Guardado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarPerfil() {
    setGuardando(true);
    setError(null);
    try {
      await crm.actualizar(c.id, perfil);
      setPerfil({});
      setAviso("Datos guardados.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  async function pedirAOliver() {
    setPidiendo(true);
    setAviso(null);
    try {
      const m = await crm.mensajeIa(c.id, indicacion);
      if (m.whatsapp) setWhatsapp(m.whatsapp);
      if (m.asunto) setAsunto(m.asunto);
      if (m.mail) setMail(m.mail);
      setAviso("Oliver propuso un mensaje: revisalo antes de mandarlo.");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
    } finally {
      setPidiendo(false);
    }
  }

  const wa = c.telefono ? linkWhatsapp(c.telefono, whatsapp, telefonoWhatsapp) : null;
  const abrirMail = async () => {
    const texto = `Para: ${c.mail}\nAsunto: ${asunto}\n\n${mail}`;
    try {
      await navigator.clipboard.writeText(texto);
      setAviso("Copié el mail (destinatario, asunto y texto): pegalo en Zoho.");
    } catch {
      setAviso("No pude copiar el mail: copialo a mano.");
    }
    window.open(ZOHO_MAIL, "_blank", "noopener");
    setTipo("Mail");
    setDetalle(`Le mandé un mail: "${asunto}".`);
  };

  return (
    <div className="crm-ficha__fondo" onClick={cerrar}>
      <aside className="crm-ficha" aria-label={`Ficha de ${c.nombre}`} onClick={(e) => e.stopPropagation()}>
        <header className="crm-ficha__encabezado">
          <div>
            <h2>{c.nombre}</h2>
            <span>
              <span className={`crm-etapa crm-etapa--${claseEtapa(c.etapa)}`}>{c.etapa}</span> <ChipTemperatura t={temp} manual={!!c.temperaturaManual} />
              {c.origen && <span className="crm-ficha__sub"> · {c.origen}{c.referido ? ` (${c.referido})` : ""}</span>}
            </span>
          </div>
          <button type="button" className="oliver__accion crm-ficha__cerrar" onClick={cerrar} aria-label="Cerrar la ficha">
            <Icono nombre="cerrar" size={18} />
          </button>
        </header>

        <div className="crm-ficha__cuerpo">
          {alarmas.length > 0 && (
            <ul className="crm-alarmas crm-alarmas--ficha">
              {alarmas.map((a, i) => (
                <li key={i} className={`crm-alarma crm-alarma--${a.nivel}`}>
                  <Icono nombre="alerta" size={14} /> {a.texto}
                </li>
              ))}
            </ul>
          )}
          {c.etapa === "Vendido" && (
            <section className="crm-ficha__seccion crm-ficha__venta">
              <h3>
                Vendida{c.unidadVendida ? ` la ${c.unidadVendida}` : ""}
                {c.precioVentaUsd ? ` en ${usd(c.precioVentaUsd)}` : ""}
              </h3>
              <p className="crm-ficha__sub">Para que figure en todo el hub, Tadeo tiene que cargarla en las planillas (el hub las lee, no las escribe):</p>
              <ul>
                <li className={crm.estados.find((u) => u.codigo === c.unidadVendida)?.estado === "vendida" ? "crm-hecho" : undefined}>
                  &quot;Lista de precios&quot; del Excel madre: Estado <strong>Vendido</strong> e inversor
                  {crm.estados.find((u) => u.codigo === c.unidadVendida)?.estado === "vendida" ? " ✓" : " (todavía figura libre)"}
                </li>
                <li>&quot;Ventas&quot;: la fila del machete y la ficha de la operación (costo, blanco y negro, base CAC)</li>
                <li>&quot;Pagos por Inversor&quot;: su bloque, con el costo estimado y los pagos</li>
                <li>Flujo de fondos: su fila con anticipo, cuotas y refuerzos</li>
              </ul>
            </section>
          )}
          <p className="crm-ficha__estado">
            {c.proximaFecha ? (
              <>
                <strong>Próximo paso:</strong> {c.proximoPaso || "—"} · {fechaCorta(c.proximaFecha)}
              </>
            ) : (
              <span>{DESCRIPCION_ETAPA[c.etapa]}</span>
            )}
          </p>

          <section className="crm-ficha__seccion">
            <h3>Escribirle</h3>
            <div className="crm-ficha__canales">
              <button type="button" className={`btn btn--chico ${canal === "whatsapp" ? "btn--primario" : "btn--borde"}`} onClick={() => setCanal("whatsapp")}>
                WhatsApp
              </button>
              <button type="button" className={`btn btn--chico ${canal === "mail" ? "btn--primario" : "btn--borde"}`} onClick={() => setCanal("mail")}>
                Mail
              </button>
              {c.telefono && (
                <a className="btn btn--chico btn--borde" href={`tel:${c.telefono.replace(/[^\d+]/g, "")}`}>
                  Llamar
                </a>
              )}
              <Link className="btn btn--chico btn--borde" href={`${baseProyecto}/comercial/propuesta?contacto=${c.id}${c.unidades[0] ? `&unidad=${c.unidades[0]}` : ""}`}>
                Armar propuesta
              </Link>
            </div>
            {canal === "whatsapp" ? (
              <textarea className="crm-ficha__mensaje" rows={5} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            ) : (
              <>
                <input className="crm-ficha__asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} aria-label="Asunto" />
                <textarea className="crm-ficha__mensaje" rows={7} value={mail} onChange={(e) => setMail(e.target.value)} />
              </>
            )}
            <div className="crm-ficha__ia">
              <input value={indicacion} onChange={(e) => setIndicacion(e.target.value)} placeholder="Indicación para Oliver (opcional): “ofrecele la 2C”, “más formal”…" />
              <button type="button" className="btn btn--borde btn--chico" onClick={() => void pedirAOliver()} disabled={pidiendo}>
                {pidiendo ? "Pensando…" : "✨ Pedir a Oliver"}
              </button>
            </div>
            <div className="crm-ficha__canales">
              {canal === "whatsapp" ? (
                wa ? (
                  <a
                    className="btn btn--primario btn--chico"
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      setTipo("WhatsApp");
                      setDetalle(`Le escribí: "${whatsapp.slice(0, 140)}${whatsapp.length > 140 ? "…" : ""}"`);
                    }}
                  >
                    Abrir WhatsApp
                  </a>
                ) : (
                  <span className="crm-ficha__sub">Cargá un teléfono para escribirle por WhatsApp.</span>
                )
              ) : c.mail ? (
                <button type="button" className="btn btn--primario btn--chico" onClick={() => void abrirMail()}>
                  Abrir Zoho Mail (copio el mail)
                </button>
              ) : (
                <span className="crm-ficha__sub">Cargá un mail para escribirle.</span>
              )}
              <button
                type="button"
                className="btn btn--texto btn--chico"
                onClick={() => {
                  setWhatsapp(plantilla.whatsapp);
                  setAsunto(plantilla.asunto);
                  setMail(plantilla.mail);
                }}
              >
                Volver a la plantilla
              </button>
            </div>
            {aviso && <p className="crm-ficha__aviso">{aviso}</p>}
          </section>

          <section className="crm-ficha__seccion">
            <h3>Registrar qué pasó</h3>
            <div className="crm-ficha__fila">
              <label className="campo">
                Qué hiciste
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  {TIPOS_ACTIVIDAD.filter((t) => t !== "Cambio de etapa").map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="campo">
                Etapa
                <select value={etapa} onChange={(e) => setEtapa(e.target.value as Etapa)}>
                  {ETAPAS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="campo">
              Qué pasó
              <textarea rows={3} value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Qué te dijo, qué le mandaste, qué quedó pendiente…" />
            </label>
            {etapa === "Perdido" && (
              <div className="crm-ficha__fila">
                <label className="campo">
                  Motivo
                  <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                    <option value="">Elegí…</option>
                    {MOTIVOS_PERDIDA.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  Volver a contactar
                  <input type="date" value={volver} onChange={(e) => setVolver(e.target.value)} />
                </label>
              </div>
            )}
            {etapa === "Vendido" && (
              <div className="crm-ficha__fila">
                <label className="campo">
                  Unidad que compró
                  <select
                    value={vendida}
                    onChange={(e) => {
                      setVendida(e.target.value);
                      const p = precioDe(e.target.value);
                      if (p) setPrecioVenta(String(Math.round(p)));
                    }}
                  >
                    <option value="">Elegí…</option>
                    {crm.estados.map((u) => (
                      <option key={u.codigo} value={u.codigo}>
                        {u.codigo} · {u.estado === "libre" ? "libre" : u.reventa ? "reventa" : `vendida${u.inversor ? ` a ${u.inversor}` : ""}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  Precio de venta (US$)
                  <input inputMode="numeric" value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} />
                </label>
              </div>
            )}
            {sigueAbierto && (
              <>
                <label className="campo">
                  Próximo paso
                  <input value={paso} onChange={(e) => setPaso(e.target.value)} placeholder="Ej.: mandarle la propuesta de la 2C" />
                </label>
                <div className="crm-ficha__fila crm-ficha__fecha">
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha del próximo paso" />
                  {[
                    ["Mañana", 1],
                    ["2 días", 2],
                    ["1 semana", 7],
                    ["1 mes", 30],
                  ].map(([t, n]) => (
                    <button key={t} type="button" className="btn btn--borde btn--chico" onClick={() => setFecha(sumarDias(hoy, Number(n)))}>
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
            {error && (
              <p role="alert" className="oliver__error">
                {error}
              </p>
            )}
            <button type="button" className="btn btn--primario" onClick={() => void registrar()} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </section>

          {sirven.length > 0 && (
            <section className="crm-ficha__seccion">
              <h3>Unidades que le sirven</h3>
              <ul className="crm-unidades">
                {sirven.slice(0, 6).map((u) => {
                  const elegida = (valor("unidades") as string[]).includes(u.codigo);
                  return (
                    <li key={u.codigo}>
                      <span>
                        <strong>{u.codigo}</strong> · {u.tipologia} · {Math.round(u.m2)} m² · {usd(u.precioUsd)}
                        {u.tipo === "reventa" && " · reventa"}
                      </span>
                      <button
                        type="button"
                        className="btn btn--texto btn--chico"
                        onClick={() => {
                          const actuales = valor("unidades") as string[];
                          cambiar("unidades", elegida ? actuales.filter((x) => x !== u.codigo) : [...actuales, u.codigo]);
                        }}
                      >
                        {elegida ? "Quitar" : "Le interesa"}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="crm-ficha__sub">Según su presupuesto{c.ambientes ? ` y ${c.ambientes.toLowerCase()}` : ""}, de las libres y en reventa (precio de lista vigente).</p>
            </section>
          )}

          <section className="crm-ficha__seccion">
            <h3>Datos</h3>
            <div className="crm-ficha__grilla">
              <Campo etiqueta="Nombre" valor={valor("nombre") as string} poner={(v) => cambiar("nombre", v)} />
              <Campo etiqueta="Teléfono" valor={valor("telefono") as string} poner={(v) => cambiar("telefono", v)} />
              <Campo etiqueta="Mail" valor={valor("mail") as string} poner={(v) => cambiar("mail", v)} />
              <Elegir etiqueta="Tipo" valor={valor("tipo") as string} opciones={TIPOS_CONTACTO} poner={(v) => cambiar("tipo", v)} />
              <Elegir etiqueta="Origen" valor={valor("origen") as string} opciones={ORIGENES} poner={(v) => cambiar("origen", v)} />
              <Campo etiqueta="Referido por" valor={valor("referido") as string} poner={(v) => cambiar("referido", v)} />
              <Campo
                etiqueta="Presupuesto (US$)"
                valor={valor("presupuestoUsd") != null ? String(valor("presupuestoUsd")) : ""}
                poner={(v) => cambiar("presupuestoUsd", Number(v.replace(/\D/g, "")) || null)}
              />
              <Campo etiqueta="Ambientes" valor={valor("ambientes") as string} poner={(v) => cambiar("ambientes", v)} />
              <Elegir etiqueta="Forma de pago" valor={valor("formaPago") as string} opciones={FORMAS_DE_PAGO} poner={(v) => cambiar("formaPago", v)} />
              <Elegir etiqueta="Plazo para decidir" valor={valor("plazo") as string} opciones={PLAZOS} poner={(v) => cambiar("plazo", v)} />
              <Elegir etiqueta="Para" valor={valor("uso") as string} opciones={USOS} poner={(v) => cambiar("uso", v)} />
              <label className="campo">
                Temperatura
                <select value={(valor("temperaturaManual") as string | null) ?? ""} onChange={(e) => cambiar("temperaturaManual", e.target.value || null)}>
                  <option value="">Automática ({temperaturaSugerida(c, hoy, crm.precioMinimo) ? NOMBRE_TEMPERATURA[temperaturaSugerida(c, hoy, crm.precioMinimo)!] : "—"})</option>
                  <option value="hot">Hot (a mano)</option>
                  <option value="tibio">Tibio (a mano)</option>
                  <option value="frio">Frío (a mano)</option>
                </select>
              </label>
              <Campo etiqueta="Unidades de interés" valor={(valor("unidades") as string[]).join(", ")} poner={(v) => cambiar("unidades", v.split(/[,;\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))} />
              <Elegir etiqueta="Responsable" valor={valor("responsable") as string} opciones={["Mati", "Tade"]} poner={(v) => cambiar("responsable", v)} />
            </div>
            <fieldset className="crm-ficha__proyectos">
              <legend>Proyectos que le interesan</legend>
              {PROYECTOS.map((p) => {
                const actuales = (valor("proyectos") as string[]) ?? [];
                return (
                  <label key={p.id}>
                    <input
                      type="checkbox"
                      checked={actuales.includes(p.id)}
                      onChange={(e) => cambiar("proyectos", e.target.checked ? [...actuales, p.id] : actuales.filter((x) => x !== p.id))}
                    />{" "}
                    {p.nombre}
                    {p.estado === "bloqueado" && " (en preparación)"}
                  </label>
                );
              })}
            </fieldset>
            <label className="campo">
              Notas
              <textarea rows={3} value={valor("notas") as string} onChange={(e) => cambiar("notas", e.target.value)} />
            </label>
            <button type="button" className="btn btn--borde" onClick={() => void guardarPerfil()} disabled={guardando || !Object.keys(perfil).length}>
              Guardar datos
            </button>
          </section>

          <section className="crm-ficha__seccion">
            <h3>Historial ({historial.length})</h3>
            {historial.length === 0 ? (
              <p className="crm-ficha__sub">Sin actividad registrada.</p>
            ) : (
              <ol className="crm-historial">
                {historial.map((a, i) => (
                  <li key={i}>
                    <span className="crm-historial__cuando">
                      {fechaCorta(a.fecha.slice(0, 10))} · {a.usuario || "—"} · {a.tipo}
                    </span>
                    {a.detalle && <p>{a.detalle}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function Campo({ etiqueta, valor, poner }: { etiqueta: string; valor: string; poner: (v: string) => void }) {
  return (
    <label className="campo">
      {etiqueta}
      <input value={valor ?? ""} onChange={(e) => poner(e.target.value)} />
    </label>
  );
}

function Elegir({ etiqueta, valor, opciones, poner }: { etiqueta: string; valor: string; opciones: readonly string[]; poner: (v: string) => void }) {
  return (
    <label className="campo">
      {etiqueta}
      <select value={valor ?? ""} onChange={(e) => poner(e.target.value)}>
        <option value="">—</option>
        {[...new Set([...opciones, ...(valor && !opciones.includes(valor) ? [valor] : [])])].map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
