import type { PestaniaSimple } from "../google/pestania";

/**
 * El registro de avisos de cobranza: a quién se le avisó, cuándo, quién y qué respondió. Vive en la
 * pestaña "Cobranzas" de la planilla de la cola (COLA_SHEET_ID), no en la contable. Solo se agregan
 * filas; nunca se modifican ni se borran.
 */
export const COLUMNAS_AVISOS = ["Fecha", "Usuario", "Cuenta", "Inversor", "Unidad", "Canal", "Estado", "Monto", "Nota"] as const;
export const ESTADOS_AVISO = ["Avisado", "Prometió pagar", "Dice que ya pagó", "Sin respuesta", "Pagó", "Otro"] as const;
export const CANALES_AVISO = ["WhatsApp", "Mail", "Teléfono", "En persona"] as const;

export interface AvisoCobranza {
  /** ISO. */
  fecha: string;
  usuario: string;
  cuenta: string;
  inversor: string;
  unidad: string;
  canal: string;
  estado: string;
  monto: string;
  nota: string;
}

export function avisoDeFila(f: string[]): AvisoCobranza {
  const [fecha, usuario, cuenta, inversor, unidad, canal, estado, monto, nota] = COLUMNAS_AVISOS.map((_, i) => f[i] ?? "");
  return { fecha, usuario, cuenta, inversor, unidad, canal, estado, monto, nota };
}

export function filaDeAviso(a: AvisoCobranza): string[] {
  return [a.fecha, a.usuario, a.cuenta, a.inversor, a.unidad, a.canal, a.estado, a.monto, a.nota];
}

/** Valida lo que llega de la pantalla. Devuelve el error, o null. */
export function validarAviso(a: Partial<AvisoCobranza>): string | null {
  if (!a.cuenta || !a.inversor) return "Falta la cuenta.";
  if (!a.estado || !(ESTADOS_AVISO as readonly string[]).includes(a.estado)) return "Estado inválido.";
  if (!a.canal || !(CANALES_AVISO as readonly string[]).includes(a.canal)) return "Canal inválido.";
  if ((a.nota ?? "").length > 500) return "La nota es demasiado larga (máximo 500 caracteres).";
  return null;
}

export class RegistroAvisos {
  constructor(private readonly pestania: PestaniaSimple) {}

  /** Todos los avisos, del más nuevo al más viejo. */
  async listar(): Promise<AvisoCobranza[]> {
    return (await this.pestania.filas())
      .filter((f) => f.some((v) => v))
      .map(avisoDeFila)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  async agregar(a: AvisoCobranza): Promise<void> {
    await this.pestania.agregar(filaDeAviso(a));
  }
}

/** El último aviso de cada cuenta. */
export function ultimoPorCuenta(avisos: AvisoCobranza[]): Map<string, AvisoCobranza> {
  const r = new Map<string, AvisoCobranza>();
  for (const a of avisos) if (!r.has(a.cuenta) || r.get(a.cuenta)!.fecha < a.fecha) r.set(a.cuenta, a);
  return r;
}
