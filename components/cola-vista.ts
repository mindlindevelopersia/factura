import { comprobante, contraparte, type ItemCola } from "@/lib/cola/item";
import type { Pendiente } from "@/lib/cola/servicio";

export const CATEGORIAS_VISTA = {
  compra: "Compra",
  honorarios: "Honorarios",
  venta: "Venta",
} as const;
export type FiltroCola =
  | "todos"
  | "pendiente"
  | "duplicada"
  | "error"
  | "leyendo";

export const normalizarBusqueda = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export function coincideBusqueda(item: ItemCola, consulta: string): boolean {
  const f = item.lectura?.factura;
  const texto = [
    item.archivo.nombre,
    item.enviadaPor,
    f && contraparte(f),
    f && comprobante(f),
    f?.cuit,
    f?.cuit_receptor,
    f?.concepto,
  ]
    .filter(Boolean)
    .join(" ");
  return normalizarBusqueda(texto).includes(normalizarBusqueda(consulta));
}

export function esDuplicada(item: Pendiente): boolean {
  return item.cargada?.tipo === "duplicada" || !!item.repetida;
}

export function filtrarCola(
  items: Pendiente[],
  consulta: string,
  filtro: FiltroCola,
  categoria: string,
): Pendiente[] {
  return items.filter(
    (i) =>
      coincideBusqueda(i, consulta) &&
      (!categoria || i.lectura?.factura.categoria === categoria) &&
      (filtro === "todos" ||
        (filtro === "duplicada"
          ? esDuplicada(i)
          : filtro === "pendiente"
            ? i.estado === "pendiente" && !esDuplicada(i)
            : i.estado === filtro)),
  );
}

export function estadoVisible(i: Pendiente): { texto: string; clase: string } {
  if (i.estado === "error") return { texto: "No se pudo leer", clase: "error" };
  if (i.estado === "leyendo")
    return { texto: "Leyendo con IA", clase: "leyendo" };
  if (esDuplicada(i)) return { texto: "Posible duplicado", clase: "aviso" };
  return { texto: "Para revisar", clase: "revision" };
}
