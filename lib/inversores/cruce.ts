/**
 * Cruce de las cuentas corrientes con las otras planillas:
 * - El machete de "Ventas" del Excel madre (nombre, unidad, costo estimado y anticipo al boleto).
 * - El Flujo de fondos (mes base CAC de cada inversor).
 *
 * Hace dos cosas. Completa lo que falta en "Pagos por Inversor" (por ejemplo, el costo de un bloque
 * con el encabezado roto) y avisa lo que no coincide, para corregirlo en la planilla. Lo que ya está
 * explicado por una corrección del proyecto (lib/modulos.ts) no se avisa.
 *
 * Todo lo de acá es puro (sin red).
 */

import { codigoDeVentas, type VentaMachete } from "../proyectos/comercial";
import type { FichaVenta } from "../proyectos/fichas";
import { parecido, type AvisoCuenta, type Cuenta, type CuentasCorrientes } from "./cuentas";

const usd = (n: number) => `US$ ${Math.round(n).toLocaleString("es-AR")}`;
const distinto = (a: number, b: number) => Math.abs(a - b) > Math.max(1, Math.abs(b) * 0.005);
const nombreMesBase = (m: string) => {
  const [a, mm] = m.split("-");
  return `${mm}/${a}`;
};

/**
 * La ficha de Ventas de una unidad. Algunas fichas tienen mal la unidad (una copiada de otra), así que:
 * 1. Misma unidad y (nombre parecido o mismo costo).
 * 2. Nombre parecido y mismo costo, en otra unidad (o sin unidad).
 * 3. Mismo costo exacto, si hay una sola.
 */
function fichaDe(unidad: string, grupo: Cuenta[], fichas: FichaVenta[]): FichaVenta | null {
  const costo = grupo.reduce((s, c) => s + (c.precioUsd ?? 0), 0) || null;
  const nombre = (f: FichaVenta) => grupo.some((c) => parecido(f.nombre, c.inversor) > 0 || parecido(c.inversor, f.nombre) > 0);
  const mismoCosto = (f: FichaVenta) => costo != null && f.costoUsd != null && !distinto(f.costoUsd, costo);
  const misma = fichas.find((f) => f.unidad === unidad && (nombre(f) || mismoCosto(f)));
  if (misma) return misma;
  const otra = fichas.find((f) => nombre(f) && mismoCosto(f));
  if (otra) return otra;
  const exactas = costo != null ? fichas.filter((f) => f.costoUsd != null && Math.abs(f.costoUsd - costo) < 1) : [];
  return exactas.length === 1 ? exactas[0] : null;
}

export function cruzarCuentas(cc: CuentasCorrientes, ventas: VentaMachete[] | null, explicadas: Set<string> = new Set(), fichas: FichaVenta[] | null = null): CuentasCorrientes {
  const porCodigo = new Map<string, VentaMachete>();
  for (const v of ventas ?? []) {
    const cod = codigoDeVentas(v.unidad);
    if (cod && v.nombre && !/falta vender/i.test(v.nombre)) porCodigo.set(cod, v);
  }
  const cuentas: Cuenta[] = cc.cuentas.map((c) => ({ ...c, avisos: [...c.avisos] }));
  const porUnidad = new Map<string, Cuenta[]>();
  for (const c of cuentas) porUnidad.set(c.unidad.toUpperCase(), [...(porUnidad.get(c.unidad.toUpperCase()) ?? []), c]);

  for (const [unidad, grupo] of porUnidad) {
    const v = porCodigo.get(unidad);
    const fila = v ? `Ventas, fila ${v.fila}` : "";
    const avisar = (c: Cuenta, a: Omit<AvisoCuenta, "filas">) => c.avisos.push({ ...a, filas: [] });

    // La ficha de la operación (debajo de la tabla de Ventas): completa y valida costo, pesos, formal,
    // informal y mes base.
    const ficha = fichas ? fichaDe(unidad, grupo, fichas) : null;
    if (ficha) {
      const enFicha = `ficha de Ventas, fila ${ficha.fila}`;
      if (ficha.unidad && ficha.unidad !== unidad) {
        for (const c of grupo)
          avisar(c, {
            tipo: "cruce",
            titulo: "La ficha de Ventas tiene otra unidad",
            detalle: `La ficha "${ficha.nombre}" (${enFicha}) dice unidad ${ficha.unidad}, pero por ${
              grupo.some((c) => parecido(ficha.nombre, c.inversor) > 0) ? "el nombre y el costo" : "el costo"
            } (${usd(ficha.costoUsd ?? 0)}) es de la ${unidad}.`,
          });
      }
      const sola = grupo.length === 1 ? grupo[0] : null;
      const completados: string[] = [];
      if (sola) {
        if (sola.precioUsd == null && ficha.costoUsd != null) {
          sola.precioUsd = ficha.costoUsd;
          completados.push(`costo ${usd(ficha.costoUsd)}`);
        }
        if (sola.precioArs == null && ficha.costoArs != null) {
          sola.precioArs = ficha.costoArs;
          completados.push(`costo en pesos $ ${Math.round(ficha.costoArs).toLocaleString("es-AR")}`);
        }
        if (sola.formalUsd == null && ficha.formalUsd != null) {
          sola.formalUsd = ficha.formalUsd;
          completados.push(`formal ${usd(ficha.formalUsd)}`);
        }
        if (sola.informalUsd == null && ficha.informalUsd != null) {
          sola.informalUsd = ficha.informalUsd;
          completados.push(`informal ${usd(ficha.informalUsd)}`);
        }
        if (!sola.mesBaseCac && ficha.mesBase) {
          sola.mesBaseCac = ficha.mesBase;
          completados.push(`mes base CAC ${nombreMesBase(ficha.mesBase)}`);
        }
        if (completados.length) {
          avisar(sola, { tipo: "completado", titulo: "Datos tomados de la ficha de Ventas", detalle: `No están en "Pagos por Inversor": ${completados.join(", ")} (${enFicha}).` });
        }
      }
      if (!explicadas.has(unidad)) {
        const diferencias: string[] = [];
        const suma = grupo.reduce((s, c) => s + (c.precioUsd ?? 0), 0);
        if (ficha.costoUsd != null && suma && distinto(suma, ficha.costoUsd)) diferencias.push(`costo ${usd(ficha.costoUsd)} en la ficha y ${usd(suma)} en "Pagos por Inversor"`);
        if (sola && ficha.costoArs != null && sola.precioArs != null && distinto(sola.precioArs, ficha.costoArs)) {
          diferencias.push(`costo en pesos $ ${Math.round(ficha.costoArs).toLocaleString("es-AR")} en la ficha y $ ${Math.round(sola.precioArs).toLocaleString("es-AR")} en "Pagos por Inversor"`);
        }
        if (sola && ficha.formalUsd != null && sola.formalUsd != null && distinto(sola.formalUsd, ficha.formalUsd)) diferencias.push(`formal ${usd(ficha.formalUsd)} y ${usd(sola.formalUsd)}`);
        if (sola && ficha.informalUsd != null && sola.informalUsd != null && distinto(sola.informalUsd, ficha.informalUsd)) diferencias.push(`informal ${usd(ficha.informalUsd)} y ${usd(sola.informalUsd)}`);
        for (const c of grupo)
          if (ficha.mesBase && c.mesBaseCac && c.mesBaseCac !== ficha.mesBase && !completados.length)
            diferencias.push(`mes base CAC ${nombreMesBase(ficha.mesBase)} en la ficha y ${nombreMesBase(c.mesBaseCac)} en "Pagos por Inversor"${grupo.length > 1 ? ` (${c.inversor})` : ""}`);
        if (diferencias.length) {
          for (const c of grupo) avisar(c, { tipo: "cruce", titulo: "No coincide con la ficha de Ventas", detalle: `${[...new Set(diferencias)].join("; ")} (${enFicha}).` });
        }
      }
    }

    // Mes base CAC: si falta en "Pagos por Inversor", del Flujo; si están los dos y no coinciden, aviso.
    for (const c of grupo) {
      const delFlujo = [...c.cobradoFlujo, ...c.pendientes].map((p) => p.mesBase).find((m): m is string => !!m) ?? null;
      if (!delFlujo) continue;
      if (!c.mesBaseCac) {
        c.mesBaseCac = delFlujo;
        avisar(c, { tipo: "completado", titulo: "Mes base CAC tomado del Flujo", detalle: `No está en "Pagos por Inversor": se usa el del Flujo de fondos (${nombreMesBase(delFlujo)}).` });
      } else if (c.mesBaseCac !== delFlujo && !explicadas.has(unidad)) {
        avisar(c, {
          tipo: "cruce",
          titulo: "El mes base CAC no coincide",
          detalle: `"Pagos por Inversor" dice ${nombreMesBase(c.mesBaseCac)} y el Flujo de fondos ${nombreMesBase(delFlujo)}. Se usa el de "Pagos por Inversor".`,
        });
      }
    }

    if (!v) continue;

    // Costo estimado: si ninguna cuenta de la unidad lo tiene, el de Ventas; si no coincide, aviso.
    const conPrecio = grupo.filter((c) => c.precioUsd != null);
    if (!conPrecio.length && v.costoEstimado && grupo.length === 1) {
      grupo[0].precioUsd = v.costoEstimado;
      avisar(grupo[0], {
        tipo: "completado",
        titulo: "Costo estimado tomado de Ventas",
        detalle: `No está en "Pagos por Inversor": se usa el del machete de Ventas (${usd(v.costoEstimado)}, ${fila}). Sin el monto en pesos no se puede calcular la cuenta en pesos de hoy.`,
      });
    } else if (conPrecio.length && v.costoEstimado && !explicadas.has(unidad)) {
      const suma = conPrecio.reduce((s, c) => s + c.precioUsd!, 0);
      if (distinto(suma, v.costoEstimado)) {
        for (const c of grupo)
          avisar(c, {
            tipo: "cruce",
            titulo: "El costo estimado no coincide con Ventas",
            detalle: `"Pagos por Inversor" dice ${usd(suma)}${grupo.length > 1 ? ` (sumando las ${grupo.length} cuentas de la unidad)` : ""} y el machete de Ventas ${usd(v.costoEstimado)} (${fila}).`,
          });
      }
    }

    // Nombre: que alguna palabra coincida (con el machete o con la ficha de la operación).
    const nombres = [v.nombre, ficha?.nombre].filter((x): x is string => !!x);
    if (!grupo.some((c) => nombres.some((n) => parecido(n, c.inversor) > 0 || parecido(c.inversor, n) > 0))) {
      for (const c of grupo)
        avisar(c, {
          tipo: "cruce",
          titulo: "El nombre no coincide con Ventas",
          detalle: `En el machete de Ventas la ${unidad} es de "${v.nombre}" (${fila}) y en "Pagos por Inversor" de "${grupo.map((x) => x.inversor).join('", "')}".`,
        });
    }

    // Anticipo al boleto: lo de Ventas contra los anticipos cargados en la cuenta.
    if (v.montoBoleto) {
      const anticipos = grupo.flatMap((c) => c.pagos.filter((p) => /anticipo/i.test(p.concepto)));
      const pagado = anticipos.reduce((s, p) => s + (p.usd ?? 0), 0);
      if (anticipos.length && distinto(pagado, v.montoBoleto) && !explicadas.has(unidad)) {
        avisar(grupo[0], {
          tipo: "cruce",
          titulo: "El anticipo no coincide con Ventas",
          detalle: `El machete de Ventas dice ${usd(v.montoBoleto)} al boleto y en "Pagos por Inversor" hay ${usd(pagado)} de anticipos (${fila}).`,
        });
      }
      const partes = (v.blanco ?? 0) + (v.negro ?? 0);
      if ((v.blanco != null || v.negro != null) && distinto(partes, v.montoBoleto)) {
        avisar(grupo[0], {
          tipo: "cruce",
          titulo: "En Ventas, blanco + negro no da el boleto",
          detalle: `Blanco ${usd(v.blanco ?? 0)} + negro ${usd(v.negro ?? 0)} = ${usd(partes)}, pero el monto al boleto es ${usd(v.montoBoleto)} (${fila}).`,
        });
      }
    }
  }
  return { ...cc, cuentas };
}
