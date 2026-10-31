/**
 * Las áreas del hub de Mindlin y sus módulos. El menú lateral, el inicio y la página de cada área
 * salen de acá: para sumar un área o un módulo nuevo, se agrega en esta lista y se crea su página.
 * Un área sin módulos se muestra como "Próximamente".
 */

/** Dónde vive el módulo de facturas. Lo usan los links que manda el bot de Telegram. */
export const RUTA_FACTURAS = "/administracion/facturas";

export type IconoArea = "administracion" | "finanzas";

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
    ],
  },
];
