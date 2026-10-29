import { comprobante, contraparte, type ItemCola } from "./cola/item";
import { EMPRESA } from "./empresa";
import type { Movimiento } from "./sheets/registros";

/** Total y cantidad de facturas de un grupo. */
export interface Monto {
  total: number;
  cantidad: number;
}

export interface MesPanel {
  /** AAAA-MM */
  mes: string;
  egresos: Monto;
  ingresos: Monto;
}

export interface Reciente {
  id: string;
  cuando: string;
  estado: ItemCola["estado"];
  origen: ItemCola["origen"];
  contraparte: string;
  comprobante: string;
  total: number | null;
  moneda: string;
  pestania: "egresos" | "ingresos" | null;
  fila: number | null;
}

/**
 * Lo que muestra el panel de inicio. Los importes salen de la planilla (lo cargado a mano y
 * lo cargado por la app); lo que espera revisión y la actividad, de la cola.
 */
export interface ResumenPanel {
  /** AAAA-MM del mes actual, en Buenos Aires. */
  mes: string;
  cola: { paraRevisar: number; conError: number; leyendo: number };
  /** Del mes actual, en pesos. Compras y honorarios son egresos; los honorarios, los de los socios. */
  mesActual: { compras: Monto; honorarios: Monto; ventas: Monto };
  /** Los últimos 12 meses, del más viejo al actual, en pesos. */
  meses: MesPanel[];
  /** Los proveedores con más compras en pesos del mes (sin honorarios), y el resto junto. */
  proveedores: { mes: string; lista: { nombre: string; total: number; cantidad: number }[]; otros: Monto };
  /** Filas de los últimos 12 meses en otra moneda: no se suman a los totales en pesos. */
  enOtraMoneda: number;
  /** La app en el mes: cuántas cargó, cuántas llegaron por Telegram y cuánto tardan en cargarse. */
  app: { cargadas: number; porTelegram: number; horasHastaCarga: number | null };
  recientes: Reciente[];
  /** Si no se pudo leer la planilla, el motivo: el panel muestra la cola igual. */
  sinPlanilla: string | null;
}

const PESOS = new Set(["", "pesos", "peso", "$", "ars", "$ar"]);
export const esPesos = (moneda: string) => PESOS.has(moneda.trim().toLowerCase());

const CUITS_SOCIOS = new Set(EMPRESA.socios.map((s) => s.cuit));

/** AAAA-MM de un momento, en hora de Buenos Aires. */
export function mesEnBuenosAires(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit" }).format(fecha);
}

/** Los n meses que terminan en `hasta` (AAAA-MM), del más viejo al más nuevo. */
export function ultimosMeses(hasta: string, n: number): string[] {
  const [anio, mes] = hasta.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(anio, mes - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

const vacio = (): Monto => ({ total: 0, cantidad: 0 });
const sumar = (m: Monto, total: number) => {
  m.total += total;
  m.cantidad += 1;
};
const redondear = (n: number) => Math.round(n * 100) / 100;
const redondearMonto = (m: Monto): Monto => ({ total: redondear(m.total), cantidad: m.cantidad });

/** Cuántos proveedores se muestran por nombre; el resto va en "Otros". */
export const PROVEEDORES_VISIBLES = 6;

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function resumirPanel(movimientos: Movimiento[] | null, items: ItemCola[], ahora: Date, sinPlanilla: string | null = null): ResumenPanel {
  const mes = mesEnBuenosAires(ahora);
  const meses = ultimosMeses(mes, 12);
  const porMes = new Map(meses.map((m) => [m, { mes: m, egresos: vacio(), ingresos: vacio() }]));
  const mesActual = { compras: vacio(), honorarios: vacio(), ventas: vacio() };
  const proveedores = new Map<string, { nombre: string; total: number; cantidad: number }>();
  let enOtraMoneda = 0;

  for (const m of movimientos ?? []) {
    const mesFila = m.fecha?.slice(0, 7);
    const grupo = mesFila ? porMes.get(mesFila) : undefined;
    if (!grupo) continue;
    if (!esPesos(m.moneda)) {
      enOtraMoneda += 1;
      continue;
    }
    sumar(grupo[m.pestania], m.total);
    if (mesFila !== mes) continue;
    if (m.pestania === "ingresos") {
      sumar(mesActual.ventas, m.total);
      continue;
    }
    if (CUITS_SOCIOS.has(m.cuit)) {
      sumar(mesActual.honorarios, m.total);
      continue;
    }
    sumar(mesActual.compras, m.total);
    // Por CUIT, para que "Corralón SA" y "Corralon S.A." sean el mismo; se muestra el último nombre.
    const clave = m.cuit || m.contraparte.toLowerCase();
    const p = proveedores.get(clave) ?? { nombre: m.contraparte || "Sin nombre", total: 0, cantidad: 0 };
    p.nombre = m.contraparte || p.nombre;
    p.total += m.total;
    p.cantidad += 1;
    proveedores.set(clave, p);
  }

  const ordenados = [...proveedores.values()].sort((a, b) => b.total - a.total);
  const otros = vacio();
  for (const p of ordenados.slice(PROVEEDORES_VISIBLES)) {
    otros.total += p.total;
    otros.cantidad += p.cantidad;
  }

  const delMes = items.filter((i) => i.estado === "aprobada" && i.resuelta && mesEnBuenosAires(new Date(i.resuelta)) === mes);
  const horas = delMes.map((i) => (Date.parse(i.resuelta!) - Date.parse(i.recibida)) / 3_600_000).filter((h) => Number.isFinite(h) && h >= 0);

  const recientes = [...items]
    .sort((a, b) => (b.resuelta ?? b.recibida).localeCompare(a.resuelta ?? a.recibida))
    .slice(0, 6)
    .map((i): Reciente => {
      const f = i.lectura?.factura;
      return {
        id: i.id,
        cuando: i.resuelta ?? i.recibida,
        estado: i.estado,
        origen: i.origen,
        contraparte: f ? contraparte(f) : i.archivo.nombre,
        comprobante: f ? comprobante(f) : "",
        total: f ? f.total : null,
        moneda: f?.moneda ?? "ARS",
        pestania: f ? (f.categoria === "venta" ? "ingresos" : "egresos") : null,
        fila: i.estado === "aprobada" ? (i.resultado?.fila ?? null) : null,
      };
    });

  return {
    mes,
    cola: {
      paraRevisar: items.filter((i) => i.estado === "pendiente" || i.estado === "aprobando").length,
      conError: items.filter((i) => i.estado === "error").length,
      leyendo: items.filter((i) => i.estado === "leyendo").length,
    },
    mesActual: { compras: redondearMonto(mesActual.compras), honorarios: redondearMonto(mesActual.honorarios), ventas: redondearMonto(mesActual.ventas) },
    meses: [...porMes.values()].map((m) => ({ mes: m.mes, egresos: redondearMonto(m.egresos), ingresos: redondearMonto(m.ingresos) })),
    proveedores: {
      mes,
      lista: ordenados.slice(0, PROVEEDORES_VISIBLES).map((p) => ({ ...p, total: redondear(p.total) })),
      otros: redondearMonto(otros),
    },
    enOtraMoneda,
    app: {
      cargadas: delMes.length,
      porTelegram: delMes.filter((i) => i.origen === "telegram").length,
      horasHastaCarga: mediana(horas),
    },
    recientes,
    sinPlanilla,
  };
}
