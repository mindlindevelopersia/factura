/**
 * Las áreas del hub de Mindlin y sus módulos. El menú lateral, el inicio y la página de cada área
 * salen de acá: para sumar un área o un módulo nuevo, se agrega en esta lista y se crea su página.
 * Un área sin módulos se muestra como "Próximamente".
 */

/** Dónde vive el módulo de facturas. Lo usan los links que manda el bot de Telegram. */
export const RUTA_FACTURAS = "/administracion/facturas";

export type IconoArea = "administracion" | "finanzas" | "inversores" | "indicadores";

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

export const AREAS: Area[] = [
  {
    nombre: "Administración",
    descripcion: "Comprobantes, registro contable y papeles de la empresa.",
    href: "/administracion",
    icono: "administracion",
    modulos: [
      {
        nombre: "Facturas y comprobantes",
        descripcion: "Compras, honorarios y ventas: la IA propone los datos y una persona revisa y aprueba.",
        href: RUTA_FACTURAS,
      },
    ],
  },
  {
    nombre: "Finanzas",
    descripcion: "Flujo de fondos, cobranzas, pagos y presupuesto.",
    href: "/finanzas",
    icono: "finanzas",
    modulos: [
      {
        nombre: "Ingresos",
        descripcion: "Lo cobrado y lo que falta cobrar de los inversores de Lerma, por mes, moneda, inversor y blanco o negro.",
        href: "/finanzas/ingresos",
        beta: true,
      },
      {
        nombre: "Egresos",
        descripcion: "Lo que se pagó en pesos y en dólares, por rubro, proyecto y blanco o negro: en qué se va la plata.",
        href: "/finanzas/egresos",
        beta: true,
      },
    ],
  },
  {
    nombre: "Inversores",
    descripcion: "Las cuentas de cada inversor: cuánto pagó, cuánto le falta y su estado de cuenta.",
    href: "/inversores",
    icono: "inversores",
    modulos: [
      {
        nombre: "Cuentas corrientes",
        descripcion: "Pagos, saldo y avance de cada inversor de Lerma, con el plan de pagos que falta y el estado de cuenta para mandarle.",
        href: "/inversores/cuentas-corrientes",
        beta: true,
      },
    ],
  },
  {
    nombre: "Indicadores",
    descripcion: "Los índices que usa la empresa: CAC, y más adelante dólar, UVA, jornales y precios de materiales.",
    href: "/indicadores",
    icono: "indicadores",
    modulos: [
      {
        nombre: "Índice CAC",
        descripcion: "El costo de la construcción de la Cámara Argentina de la Construcción, mes a mes: general, materiales y mano de obra, con calculadora.",
        href: "/indicadores/cac",
        beta: true,
      },
    ],
  },
];
