/**
 * El CRM: contactos (de toda la empresa, con el proyecto que les interesa), sus etapas y su
 * historial. Vive en dos pestañas de la planilla de la cola (COLA_SHEET_ID): "CRM Contactos" (una
 * fila por contacto, que se reescribe al cambiar) y "CRM Actividad" (una fila por llamada, mensaje
 * o nota; solo se agregan). Todo lo de acá es puro (sin red). Ver docs/crm.md.
 */

export const ETAPAS = ["Nuevo", "Contactado", "Interesado", "Evaluando", "Negociando", "Vendido", "Perdido", "Dormido"] as const;
export type Etapa = (typeof ETAPAS)[number];

/** Las del embudo, en orden (Vendido, Perdido y Dormido se muestran aparte). */
export const ETAPAS_ABIERTAS: Etapa[] = ["Nuevo", "Contactado", "Interesado", "Evaluando", "Negociando"];

export const DESCRIPCION_ETAPA: Record<Etapa, string> = {
  Nuevo: "Entró y nadie le habló todavía.",
  Contactado: "Ya hablamos: hay que calificarlo (presupuesto, plazo, para qué compra, quién decide, cómo paga).",
  Interesado: "Calificado y con interés: hay que mandarle la info y la propuesta.",
  Evaluando: "Tiene una propuesta concreta y la está pensando. La propuesta vence a los 7 días.",
  Negociando: "Ajustando precio, forma de pago o refuerzos para cerrar.",
  Vendido: "Firmó el boleto.",
  Perdido: "No compró (con el motivo).",
  Dormido: "No es ahora: se le mandan novedades cada tanto.",
};

/** Cuántos días puede estar en cada etapa antes de que salte la alarma de "estancado". */
export const PLAZO_ETAPA: Partial<Record<Etapa, number>> = { Contactado: 7, Interesado: 14, Evaluando: 7, Negociando: 14 };

export const TEMPERATURAS = ["hot", "tibio", "frio"] as const;
export type Temperatura = (typeof TEMPERATURAS)[number];
export const NOMBRE_TEMPERATURA: Record<Temperatura, string> = { hot: "Hot", tibio: "Tibio", frio: "Frío" };
/** Cada cuántos días hay que hablarle según la temperatura. */
export const CADENCIA: Record<Temperatura, number> = { hot: 2, tibio: 7, frio: 30 };

export const TIPOS_CONTACTO = ["Beneficiario al costo", "Inversor tierra", "Developer", "Otro"] as const;
export const ORIGENES = ["Referido", "Pauta", "LinkedIn", "Instagram", "Broker", "Base propia", "Otro"] as const;
export const FORMAS_DE_PAGO = ["Al costo (cuotas)", "Contado", "A definir"] as const;
export const PLAZOS = ["Menos de 2 meses", "2 a 6 meses", "Más de 6 meses", "A definir"] as const;
export const USOS = ["Vivir", "Invertir", "A definir"] as const;
export const MOTIVOS_PERDIDA = ["Precio", "Ubicación", "Plazo de obra", "Desconfía del modelo al costo", "Compró en otro lado", "No califica", "No responde", "Otro", "Sin dato"] as const;
export const TIPOS_ACTIVIDAD = ["Llamada", "WhatsApp", "Mail", "Reunión", "Nota", "Cambio de etapa"] as const;
export type TipoActividad = (typeof TIPOS_ACTIVIDAD)[number];

export interface Contacto {
  id: string;
  /** "lerma-439": el proyecto que le interesa. */
  proyecto: string;
  nombre: string;
  telefono: string;
  mail: string;
  tipo: string;
  origen: string;
  referido: string;
  etapa: Etapa;
  /** La que puso una persona a mano; si está vacía, la calcula el hub. */
  temperaturaManual: Temperatura | null;
  presupuestoUsd: number | null;
  formaPago: string;
  plazo: string;
  uso: string;
  ambientes: string;
  /** Códigos de unidad ("2D, 5B"). */
  unidades: string[];
  proximoPaso: string;
  /** "2026-11-04". */
  proximaFecha: string | null;
  motivoPerdida: string;
  /** Para los perdidos: cuándo volver a intentar. */
  volverAContactar: string | null;
  notas: string;
  responsable: string;
  /** ISO. */
  creado: string;
  actualizado: string;
  entroEtapa: string;
  ultimoContacto: string | null;
}

export interface Actividad {
  /** ISO. */
  fecha: string;
  usuario: string;
  contactoId: string;
  contacto: string;
  tipo: TipoActividad | string;
  detalle: string;
  etapa: string;
}

export const COLUMNAS_CONTACTOS = [
  "ID",
  "Proyecto",
  "Nombre",
  "Teléfono",
  "Mail",
  "Tipo",
  "Origen",
  "Referido por",
  "Etapa",
  "Temperatura (a mano)",
  "Presupuesto USD",
  "Forma de pago",
  "Plazo",
  "Para",
  "Ambientes",
  "Unidades de interés",
  "Próximo paso",
  "Fecha próximo paso",
  "Motivo de pérdida",
  "Volver a contactar",
  "Notas",
  "Responsable",
  "Creado",
  "Actualizado",
  "Entró a la etapa",
  "Último contacto",
] as const;

export const COLUMNAS_ACTIVIDAD = ["Fecha", "Usuario", "Contacto ID", "Contacto", "Tipo", "Detalle", "Etapa"] as const;

const etapaValida = (t: string): Etapa => ((ETAPAS as readonly string[]).includes(t) ? (t as Etapa) : "Nuevo");
const temperaturaValida = (t: string): Temperatura | null => ((TEMPERATURAS as readonly string[]).includes(t) ? (t as Temperatura) : null);
const numero = (t: string) => {
  const n = Number(String(t).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
  return t && Number.isFinite(n) && n > 0 ? n : null;
};

export function contactoDeFila(f: string[]): Contacto {
  const v = (i: number) => (f[i] ?? "").trim();
  return {
    id: v(0),
    proyecto: v(1),
    nombre: v(2),
    telefono: v(3),
    mail: v(4),
    tipo: v(5),
    origen: v(6),
    referido: v(7),
    etapa: etapaValida(v(8)),
    temperaturaManual: temperaturaValida(v(9)),
    presupuestoUsd: numero(v(10)),
    formaPago: v(11),
    plazo: v(12),
    uso: v(13),
    ambientes: v(14),
    unidades: v(15)
      .split(/[,;\s]+/)
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean),
    proximoPaso: v(16),
    proximaFecha: v(17) || null,
    motivoPerdida: v(18),
    volverAContactar: v(19) || null,
    notas: v(20),
    responsable: v(21),
    creado: v(22),
    actualizado: v(23),
    entroEtapa: v(24) || v(22),
    ultimoContacto: v(25) || null,
  };
}

export function filaDeContacto(c: Contacto): string[] {
  return [
    c.id,
    c.proyecto,
    c.nombre,
    c.telefono,
    c.mail,
    c.tipo,
    c.origen,
    c.referido,
    c.etapa,
    c.temperaturaManual ?? "",
    c.presupuestoUsd != null ? String(c.presupuestoUsd) : "",
    c.formaPago,
    c.plazo,
    c.uso,
    c.ambientes,
    c.unidades.join(", "),
    c.proximoPaso,
    c.proximaFecha ?? "",
    c.motivoPerdida,
    c.volverAContactar ?? "",
    c.notas,
    c.responsable,
    c.creado,
    c.actualizado,
    c.entroEtapa,
    c.ultimoContacto ?? "",
  ];
}

export function actividadDeFila(f: string[]): Actividad {
  const [fecha, usuario, contactoId, contacto, tipo, detalle, etapa] = COLUMNAS_ACTIVIDAD.map((_, i) => (f[i] ?? "").trim());
  return { fecha, usuario, contactoId, contacto, tipo, detalle, etapa };
}

export function filaDeActividad(a: Actividad): string[] {
  return [a.fecha, a.usuario, a.contactoId, a.contacto, a.tipo, a.detalle, a.etapa];
}

/** Lo que se puede cambiar de un contacto desde la pantalla. */
export type CambiosContacto = Partial<Omit<Contacto, "id" | "creado" | "actualizado" | "entroEtapa" | "ultimoContacto">>;

export const fechaValida = (t: string | null | undefined) => !t || /^\d{4}-\d{2}-\d{2}$/.test(t);

/** Valida un contacto (nuevo o con cambios). Devuelve el error, o null. */
export function validarContacto(c: CambiosContacto, nuevo: boolean): string | null {
  if (nuevo && !c.nombre?.trim()) return "Falta el nombre.";
  if (c.nombre != null && c.nombre.length > 120) return "El nombre es demasiado largo.";
  if (c.etapa != null && !(ETAPAS as readonly string[]).includes(c.etapa)) return "Etapa inválida.";
  if (c.temperaturaManual != null && !(TEMPERATURAS as readonly string[]).includes(c.temperaturaManual)) return "Temperatura inválida.";
  if (!fechaValida(c.proximaFecha) || !fechaValida(c.volverAContactar)) return "Fecha inválida.";
  if (c.etapa === "Perdido" && c.motivoPerdida != null && !c.motivoPerdida.trim()) return "Falta el motivo de pérdida.";
  if ((c.notas ?? "").length > 3000 || (c.proximoPaso ?? "").length > 300) return "Texto demasiado largo.";
  if (c.mail && c.mail.length > 200) return "Mail inválido.";
  return null;
}

/** Aplica cambios: si cambia la etapa, guarda cuándo entró. */
export function aplicarCambios(c: Contacto, cambios: CambiosContacto, ahora: string): Contacto {
  const nuevo: Contacto = { ...c, ...cambios, actualizado: ahora };
  if (cambios.etapa && cambios.etapa !== c.etapa) nuevo.entroEtapa = ahora;
  // Cerrado (vendido o perdido): no queda un próximo paso colgado.
  if (nuevo.etapa === "Vendido" || nuevo.etapa === "Perdido") {
    nuevo.proximoPaso = cambios.proximoPaso ?? (cambios.etapa ? "" : nuevo.proximoPaso);
    nuevo.proximaFecha = cambios.proximaFecha ?? (cambios.etapa ? null : nuevo.proximaFecha);
  }
  return nuevo;
}

export function nuevoId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const abierto = (c: Pick<Contacto, "etapa">) => ETAPAS_ABIERTAS.includes(c.etapa);
