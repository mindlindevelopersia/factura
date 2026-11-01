/**
 * Los honorarios de los desarrolladores y su canje en m².
 *
 * Regla (Mati, 01/11/2026): de todo lo que ingresa por boleto, el 15% es de los desarrolladores
 * (el precio que pagan los compradores ya lo incluye); la obra se termina con el 85% restante.
 * Hasta ahora no se cobró nada de honorarios. Se pueden cobrar en plata o canjear por m², y el
 * canje es al COSTO del m²: el costo total del proyecto (terreno incluido, sin los honorarios de
 * los desarrolladores) dividido por los m² vendibles. Todo en dólares (MEP del día de cada pago).
 *
 * Por qué importa el canje a costo: esos m² después se venden al precio de mercado, más alto que
 * el costo; quedarse los honorarios en plata es quedarse con menos. Todo puro (sin red).
 */

export interface PartidaCosto {
  nombre: string;
  grupo: string;
  usd: number;
}

export interface UnidadLibre {
  codigo: string;
  tipologia: string;
  m2: number;
  precioUsd: number;
}

export interface DatosHonorarios {
  /** La parte de los desarrolladores (0,15). */
  parte: number;
  /** Lo que ya entró de los compradores, en dólares al MEP de cada pago. */
  cobradoUsd: number;
  /** Lo firmado en los boletos de las unidades vendidas. */
  firmadoUsd: number;
  /** Las unidades sin vender (a precio de lista). */
  libres: UnidadLibre[];
  /** m² vendibles del proyecto (sin amenities). */
  m2Venta: number;
  /** Los costos del proyecto: el total que se espera (lo real hasta hoy y lo proyectado de acá en más). */
  costos: PartidaCosto[];
  /** Lo gastado hasta hoy. */
  gastadoUsd: number;
  /** Partidas que no son costo del proyecto (préstamos, devoluciones, honorarios de los desarrolladores). */
  excluidos: PartidaCosto[];
}

/** Las partidas del cash flow que no son costo: préstamos que se devuelven, devoluciones, y los honorarios de los propios desarrolladores. */
export function esCostoDelProyecto(p: { nombre: string; grupo: string }): boolean {
  if (p.grupo === "prestamos" || p.grupo === "devoluciones") return false;
  return !/develop|desarrollador|fee\b|honorarios? (de )?(los )?(socios|developers?)/i.test(p.nombre);
}

export const costoTotal = (d: Pick<DatosHonorarios, "costos">) => d.costos.reduce((s, p) => s + p.usd, 0);
/** El costo del m² para el canje: costo total ÷ m² vendibles. */
export const costoM2 = (d: Pick<DatosHonorarios, "costos" | "m2Venta">) => (d.m2Venta > 0 ? costoTotal(d) / d.m2Venta : 0);

export interface Escenario {
  /** Sobre qué ingresos. */
  ingresosUsd: number;
  honorariosUsd: number;
  /** En m² al costo. */
  m2: number;
  /** Esos m² vendidos al precio de venta elegido. */
  valorVentaUsd: number;
}

export interface Honorarios {
  costoM2: number;
  precioVentaM2: number;
  /** Lo que ya entró: lo que ya se ganó. */
  hoy: Escenario;
  /** Todo lo firmado (lo que entró y lo que falta cobrar de lo vendido). */
  firmado: Escenario;
  /** Si también se vende lo que queda a precio de lista. */
  total: Escenario;
  /** El 15% de los m² vendibles, para comparar (no es lo mismo que el canje a costo). */
  m2ParteDeLosMetros: number;
  /** ¿Alcanza el 85% para terminar la obra? (al final, con todo vendido) */
  obra: { ingresosUsd: number; paraLaObraUsd: number; costoUsd: number; sobraUsd: number };
  /** Hasta hoy: lo gastado contra el 85% de lo que entró (si se gastó más, la obra usó plata de los honorarios). */
  obraHoy: { paraLaObraUsd: number; gastadoUsd: number; sobraUsd: number };
  /** Las unidades elegidas para quedárselas. */
  separadas: { codigos: string[]; m2: number; valorCostoUsd: number; valorListaUsd: number; cubre: number; diferenciaUsd: number } | null;
}

/**
 * Las cuentas. `costoM2Elegido` y `precioVentaM2` se pueden cambiar en la pantalla; `separadas`
 * son los códigos de las unidades que se quedarían los desarrolladores.
 */
export function calcularHonorarios(d: DatosHonorarios, o: { costoM2?: number | null; precioVentaM2?: number | null; separadas?: string[] } = {}): Honorarios {
  const cm2 = o.costoM2 && o.costoM2 > 0 ? o.costoM2 : costoM2(d);
  const libresUsd = d.libres.reduce((s, u) => s + u.precioUsd, 0);
  const libresM2 = d.libres.reduce((s, u) => s + u.m2, 0);
  const pv = o.precioVentaM2 && o.precioVentaM2 > 0 ? o.precioVentaM2 : libresM2 > 0 ? libresUsd / libresM2 : 0;
  const escenario = (ingresosUsd: number): Escenario => {
    const honorariosUsd = ingresosUsd * d.parte;
    const m2 = cm2 > 0 ? honorariosUsd / cm2 : 0;
    return { ingresosUsd, honorariosUsd, m2, valorVentaUsd: m2 * pv };
  };
  const total = escenario(d.firmadoUsd + libresUsd);
  const costo = costoTotal(d);
  let separadas: Honorarios["separadas"] = null;
  if (o.separadas?.length) {
    const us = d.libres.filter((u) => o.separadas!.includes(u.codigo));
    const m2 = us.reduce((s, u) => s + u.m2, 0);
    const valorCostoUsd = m2 * cm2;
    separadas = {
      codigos: us.map((u) => u.codigo),
      m2,
      valorCostoUsd,
      valorListaUsd: us.reduce((s, u) => s + u.precioUsd, 0),
      cubre: total.honorariosUsd > 0 ? valorCostoUsd / total.honorariosUsd : 0,
      diferenciaUsd: total.honorariosUsd - valorCostoUsd,
    };
  }
  return {
    costoM2: cm2,
    precioVentaM2: pv,
    hoy: escenario(d.cobradoUsd),
    firmado: escenario(d.firmadoUsd),
    total,
    m2ParteDeLosMetros: d.m2Venta * d.parte,
    obra: { ingresosUsd: total.ingresosUsd, paraLaObraUsd: total.ingresosUsd * (1 - d.parte), costoUsd: costo, sobraUsd: total.ingresosUsd * (1 - d.parte) - costo },
    obraHoy: { paraLaObraUsd: d.cobradoUsd * (1 - d.parte), gastadoUsd: d.gastadoUsd, sobraUsd: d.cobradoUsd * (1 - d.parte) - d.gastadoUsd },
    separadas,
  };
}
