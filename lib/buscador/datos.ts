/**
 * Los resultados de los datos (no las páginas) para el buscador: se arman a partir de lo que ya
 * leen el CRM, las propuestas, el comercial, las cuentas y las tareas. Todo puro (sin red).
 */

import type { Contacto } from "../crm/modelo";
import type { Pago } from "../finanzas/ingresos";
import { diaVencimiento } from "../inversores/cobranzas";
import { PROYECTO_PRINCIPAL, proyecto as buscarProyecto, rutaProyecto } from "../modulos";
import type { PropuestaGuardada } from "../proyectos/propuestasGuardadas";
import { abierta, PROYECTO_PRODUCTO, rutaDeTarea, type Tarea } from "../tareas/modelo";
import type { Resultado } from "./indice";

const fecha = (f: string) => f.split("-").reverse().join("/");
const plata = (moneda: string, n: number) => `${moneda === "USD" ? "US$" : "$"} ${Math.round(n).toLocaleString("es-AR")}`;

export function resultadosLeads(contactos: Contacto[]): Resultado[] {
  return contactos.map((c) => {
    const proyecto = c.proyectos[0] ?? PROYECTO_PRINCIPAL.id;
    return {
      tipo: "Lead",
      etiqueta: "Lead",
      titulo: c.nombre,
      detalle: [c.etapa, c.proyectos.map((p) => buscarProyecto(p)?.nombre ?? p).join(", "), c.proximaFecha ? `próximo paso ${fecha(c.proximaFecha)}` : ""].filter(Boolean).join(" · "),
      href: `${rutaProyecto(proyecto, "comercial/crm")}?contacto=${c.id}`,
      proyecto: c.proyectos.length === 1 ? c.proyectos[0] : "",
      extra: [c.telefono, c.mail, c.origen, c.referido, c.unidades.join(" ")].join(" "),
    };
  });
}

export function resultadosPropuestas(propuestas: PropuestaGuardada[]): Resultado[] {
  return propuestas.map((p) => ({
    tipo: "Propuesta",
    etiqueta: "Propuesta",
    titulo: `UF ${p.unidad}${p.cliente ? ` · ${p.cliente}` : ""}`,
    detalle: `${plata("USD", p.precioUsd)} · ${fecha(p.creada.slice(0, 10))} · la hizo ${p.autor || "—"}`,
    href: `${rutaProyecto(p.proyecto, "comercial/propuesta")}?id=${p.id}&${p.parametros}${p.contactoId ? `&contacto=${p.contactoId}` : ""}`,
    proyecto: p.proyecto,
  }));
}

export function resultadosUnidades(proyecto: string, unidades: { codigo: string; tipologia: string; estadoTexto: string; inversor: string; esCochera: boolean }[]): Resultado[] {
  return unidades.map((u) => ({
    tipo: "Unidad",
    etiqueta: u.esCochera ? "Cochera" : "Unidad",
    titulo: `${u.esCochera ? "" : "UF "}${u.codigo}`,
    detalle: [buscarProyecto(proyecto)?.nombre, u.tipologia, u.estadoTexto, u.inversor].filter(Boolean).join(" · "),
    href: `${rutaProyecto(proyecto, "comercial/unidades")}?unidad=${encodeURIComponent(u.codigo)}`,
    proyecto,
    extra: u.inversor,
  }));
}

/** Cada inversor (a su cuenta corriente) y, si le falta pagar, su próximo cobro (o lo vencido). */
export function resultadosCuentas(proyecto: string, cuentas: { id: string; inversor: string; unidad: string; telefono: string; pendientes: Pago[] }[], hoy: string): Resultado[] {
  const r: Resultado[] = [];
  for (const c of cuentas) {
    r.push({
      tipo: "Inversor",
      etiqueta: "Inversor",
      titulo: c.inversor,
      detalle: `UF ${c.unidad} · cuenta corriente`,
      href: rutaProyecto(proyecto, `inversores/cuentas-corrientes/${c.id}`),
      proyecto,
      extra: `${c.unidad} ${c.telefono}`,
    });
    const dia = String(diaVencimiento(c.inversor)).padStart(2, "0");
    const pendientes = c.pendientes.filter((p) => p.mes && p.monto > 0).sort((a, b) => a.mes!.localeCompare(b.mes!));
    if (!pendientes.length) continue;
    const vencidos = pendientes.filter((p) => `${p.mes}-${dia}` < hoy);
    const prox = vencidos[0] ?? pendientes[0];
    r.push({
      tipo: "Cobro",
      etiqueta: vencidos.length ? "Cobro vencido" : "Cobro",
      titulo: `${c.inversor} · ${c.unidad}`,
      detalle: vencidos.length
        ? `${vencidos.length} ${vencidos.length === 1 ? "pago vencido" : "pagos vencidos"} desde el ${fecha(`${vencidos[0].mes}-${dia}`)}`
        : `Próximo: ${prox.detalle || "cuota"} el ${fecha(`${prox.mes}-${dia}`)} · ${plata(prox.moneda, prox.monto)}`,
      href: rutaProyecto(proyecto, "inversores/cobranzas"),
      proyecto,
    });
  }
  return r;
}

export function resultadosTareas(tareas: Tarea[]): Resultado[] {
  return tareas
    .filter((t) => t.estado !== "Cancelada")
    .map((t) => {
      return {
        tipo: "Tarea",
        etiqueta: t.proyecto === PROYECTO_PRODUCTO ? "Feature" : abierta(t) ? "Tarea" : "Tarea hecha",
        titulo: t.titulo,
        detalle: [t.responsable, t.con, t.vence ? `vence ${fecha(t.vence)}` : "", t.estado].filter(Boolean).join(" · "),
        href: rutaDeTarea(t),
        proyecto: t.proyecto,
        extra: `${t.descripcion} ${t.subtareas.map((s) => s.texto).join(" ")}`,
      };
    });
}
