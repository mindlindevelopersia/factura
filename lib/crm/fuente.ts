import "server-only";
import { googleClient } from "../google/auth";
import { PestaniaSimple } from "../google/pestania";
import {
  actividadDeFila,
  aplicarCambios,
  COLUMNAS_ACTIVIDAD,
  COLUMNAS_CONTACTOS,
  contactoDeFila,
  filaDeActividad,
  filaDeContacto,
  type Actividad,
  type CambiosContacto,
  type Contacto,
} from "./modelo";

/** El CRM no está configurado: falta la planilla donde escribe. */
export class CrmSinConfigurar extends Error {}

/**
 * Dónde vive el CRM: CRM_SHEET_ID si está, si no la planilla de la cola (COLA_SHEET_ID), que la app
 * ya puede editar. Dos pestañas: "CRM Contactos" y "CRM Actividad" (se crean solas).
 */
function pestanias() {
  const client = googleClient();
  const sheet = process.env.CRM_SHEET_ID || process.env.COLA_SHEET_ID;
  if (!client || !sheet) throw new CrmSinConfigurar("El CRM no está configurado: falta la planilla donde guarda (COLA_SHEET_ID o CRM_SHEET_ID en Vercel).");
  return {
    contactos: new PestaniaSimple(client, sheet, "CRM Contactos", COLUMNAS_CONTACTOS),
    actividad: new PestaniaSimple(client, sheet, "CRM Actividad", COLUMNAS_ACTIVIDAD),
  };
}

export async function leerCrm(): Promise<{ contactos: Contacto[]; actividad: Actividad[] }> {
  const p = pestanias();
  const [c, a] = await Promise.all([p.contactos.filas(), p.actividad.filas()]);
  return {
    contactos: c.filter((f) => f[0]).map(contactoDeFila),
    actividad: a.filter((f) => f[0]).map(actividadDeFila).sort((x, y) => y.fecha.localeCompare(x.fecha)),
  };
}

export async function crearContacto(c: Contacto, actividad: Actividad | null): Promise<void> {
  const p = pestanias();
  await p.contactos.agregar(filaDeContacto(c));
  if (actividad) await p.actividad.agregar(filaDeActividad(actividad));
}

export async function importarContactos(nuevos: Contacto[]): Promise<void> {
  await pestanias().contactos.agregarVarias(nuevos.map(filaDeContacto));
}

/** Cambia un contacto (busca su fila por ID) y, si hay, registra la actividad. Devuelve el contacto nuevo (y cómo estaba en `antes`). */
export async function actualizarContacto(id: string, cambios: CambiosContacto, actividad: Omit<Actividad, "contacto" | "etapa"> | null, ahora: string, antesOut?: { contacto?: Contacto }): Promise<Contacto | null> {
  const p = pestanias();
  const filas = await p.contactos.filas();
  const i = filas.findIndex((f) => f[0] === id);
  if (i < 0) return null;
  const antes = contactoDeFila(filas[i]);
  if (antesOut) antesOut.contacto = antes;
  let nuevo = aplicarCambios(antes, cambios, ahora);
  if (actividad && actividad.tipo !== "Nota") nuevo = { ...nuevo, ultimoContacto: ahora };
  await p.contactos.escribir(i + 2, filaDeContacto(nuevo));
  const registros: Actividad[] = [];
  if (cambios.etapa && cambios.etapa !== antes.etapa) {
    registros.push({ fecha: ahora, usuario: actividad?.usuario ?? "", contactoId: id, contacto: nuevo.nombre, tipo: "Cambio de etapa", detalle: `${antes.etapa} → ${nuevo.etapa}${nuevo.etapa === "Perdido" && nuevo.motivoPerdida ? ` (${nuevo.motivoPerdida})` : ""}`, etapa: nuevo.etapa });
  }
  if (actividad && (actividad.detalle.trim() || actividad.tipo !== "Nota")) registros.push({ ...actividad, contacto: nuevo.nombre, etapa: nuevo.etapa });
  for (const r of registros) await p.actividad.agregar(filaDeActividad(r));
  return nuevo;
}
