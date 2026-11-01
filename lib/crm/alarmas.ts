/**
 * Lo que el CRM calcula solo: la temperatura de cada contacto, las alarmas ("Hablale a…"), los
 * números del dashboard y las unidades que le pueden servir a cada uno. Todo puro (sin red).
 */

import { abierto, CADENCIA, ETAPAS, ETAPAS_ABIERTAS, PLAZO_ETAPA, type Actividad, type Contacto, type Etapa, type Temperatura } from "./modelo";

const DIA = 86_400_000;

/** Días enteros entre dos fechas (ISO o "AAAA-MM-DD"), de a hasta b. */
export function dias(a: string, b: string): number {
  const d = (t: string) => Date.parse(t.length === 10 ? `${t}T12:00:00-03:00` : t);
  return Math.floor((d(b) - d(a)) / DIA);
}

/** "2026-11-01" en hora de Buenos Aires. */
export function hoyBA(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(ahora);
}

/** Desde cuándo no se habla con el contacto (o desde que entró, si nunca). */
export const ultimoTrato = (c: Contacto) => c.ultimoContacto || c.creado;

/**
 * La temperatura que sugiere el hub (la manual manda):
 * - Hot: está evaluando o negociando, o quiere decidir en menos de 2 meses, y hablamos en la última semana.
 * - Frío: hace más de 14 días que no hablamos, decide en más de 6 meses, o el presupuesto no alcanza.
 * - Tibio: el resto.
 */
export function temperaturaSugerida(c: Contacto, hoy: string, precioMinimo: number | null = null): Temperatura | null {
  if (!abierto(c) && c.etapa !== "Dormido") return null;
  if (c.etapa === "Dormido") return "frio";
  const sinHablar = dias(ultimoTrato(c), hoy);
  if (sinHablar > 14 || c.plazo === "Más de 6 meses" || (precioMinimo != null && c.presupuestoUsd != null && c.presupuestoUsd < precioMinimo * 0.9)) return "frio";
  if (sinHablar <= 7 && (c.etapa === "Evaluando" || c.etapa === "Negociando" || c.plazo === "Menos de 2 meses")) return "hot";
  return "tibio";
}

export const temperatura = (c: Contacto, hoy: string, precioMinimo: number | null = null) => c.temperaturaManual ?? temperaturaSugerida(c, hoy, precioMinimo);

export type NivelAlarma = "urgente" | "hoy" | "atencion";

export interface Alarma {
  contactoId: string;
  contacto: string;
  nivel: NivelAlarma;
  /** "Hablale a Juan: …". */
  texto: string;
  tipo: "nuevo" | "vencido" | "hoy" | "sin-paso" | "hot" | "propuesta" | "estancado" | "recontactar" | "novedades" | "cadencia";
}

const primerNombre = (n: string) => n.trim().split(/\s+/)[0] || n;
const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

/** Las alarmas de un contacto, de la más urgente a la menos. */
export function alarmasDe(c: Contacto, ahora: string, precioMinimo: number | null = null): Alarma[] {
  const hoy = hoyBA(new Date(ahora));
  const a: Alarma[] = [];
  const quien = primerNombre(c.nombre);
  const poner = (nivel: NivelAlarma, tipo: Alarma["tipo"], texto: string) => a.push({ contactoId: c.id, contacto: c.nombre, nivel, tipo, texto });
  const temp = temperatura(c, hoy, precioMinimo);
  const sinHablar = dias(ultimoTrato(c), hoy);

  if (c.etapa === "Perdido") {
    if (c.volverAContactar && c.volverAContactar <= hoy) poner("hoy", "recontactar", `Volvé a contactar a ${quien}: lo dejamos para el ${fechaCorta(c.volverAContactar)} (se perdió por: ${c.motivoPerdida || "sin motivo"}).`);
    return a;
  }
  if (c.etapa === "Vendido") return a;
  if (c.etapa === "Dormido") {
    if (sinHablar >= 45) poner("atencion", "novedades", `Mandale novedades a ${quien}: hace ${sinHablar} días que no sabe nada de nosotros.`);
    if (c.proximaFecha && c.proximaFecha <= hoy) poner("hoy", "hoy", `Hablale a ${quien}: ${c.proximoPaso || "quedó para hoy"}.`);
    return a;
  }

  const horas = (Date.parse(ahora) - Date.parse(c.creado)) / 3_600_000;
  if (c.etapa === "Nuevo" && !c.ultimoContacto && horas >= 2) {
    poner("urgente", "nuevo", `Hablale a ${quien}: entró hace ${horas < 48 ? `${Math.floor(horas)} h` : `${Math.floor(horas / 24)} días`} y nadie le habló.`);
  }
  if (c.proximaFecha && c.proximaFecha < hoy) {
    const atraso = dias(c.proximaFecha, hoy);
    poner("urgente", "vencido", `Hablale a ${quien}: ${c.proximoPaso || "el seguimiento"} era el ${fechaCorta(c.proximaFecha)} (hace ${atraso} ${atraso === 1 ? "día" : "días"}).`);
  } else if (c.proximaFecha === hoy) {
    poner("hoy", "hoy", `Hablale a ${quien} hoy: ${c.proximoPaso || "seguimiento"}.`);
  } else if (!c.proximaFecha && c.etapa !== "Nuevo") {
    poner("atencion", "sin-paso", `${quien} no tiene próximo paso: definí qué sigue y cuándo.`);
  }
  if (temp === "hot" && sinHablar > 3) poner("urgente", "hot", `${quien} está hot y hace ${sinHablar} días que no hablamos: llamá hoy.`);
  if (c.etapa === "Evaluando") {
    const enEtapa = dias(c.entroEtapa, hoy);
    if (enEtapa >= 7) poner("urgente", "propuesta", `La propuesta de ${quien} venció (la tiene hace ${enEtapa} días): cerrá o renovala.`);
    else if (enEtapa >= 5) poner("hoy", "propuesta", `La propuesta de ${quien} vence en ${7 - enEtapa} ${7 - enEtapa === 1 ? "día" : "días"}: llamá para cerrar.`);
  }
  const plazo = PLAZO_ETAPA[c.etapa];
  if (plazo != null && c.etapa !== "Evaluando" && dias(c.entroEtapa, hoy) > plazo) {
    poner("atencion", "estancado", `${quien} lleva ${dias(c.entroEtapa, hoy)} días en "${c.etapa}" (lo normal es ${plazo}): cambiá la etapa o cerrá el contacto.`);
  }
  if (temp && !c.proximaFecha && sinHablar > CADENCIA[temp] && !a.some((x) => x.tipo === "hot")) {
    poner("hoy", "cadencia", `Hablale a ${quien}: está ${temp === "frio" ? "frío" : temp} y hace ${sinHablar} días que no hablamos.`);
  }
  return a;
}

const ORDEN_NIVEL: Record<NivelAlarma, number> = { urgente: 0, hoy: 1, atencion: 2 };

export function todasLasAlarmas(contactos: Contacto[], ahora: string, precioMinimo: number | null = null): Alarma[] {
  return contactos.flatMap((c) => alarmasDe(c, ahora, precioMinimo)).sort((x, y) => ORDEN_NIVEL[x.nivel] - ORDEN_NIVEL[y.nivel]);
}

export interface Tablero {
  total: number;
  abiertos: number;
  porEtapa: Record<Etapa, number>;
  porTemperatura: Record<Temperatura, number>;
  nuevosSemana: number;
  vendidos30: number;
  seguimientos: { vencidos: number; hoy: number; semana: number };
  /** Vendidos ÷ (vendidos + perdidos). */
  conversion: number | null;
  porOrigen: { origen: string; total: number; vendidos: number }[];
  motivosPerdida: { motivo: string; total: number }[];
  actividadSemana: { usuario: string; total: number }[];
  /** Presupuesto declarado de los abiertos ponderado por etapa (aproximado). */
  pronosticoUsd: number;
}

/** Probabilidad de venta por etapa, para el pronóstico. */
export const PROBABILIDAD: Partial<Record<Etapa, number>> = { Contactado: 0.05, Interesado: 0.1, Evaluando: 0.4, Negociando: 0.6 };

export function tablero(contactos: Contacto[], actividad: Actividad[], ahora: string, precioMinimo: number | null = null): Tablero {
  const hoy = hoyBA(new Date(ahora));
  const porEtapa = Object.fromEntries(ETAPAS.map((e) => [e, 0])) as Record<Etapa, number>;
  const porTemperatura: Record<Temperatura, number> = { hot: 0, tibio: 0, frio: 0 };
  const origenes = new Map<string, { total: number; vendidos: number }>();
  const motivos = new Map<string, number>();
  let vencidos = 0;
  let deHoy = 0;
  let semana = 0;
  let pronostico = 0;
  for (const c of contactos) {
    porEtapa[c.etapa]++;
    const t = temperatura(c, hoy, precioMinimo);
    if (t && abierto(c)) porTemperatura[t]++;
    const o = origenes.get(c.origen || "Sin dato") ?? { total: 0, vendidos: 0 };
    o.total++;
    if (c.etapa === "Vendido") o.vendidos++;
    origenes.set(c.origen || "Sin dato", o);
    if (c.etapa === "Perdido") motivos.set(c.motivoPerdida || "Sin dato", (motivos.get(c.motivoPerdida || "Sin dato") ?? 0) + 1);
    if (abierto(c) && c.proximaFecha) {
      if (c.proximaFecha < hoy) vencidos++;
      else if (c.proximaFecha === hoy) deHoy++;
      else if (dias(hoy, c.proximaFecha) <= 7) semana++;
    }
    if (c.presupuestoUsd) pronostico += c.presupuestoUsd * (PROBABILIDAD[c.etapa] ?? 0);
  }
  const vendidos = porEtapa.Vendido;
  const usuarios = new Map<string, number>();
  for (const a of actividad) if (dias(a.fecha, hoy) <= 7) usuarios.set(a.usuario, (usuarios.get(a.usuario) ?? 0) + 1);
  return {
    total: contactos.length,
    abiertos: contactos.filter(abierto).length,
    porEtapa,
    porTemperatura,
    nuevosSemana: contactos.filter((c) => c.creado && dias(c.creado, hoy) <= 7).length,
    vendidos30: contactos.filter((c) => c.etapa === "Vendido" && dias(c.entroEtapa, hoy) <= 30).length,
    seguimientos: { vencidos, hoy: deHoy, semana },
    conversion: vendidos + porEtapa.Perdido ? vendidos / (vendidos + porEtapa.Perdido) : null,
    porOrigen: [...origenes].map(([origen, v]) => ({ origen, ...v })).sort((a, b) => b.total - a.total),
    motivosPerdida: [...motivos].map(([motivo, total]) => ({ motivo, total })).sort((a, b) => b.total - a.total),
    actividadSemana: [...usuarios].map(([usuario, total]) => ({ usuario, total })).sort((a, b) => b.total - a.total),
    pronosticoUsd: Math.round(pronostico),
  };
}

/** Una unidad disponible, como la necesita el CRM (de Comercial). */
export interface UnidadDisponible {
  codigo: string;
  tipologia: string;
  orientacion: string;
  m2: number;
  precioUsd: number;
  /** "libre" o "reventa" (la vende el dueño). */
  tipo: "libre" | "reventa";
}

/** Las que entran en su presupuesto (hasta un 5% arriba) y, si dijo cuántos ambientes, con esos. */
export function unidadesPara(c: Pick<Contacto, "presupuestoUsd" | "ambientes">, unidades: UnidadDisponible[]): UnidadDisponible[] {
  const amb = c.ambientes.toLowerCase();
  const pideMono = /mono/.test(amb);
  const pideN = Number(amb.match(/\d/)?.[0] ?? NaN);
  return unidades
    .filter((u) => c.presupuestoUsd == null || u.precioUsd <= c.presupuestoUsd * 1.05)
    .filter((u) => {
      if (!amb) return true;
      const t = u.tipologia.toLowerCase();
      if (pideMono) return t.includes("mono");
      return Number.isFinite(pideN) ? t.includes(`${pideN} amb`) : true;
    })
    .sort((a, b) => b.precioUsd - a.precioUsd);
}

export { ETAPAS_ABIERTAS };
