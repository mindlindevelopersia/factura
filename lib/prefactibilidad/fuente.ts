import "server-only";
import { CrmSinConfigurar } from "../crm/fuente";
import { nuevoId } from "../crm/modelo";
import { datosComercial, grillaSuperficies } from "../finanzas/fuente";
import { googleClient } from "../google/auth";
import { PestaniaSimple } from "../google/pestania";
import { hoyBuenosAires } from "../inversores/cobranzas";
import { proyecto as buscarProyecto } from "../modulos";
import {
  COLUMNAS_PREFACTIBILIDADES,
  COLUMNAS_VERSIONES,
  desdeExcel,
  filaDePrefactibilidad,
  filaDeVersion,
  leerSuperficiesExcel,
  prefactibilidadDeFila,
  versionDeFila,
  type DatosPrefactibilidad,
  type Prefactibilidad,
  type Version,
} from "./modelo";

/** En la planilla del CRM, pestañas "Prefactibilidades" y "Prefactibilidad Versiones" (se crean solas). */
function pestanias() {
  const client = googleClient();
  const sheet = process.env.CRM_SHEET_ID || process.env.COLA_SHEET_ID;
  if (!client || !sheet) throw new CrmSinConfigurar("La prefactibilidad no se puede guardar: falta la planilla del CRM (COLA_SHEET_ID o CRM_SHEET_ID en Vercel).");
  return {
    prefactibilidades: new PestaniaSimple(client, sheet, "Prefactibilidades", COLUMNAS_PREFACTIBILIDADES),
    versiones: new PestaniaSimple(client, sheet, "Prefactibilidad Versiones", COLUMNAS_VERSIONES),
  };
}

export async function leerPrefactibilidades(): Promise<Prefactibilidad[]> {
  const filas = await pestanias().prefactibilidades.filas();
  return filas.filter((f) => f[0]).map(prefactibilidadDeFila);
}

export async function leerVersiones(prefactibilidadId: string): Promise<Version[]> {
  const filas = await pestanias().versiones.filas();
  return filas
    .filter((f) => f[1] === prefactibilidadId)
    .map(versionDeFila)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function crearPrefactibilidad(nombre: string, datos: DatosPrefactibilidad, usuario: string, extra?: Partial<Prefactibilidad>): Promise<Prefactibilidad> {
  const ahora = new Date().toISOString();
  const p: Prefactibilidad = { id: nuevoId(), nombre, estado: "En análisis", proyecto: "", carpeta: "", creada: ahora, actualizada: ahora, edito: usuario, datos, ...extra };
  await pestanias().prefactibilidades.agregar(filaDePrefactibilidad(p));
  return p;
}

/** Cambia una prefactibilidad (busca su fila por ID). null si no está. */
export async function actualizarPrefactibilidad(id: string, cambios: Partial<Omit<Prefactibilidad, "id" | "creada">>, usuario: string): Promise<Prefactibilidad | null> {
  const t = pestanias().prefactibilidades;
  const filas = await t.filas();
  const i = filas.findIndex((f) => f[0] === id);
  if (i < 0) return null;
  const p: Prefactibilidad = { ...prefactibilidadDeFila(filas[i]), ...cambios, id, actualizada: new Date().toISOString(), edito: usuario };
  await t.escribir(i + 2, filaDePrefactibilidad(p));
  return p;
}

export async function guardarVersion(p: Prefactibilidad, nombre: string, autor: string): Promise<Version> {
  const v: Version = { id: nuevoId(), prefactibilidadId: p.id, nombre, fecha: new Date().toISOString(), autor, datos: p.datos };
  await pestanias().versiones.agregar(filaDeVersion(v));
  return v;
}

/** Arma la prefactibilidad de un proyecto con su Excel madre (pestaña Superficies y lista de precios), ya asignada. */
export async function prefactibilidadDesdeExcel(proyectoId: string, usuario: string): Promise<Prefactibilidad> {
  const p = buscarProyecto(proyectoId)!;
  const [grilla, comercial] = await Promise.all([grillaSuperficies(proyectoId), datosComercial(proyectoId)]);
  const sup = leerSuperficiesExcel(grilla);
  const datos = desdeExcel({
    ...sup,
    direccion: sup.direccion || p.nombre,
    hoy: hoyBuenosAires(),
    unidades: comercial.comercial.unidades
      .filter((u) => !u.esCochera)
      .map((u) => ({ codigo: u.codigo, piso: u.piso, tipologia: u.tipologia, cubierta: u.supCubierta, semicubierta: u.supSemicubierta, descubierta: u.supDescubierta })),
  });
  const nueva = await crearPrefactibilidad(p.nombre, datos, usuario, { estado: "Asignada", proyecto: proyectoId });
  await guardarVersion(nueva, "Cargada del Excel madre", usuario);
  return nueva;
}
