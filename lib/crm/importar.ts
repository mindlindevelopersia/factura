/**
 * Importa la pestaña "CRM" del Excel madre (Nombre y apellido, Mail, Type, Stage, Last contacted,
 * Next date FU, Source, Situación) al CRM del hub. Se hace una vez: los que ya están (mismo nombre)
 * no se repiten. Todo puro (sin red).
 */

import type { Celda } from "../finanzas/ingresos";
import { nuevoId, type Contacto, type Etapa, type Temperatura } from "./modelo";

const normalizar = (t: unknown) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Serial de Sheets (días desde 1899-12-30) o texto a "AAAA-MM-DD". */
function fecha(c: Celda | undefined): string | null {
  const v = c?.valor;
  if (typeof v === "number" && v > 30000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86_400_000).toISOString().slice(0, 10);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
}

/** Las etapas de la planilla, en las del hub. */
export function etapaDePlanilla(stage: string): { etapa: Etapa; temperatura: Temperatura | null } {
  const s = normalizar(stage);
  if (s === "sold") return { etapa: "Vendido", temperatura: null };
  if (s === "churn") return { etapa: "Perdido", temperatura: null };
  if (s === "follow up") return { etapa: "Interesado", temperatura: null };
  if (s === "contactado") return { etapa: "Contactado", temperatura: null };
  if (s === "hot") return { etapa: "Interesado", temperatura: "hot" };
  if (s === "cold") return { etapa: "Dormido", temperatura: "frio" };
  // Sin etapa: son contactos viejos sin seguimiento.
  return { etapa: "Dormido", temperatura: null };
}

function origenDe(source: string): { origen: string; referido: string } {
  const s = normalizar(source);
  if (!s) return { origen: "", referido: "" };
  if (s.includes("linkedin")) return { origen: "LinkedIn", referido: "" };
  if (s.includes("pauta")) return { origen: "Pauta", referido: "" };
  if (s.includes("instagram")) return { origen: "Instagram", referido: "" };
  if (s.startsWith("ia")) return { origen: "Otro", referido: source.trim() };
  if (s.startsWith("mati mindlin")) return { origen: "Base propia", referido: "" };
  return { origen: "Referido", referido: source.trim() };
}

const SIN_FECHA = "2023-03-01T12:00:00.000Z";

export function importarCrm(filas: Celda[][], existentes: Pick<Contacto, "nombre">[], proyecto: string, ahora: string, hoy: string): Contacto[] {
  const ya = new Set(existentes.map((c) => normalizar(c.nombre)));
  const h = filas.findIndex((f) => normalizar(f[0]?.valor).startsWith("nombre"));
  const nuevos: Contacto[] = [];
  for (let r = h + 1; r < filas.length; r++) {
    const f = filas[r];
    const nombre = String(f[0]?.valor ?? "").trim();
    if (!nombre || ya.has(normalizar(nombre))) continue;
    ya.add(normalizar(nombre));
    const deLaPlanilla = etapaDePlanilla(String(f[3]?.valor ?? ""));
    const { origen, referido } = origenDe(String(f[6]?.valor ?? ""));
    const ultimo = fecha(f[4]);
    const diasSinHablar = ultimo ? (Date.parse(hoy) - Date.parse(ultimo)) / 86_400_000 : Infinity;
    // Un seguimiento abierto sin contacto hace más de 4 meses es, en realidad, un dormido.
    const viejo = diasSinHablar > 120 && ["Contactado", "Interesado"].includes(deLaPlanilla.etapa);
    const etapa: Etapa = viejo ? "Dormido" : deLaPlanilla.etapa;
    // "Hot" vale si se habló hace poco; si no, la temperatura la calcula el hub.
    const temperatura = deLaPlanilla.temperatura === "hot" && diasSinHablar > 30 ? null : deLaPlanilla.temperatura;
    let proxima = fecha(f[5]);
    // Un seguimiento que quedó de hace meses no sirve como fecha: queda sin próximo paso.
    if (proxima && (etapa === "Vendido" || etapa === "Perdido" || proxima < new Date(Date.parse(hoy) - 60 * 86_400_000).toISOString().slice(0, 10))) proxima = null;
    const situacion = String(f[7]?.valor ?? "").trim();
    nuevos.push({
      id: nuevoId() + r.toString(36),
      proyectos: [proyecto],
      nombre,
      telefono: "",
      mail: String(f[1]?.valor ?? "").trim(),
      tipo: String(f[2]?.valor ?? "").trim(),
      origen,
      referido,
      etapa,
      temperaturaManual: temperatura,
      presupuestoUsd: null,
      formaPago: "",
      plazo: "",
      uso: "",
      ambientes: "",
      unidades: [],
      proximoPaso: proxima ? "Seguimiento" : "",
      proximaFecha: proxima,
      motivoPerdida: etapa === "Perdido" ? "Sin dato" : "",
      volverAContactar: null,
      notas: [viejo ? `Importado como dormido: en la planilla estaba en "${String(f[3]?.valor ?? "").trim()}".` : "", situacion && normalizar(situacion) !== "confirmado" ? situacion : ""].filter(Boolean).join(" "),
      responsable: "Mati",
      // Sin fecha en la planilla: se toma el comienzo de la planilla (marzo 2023), no hoy, para que no cuente como nuevo.
      creado: ultimo ? `${ultimo}T12:00:00.000Z` : SIN_FECHA,
      actualizado: ahora,
      entroEtapa: ultimo ? `${ultimo}T12:00:00.000Z` : SIN_FECHA,
      ultimoContacto: ultimo ? `${ultimo}T12:00:00.000Z` : null,
      unidadVendida: "",
      precioVentaUsd: null,
    });
  }
  return nuevos;
}
