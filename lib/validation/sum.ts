import { CAMPOS_IMPORTE, type Invoice } from "../invoice/schema";

/** Diferencia de redondeo aceptada entre la suma de los importes y el total. */
export const TOLERANCIA_SUMA = 0.05;

export interface SumCheck {
  ok: boolean;
  suma: number;
  /** total - suma */
  diferencia: number;
}

export function checkSum(inv: Pick<Invoice, (typeof CAMPOS_IMPORTE)[number] | "total">, tolerancia = TOLERANCIA_SUMA): SumCheck {
  const suma = CAMPOS_IMPORTE.reduce((acc, campo) => acc + inv[campo], 0);
  const diferencia = Math.round((inv.total - suma) * 100) / 100;
  return { ok: Math.abs(diferencia) <= tolerancia, suma: Math.round(suma * 100) / 100, diferencia };
}
