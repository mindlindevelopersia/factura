import type { Hoja } from "@/lib/excel/tabla";
import type { Unidad } from "@/lib/proyectos/comercial";

/** Las unidades como hoja de Excel: superficies, coeficiente, estado, inversor y precios (con totales). */
export function hojaUnidades(unidades: Unidad[], titulo: string, simulado?: (u: Unidad) => number): Hoja {
  return {
    nombre: "Unidades",
    titulo,
    columnas: [
      { titulo: "Unidad", ancho: 9 },
      { titulo: "Piso", ancho: 7 },
      { titulo: "Tipología", ancho: 16 },
      { titulo: "Orientación", ancho: 13 },
      { titulo: "Estado", ancho: 12 },
      { titulo: "Inversor", ancho: 28 },
      { titulo: "Cubierta (m²)", formato: "m2", total: true },
      { titulo: "Semicubierta (m²)", formato: "m2", total: true },
      { titulo: "Descubierta (m²)", formato: "m2", total: true },
      { titulo: "Propia (m²)", formato: "m2", total: true },
      { titulo: "Amenities (m²)", formato: "m2", total: true },
      { titulo: "Total (m²)", formato: "m2", total: true },
      { titulo: "Coeficiente", formato: "pct", total: true },
      { titulo: "Precio de lista (US$)", formato: "usd", total: true },
      { titulo: "Precio de venta (US$)", formato: "usd", total: true },
      { titulo: "Reventa (US$)", formato: "usd" },
      ...(simulado ? [{ titulo: "Precio simulado (US$)", formato: "usd" as const, total: true }] : []),
    ],
    filas: unidades.map((u) => [
      u.codigo,
      u.piso,
      u.tipologia,
      u.orientacion,
      u.estadoTexto || u.estado,
      u.inversor,
      u.supCubierta,
      u.supSemicubierta,
      u.supDescubierta,
      u.supPropia,
      u.supAmenities,
      u.supTotal,
      u.coeficiente,
      u.estado === "libre" ? u.precioLista : null,
      u.precioVenta,
      u.reventa,
      ...(simulado ? [u.estado === "libre" ? Math.round(simulado(u)) : null] : []),
    ]),
  };
}
