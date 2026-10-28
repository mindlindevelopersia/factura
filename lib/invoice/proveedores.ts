import datos from "../../config/proveedores.json";

/**
 * Clasificación más fina de los proveedores, de las notas del cliente ("le pedí una
 * clasificación a GPT que puede servir"). La planilla no la usa: su columna "Rubro /
 * Descripción" lleva la descripción fiscal (config/rubros.json). La app la propone en la
 * ficha y la escribe solo si la pestaña tiene una columna "Rubro detallado".
 */
export interface ProveedorClasificado {
  razon_social: string;
  rubro_detalle: string;
}

export const PROVEEDORES: ProveedorClasificado[] = datos;

export const RUBROS_DETALLE: string[] = [...new Set(PROVEEDORES.map((p) => p.rubro_detalle))].sort((a, b) =>
  a.localeCompare(b, "es"),
);

const SUFIJOS_SOCIETARIOS = /\b(s ?a ?s|s ?a ?u|s ?a|s ?r ?l|s ?a ?c ?i ?f ?i ?a|s ?h|s ?c ?a|srl|sa|sas|sau)\b/g;

/** Razón social sin acentos, puntuación ni tipo societario: "COSTA MATERIALES S.A." pasa a "costa materiales". */
export function normalizarRazonSocial(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .replace(SUFIJOS_SOCIETARIOS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** El rubro detallado de un proveedor de la lista, por razón social. Acepta variantes como "FUMIGACIONES LOMAR - Lamberti Ana". */
export function rubroDetalleDe(razonSocial: string | null | undefined, lista: ProveedorClasificado[] = PROVEEDORES): string | null {
  if (!razonSocial) return null;
  const buscada = normalizarRazonSocial(razonSocial);
  if (!buscada) return null;
  const exacto = lista.find((p) => normalizarRazonSocial(p.razon_social) === buscada);
  if (exacto) return exacto.rubro_detalle;
  const parecido = lista.find((p) => {
    const n = normalizarRazonSocial(p.razon_social);
    return n.length >= 5 && (buscada.startsWith(n) || n.startsWith(buscada));
  });
  return parecido?.rubro_detalle ?? null;
}
