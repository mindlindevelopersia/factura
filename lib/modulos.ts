/**
 * Cómo se organiza el hub: la empresa (Mindlin Developers) tiene áreas propias (Indicadores) y
 * proyectos (Lerma 439, Güemes 4676…). Cada proyecto es su propio vehículo, con su administración,
 * sus finanzas, su comercial, sus inversores y su management; todos usan las mismas áreas.
 *
 * El menú lateral, el inicio y la página de cada área salen de acá: para sumar un área o un módulo
 * nuevo, se agrega en esta lista y se crea su página (las de proyecto, en app/(hub)/proyectos/[proyecto]).
 */

import type { AjusteUnidad } from "./proyectos/comercial";

export type IconoArea = "administracion" | "finanzas" | "inversores" | "indicadores" | "comercial" | "management" | "proyecto";

export interface Modulo {
  nombre: string;
  descripcion: string;
  href: string;
  /** En prueba: el menú, la tarjeta y la página lo marcan como "Beta". */
  beta?: boolean;
}

export interface Area {
  nombre: string;
  descripcion: string;
  href: string;
  icono: IconoArea;
  modulos: Modulo[];
}

export interface Socio {
  nombre: string;
  /** De 0 a 1. */
  parte: number;
}

export interface Proyecto {
  /** Para la URL: /proyectos/<id>. */
  id: string;
  nombre: string;
  /** Con qué vehículo se hace: cada uno tiene su contabilidad y su caja. */
  vehiculo: string;
  descripcion: string;
  /** "bloqueado": aparece en el menú como beta, pero todavía no se puede entrar. */
  estado: "activo" | "bloqueado";
  /** Lo que se quedan los desarrolladores: parte de los m² vendibles. */
  management?: { parteM2: number; socios: Socio[] };
  /** El "Excel madre" del proyecto (lista de precios, superficies, ventas, EE.RR). */
  planillaMadre?: string;
  /** Lo que se sabe de algunas unidades y la planilla todavía no dice (reventas, contratos, ventas caídas). */
  ajustes?: AjusteUnidad[];
}

/** El reparto entre los desarrolladores es el mismo en todos los proyectos. */
export const SOCIOS: Socio[] = [
  { nombre: "Matías Mindlin", parte: 0.5 },
  { nombre: "Michelle Mindlin", parte: 0.25 },
  { nombre: "Micaela Druck", parte: 0.25 },
];

export const PROYECTOS: Proyecto[] = [
  {
    id: "lerma-439",
    nombre: "Lerma 439",
    vehiculo: "Mindlin Developers S.A.",
    descripcion: "Villa Crespo · 28 unidades y 2 cocheras",
    estado: "activo",
    management: { parteM2: 0.15, socios: SOCIOS },
    planillaMadre: "1B1cSVA9AtleBLajFwjkXdQOHnv2n0Ijv4sl3NtZP8c0",
    ajustes: [
      {
        codigo: "1A",
        estado: "vendida",
        contrato: true,
        reventa: 105000,
        motivo: "Está vendida a un contratista (se pagó con obra). El dueño pidió revenderla en US$ 105.000: la que está disponible es esa segunda venta.",
        desde: "31/10/2026",
      },
      {
        codigo: "4C",
        modalidad: "cerrado",
        titulo: "precio real US$ 80.000 (mutuo por 90.000), precio cerrado",
        motivo:
          "Precio real US$ 80.000 (lo que entró). En los papeles se vendió en US$ 90.000: se hizo un mutuo y en la contabilidad figura en blanco por 90.000. Por eso \"Pagos por Inversor\" dice 90.000 y \"Ventas\" 80.000; vale el de Ventas. Es a precio cerrado: no se ajusta al costo.",
        desde: "31/10/2026",
      },
      {
        codigo: "8B",
        modalidad: "costo",
        tope: 0.07,
        aConfirmar: true,
        titulo: "al costo con tope",
        motivo: "Se vendió al costo, pero con un tope: si el costo final sube, paga como máximo un 7% más que el precio de venta. Verificar el porcentaje en el contrato.",
        desde: "31/10/2026",
      },
      { codigo: "7A", modalidad: "cerrado", titulo: "precio cerrado", motivo: "Se vendió a precio cerrado: no se ajusta al costo al final de la obra.", desde: "31/10/2026" },
      { codigo: "2C", estado: "libre", motivo: "La venta no se firmó: está libre.", desde: "31/10/2026" },
      {
        codigo: "5D",
        estado: "libre",
        motivo: "Está libre: los compradores se pasaron a PB (empezaron pagando una cuota menor y se la agrandaron por la unidad más grande). La venta de 5D que figura en \"Ventas\" es la vieja.",
        desde: "31/10/2026",
      },
      {
        codigo: "9A",
        contrato: true,
        motivo: "Es de un contratista: se paga con un contrato de obra, por eso no tiene cuenta corriente. Va a ir al módulo de Contratos.",
        desde: "31/10/2026",
      },
    ],
  },
  {
    id: "guemes-4676",
    nombre: "Güemes 4676",
    vehiculo: "Fideicomiso",
    descripcion: "En preparación",
    estado: "bloqueado",
  },
];

export const PROYECTO_PRINCIPAL = PROYECTOS[0];

export function rutaProyecto(id: string, sub = ""): string {
  return `/proyectos/${id}${sub ? `/${sub}` : ""}`;
}

export function proyecto(id: string): Proyecto | undefined {
  return PROYECTOS.find((p) => p.id === id);
}

/** Dónde vive el módulo de facturas de Lerma. Lo usan los links que manda el bot de Telegram. */
export const RUTA_FACTURAS = rutaProyecto("lerma-439", "administracion/facturas");

/** Las áreas que tiene cada proyecto (las rutas son relativas al proyecto). */
const AREAS_DE_PROYECTO: { sub: string; nombre: string; descripcion: string; icono: IconoArea; modulos: { sub: string; nombre: string; descripcion: string; beta?: boolean }[] }[] = [
  {
    sub: "comercial",
    nombre: "Comercial",
    descripcion: "Las unidades, la lista de precios vigente y lo que falta vender.",
    icono: "comercial",
    modulos: [
      {
        sub: "comercial/unidades",
        nombre: "Unidades",
        descripcion: "Cada unidad con sus superficies, su estado, su precio de lista o de venta y su inversor, piso por piso.",
        beta: true,
      },
      {
        sub: "comercial/lista-de-precios",
        nombre: "Lista de precios",
        descripcion: "La lista vigente: precio por m², ajuste por altura y simulador de lo que vale lo que falta vender.",
        beta: true,
      },
    ],
  },
  {
    sub: "administracion",
    nombre: "Administración",
    descripcion: "Comprobantes, registro contable y papeles del proyecto.",
    icono: "administracion",
    modulos: [
      {
        sub: "administracion/facturas",
        nombre: "Facturas y comprobantes",
        descripcion: "Compras, honorarios y ventas: la IA propone los datos y una persona revisa y aprueba.",
      },
    ],
  },
  {
    sub: "finanzas",
    nombre: "Finanzas",
    descripcion: "Lo que entra y lo que sale del proyecto, en pesos y en dólares.",
    icono: "finanzas",
    modulos: [
      {
        sub: "finanzas/ingresos",
        nombre: "Ingresos",
        descripcion: "Lo cobrado y lo que falta cobrar de los inversores, por mes, moneda, inversor y blanco o negro.",
        beta: true,
      },
      {
        sub: "finanzas/egresos",
        nombre: "Egresos",
        descripcion: "Lo que se pagó en pesos y en dólares, por rubro, proyecto y blanco o negro: en qué se va la plata.",
        beta: true,
      },
    ],
  },
  {
    sub: "inversores",
    nombre: "Inversores",
    descripcion: "Las cuentas de cada inversor: cuánto pagó, cuánto le falta, su estado de cuenta y las cobranzas.",
    icono: "inversores",
    modulos: [
      {
        sub: "inversores/cuentas-corrientes",
        nombre: "Cuentas corrientes",
        descripcion: "Pagos, saldo y avance de cada inversor, con el plan de pagos que falta y el estado de cuenta para mandarle.",
        beta: true,
      },
      {
        sub: "inversores/cobranzas",
        nombre: "Cobranzas",
        descripcion: "Qué tiene vencido cada inversor actualizado por CAC, qué vence este mes, el aviso por WhatsApp y el seguimiento.",
        beta: true,
      },
    ],
  },
  {
    sub: "management",
    nombre: "Management",
    descripcion: "Lo que les corresponde a los desarrolladores de este proyecto y cómo se reparte.",
    icono: "management",
    modulos: [
      {
        sub: "management/desarrolladores",
        nombre: "Desarrolladores",
        descripcion: "Los m² que se quedan los desarrolladores, a qué valor y el reparto entre socios.",
        beta: true,
      },
    ],
  },
];

/** Las áreas de un proyecto, con las rutas completas. */
export function areasDeProyecto(id: string): Area[] {
  return AREAS_DE_PROYECTO.map((a) => ({
    nombre: a.nombre,
    descripcion: a.descripcion,
    href: rutaProyecto(id, a.sub),
    icono: a.icono,
    modulos: a.modulos.map((m) => ({ nombre: m.nombre, descripcion: m.descripcion, href: rutaProyecto(id, m.sub), beta: m.beta })),
  }));
}

export function areaDeProyecto(id: string, sub: string): Area | undefined {
  return areasDeProyecto(id).find((a) => a.href === rutaProyecto(id, sub));
}

/** Las áreas de la empresa, fuera de los proyectos. */
export const AREAS_EMPRESA: Area[] = [
  {
    nombre: "Indicadores",
    descripcion: "El CAC contra la inflación y el dólar, qué subió más y si es momento de comprar materiales.",
    href: "/indicadores",
    icono: "indicadores",
    modulos: [
      {
        nombre: "Índice CAC",
        descripcion: "El costo de la construcción de la Cámara Argentina de la Construcción, mes a mes: general, materiales y mano de obra, con calculadora.",
        href: "/indicadores/cac",
        beta: true,
      },
      {
        nombre: "Materiales",
        descripcion: "Los 50 materiales de la Cámara contra su historia: si están baratos o caros, con pesos ajustados por CAC y en dólares.",
        href: "/indicadores/materiales",
        beta: true,
      },
    ],
  },
];

/** Las áreas que se mudaron a los proyectos: sus rutas viejas llevan a Lerma (ver next.config.ts). */
export const RUTAS_MUDADAS = ["administracion", "finanzas", "inversores"];
