import datos from "../config/empresa.json";

export interface Socio {
  cuit: string;
  nombre: string;
}

/**
 * Datos de Mindlin que la app necesita para clasificar los comprobantes.
 * - cuit: si el emisor es Mindlin, el comprobante es una venta.
 * - socios: si el emisor es un socio, son honorarios de administración.
 * - corresponde_a: valores de la columna "Corresponde a" de la planilla de egresos.
 */
export interface Empresa {
  cuit: string;
  socios: Socio[];
  corresponde_a: string[];
}

export const EMPRESA: Empresa = datos as Empresa;
