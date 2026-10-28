import type { EgresoPrevio, Historial, IngresoPrevio } from "../invoice/completar";
import { claveEgreso, claveIngreso, familiaDeTexto, parseNumero } from "../invoice/tipos";
import { normalizeCuit } from "../validation/cuit";

/** Lo que ya está cargado en la planilla: para detectar duplicados y proponer datos. */
export interface Registros {
  historial: Historial;
  claves: Set<string>;
}

/** Primera fila de datos (la 1 tiene los encabezados). */
export const PRIMERA_FILA = 2;

/** Columnas que se leen de cada pestaña. */
export const RANGO_EGRESOS = "C2:I"; // Tipo, Nº, Razón Social, Rubro, CUIT, Concepto, Corresponde a
export const RANGO_INGRESOS = "C2:H"; // Tipo, Nº, Cliente, Tipo de Pago, CUIT Receptor, Depto

const celda = (fila: string[], i: number) => (fila[i] ?? "").trim();

/**
 * Arma el historial y las claves de duplicado a partir de los valores de las dos pestañas
 * (los rangos de arriba, como los devuelve la API de Sheets). Las filas sin número de
 * comprobante, o de egresos sin CUIT, no cuentan para los duplicados.
 */
export function leerRegistros(egresos: string[][], ingresos: string[][]): Registros {
  const claves = new Set<string>();
  const historialEgresos: EgresoPrevio[] = [];
  const historialIngresos: IngresoPrevio[] = [];

  egresos.forEach((f, i) => {
    const [tipo, numero, razon_social, rubro, cuit, concepto, corresponde_a] = [0, 1, 2, 3, 4, 5, 6].map((c) => celda(f, c));
    const n = parseNumero(numero);
    const digitos = normalizeCuit(cuit);
    if (n && digitos.length === 11) claves.add(claveEgreso(digitos, familiaDeTexto(tipo), n.punto_venta, n.numero));
    if (digitos) historialEgresos.push({ fila: PRIMERA_FILA + i, cuit: digitos, razon_social, rubro, concepto, corresponde_a });
  });

  ingresos.forEach((f, i) => {
    const [tipo, numero, cliente, tipo_pago, cuit_receptor, depto] = [0, 1, 2, 3, 4, 5].map((c) => celda(f, c));
    const n = parseNumero(numero);
    if (n) claves.add(claveIngreso(familiaDeTexto(tipo), n.punto_venta, n.numero));
    const digitos = normalizeCuit(cuit_receptor);
    if (digitos) historialIngresos.push({ fila: PRIMERA_FILA + i, cuit_receptor: digitos, cliente, tipo_pago, depto });
  });

  return { historial: { egresos: historialEgresos, ingresos: historialIngresos }, claves };
}
