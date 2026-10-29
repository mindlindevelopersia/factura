import type { Pendiente } from "../lib/cola/servicio";
import { facturaDePrueba, ventaDePrueba } from "./fixtures";

/** Solo datos ficticios para pruebas de interfaz, sin servicios ni credenciales reales. */
export function pendienteDePrueba(cambios: Partial<Pendiente> = {}): Pendiente {
  return {
    id: "compra-ejemplo",
    recibida: "2026-10-28T13:30:00Z",
    origen: "web",
    enviadaPor: "equipo@ejemplo.com",
    archivo: {
      nombre: "factura-materiales.png",
      mediaType: "image/png",
      driveId: "ejemplo",
      url: "https://drive.google.com/",
    },
    estado: "pendiente",
    lectura: {
      factura: facturaDePrueba({ campos_dudosos: ["corresponde_a"] }),
      desde: { pestania: "egresos", fila: 28 },
      fallback: false,
    },
    error: null,
    resuelta: null,
    resueltaPor: null,
    resultado: null,
    telegram: null,
    huella: "ejemplo",
    notas: [],
    cargada: null,
    repetida: null,
    ...cambios,
  };
}

export const pendientesDeInterfaz: Pendiente[] = [
  pendienteDePrueba(),
  pendienteDePrueba({
    id: "honorarios-ejemplo",
    archivo: {
      nombre: "honorarios-octubre.png",
      mediaType: "image/png",
      driveId: "ejemplo-2",
      url: "https://drive.google.com/",
    },
    origen: "telegram",
    enviadaPor: "@equipo_ejemplo",
    recibida: "2026-10-28T14:10:00Z",
    lectura: {
      factura: facturaDePrueba({
        categoria: "honorarios",
        razon_social: "PEREZ ANA",
        numero: 45,
        concepto: "Honorarios de administración",
        corresponde_a: "HQ",
        neto_gravado: 0,
        no_gravado: 250000,
        iva_21: 0,
        total: 250000,
      }),
      desde: null,
      fallback: false,
    },
  }),
  pendienteDePrueba({
    id: "venta-ejemplo",
    archivo: {
      nombre: "venta-certificacion.png",
      mediaType: "image/png",
      driveId: "ejemplo-3",
      url: "https://drive.google.com/",
    },
    lectura: {
      factura: ventaDePrueba(),
      desde: { pestania: "ingresos", fila: 7 },
      fallback: false,
    },
    cargada: { tipo: "duplicada", fila: 8 },
  }),
  pendienteDePrueba({
    id: "error-ejemplo",
    archivo: {
      nombre: "foto-ilegible.png",
      mediaType: "image/png",
      driveId: "ejemplo-4",
      url: "https://drive.google.com/",
    },
    estado: "error",
    lectura: null,
    error:
      "No pudimos leer los datos. Verificá que la imagen esté completa y enfocada.",
  }),
];
