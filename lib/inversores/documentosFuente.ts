import "server-only";
import { CrmSinConfigurar } from "../crm/fuente";
import { googleClient, googleDriveLectura } from "../google/auth";
import { PestaniaSimple } from "../google/pestania";
import { proyecto as buscarProyecto } from "../modulos";
import type { ArchivoDrive, CarpetaInversor } from "./documentos";

/**
 * La documentación firmada en Drive (solo lectura, con la cuenta de servicio). Se lee la carpeta
 * del proyecto y la de cada inversor, y se guarda unos minutos para no pedirle a Drive cada vez.
 * Las carpetas asignadas a mano van en la pestaña "Documentación inversores" de la planilla del CRM.
 */

export class DocumentacionSinConfigurar extends Error {}

const CARPETA = "application/vnd.google-apps.folder";
const VIGENCIA_MS = 10 * 60 * 1000;

interface Respuesta {
  files?: { id: string; name: string; mimeType: string; modifiedTime?: string }[];
  nextPageToken?: string;
}

async function hijos(carpeta: string): Promise<ArchivoDrive[]> {
  const client = googleDriveLectura();
  if (!client) throw new DocumentacionSinConfigurar("Falta la cuenta de servicio de Google en Vercel.");
  const r: ArchivoDrive[] = [];
  let pagina: string | undefined;
  do {
    const q = encodeURIComponent(`'${carpeta}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,name,mimeType,modifiedTime)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${pagina ? `&pageToken=${pagina}` : ""}`;
    let res: { data: Respuesta };
    try {
      res = await client.request<Respuesta>({ url });
    } catch (e) {
      throw traducir(e);
    }
    for (const f of res.data.files ?? []) r.push({ id: f.id, nombre: f.name, mimeType: f.mimeType, modificado: (f.modifiedTime ?? "").slice(0, 10) });
    pagina = res.data.nextPageToken;
  } while (pagina);
  return r;
}

/** Los errores de Drive, dichos para quien tiene que arreglarlos. */
function traducir(e: unknown): Error {
  const m = e instanceof Error ? e.message : String(e);
  const cuenta = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "la cuenta de servicio";
  if (/has not been used|is disabled|SERVICE_DISABLED/i.test(m)) return new DocumentacionSinConfigurar("Falta activar la API de Google Drive en el proyecto de Google Cloud de la cuenta de servicio.");
  if (/not found|404/i.test(m)) return new DocumentacionSinConfigurar(`No puedo ver la carpeta de documentación: compartila como Lector con ${cuenta}.`);
  if (/insufficient|403|forbidden/i.test(m)) return new DocumentacionSinConfigurar(`Drive no me deja leer la documentación: compartí la carpeta como Lector con ${cuenta}.`);
  return e instanceof Error ? e : new Error(m);
}

const cache = new Map<string, { hasta: number; valor: Promise<CarpetaInversor[]> }>();

/** Las carpetas de los inversores de un proyecto, con sus archivos (sin entrar en las subcarpetas). */
export async function carpetasInversores(proyectoId: string, { fresco = false } = {}): Promise<CarpetaInversor[]> {
  const raiz = buscarProyecto(proyectoId)?.carpetaDocumentacion;
  if (!raiz) throw new DocumentacionSinConfigurar("Este proyecto no tiene configurada la carpeta de documentación.");
  const c = cache.get(proyectoId);
  if (!fresco && c && c.hasta > Date.now()) return c.valor;
  const valor = (async () => {
    const carpetas = (await hijos(raiz)).filter((x) => x.mimeType === CARPETA);
    const conArchivos: CarpetaInversor[] = [];
    // De a cinco, para no pasarse de lo que Drive deja pedir por segundo.
    for (let i = 0; i < carpetas.length; i += 5) {
      const tanda = await Promise.all(carpetas.slice(i, i + 5).map(async (x) => ({ id: x.id, nombre: x.nombre, archivos: (await hijos(x.id)).filter((a) => a.mimeType !== CARPETA) })));
      conArchivos.push(...tanda);
    }
    return conArchivos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  })();
  const entrada = { hasta: Date.now() + VIGENCIA_MS, valor };
  cache.set(proyectoId, entrada);
  valor.catch(() => cache.get(proyectoId) === entrada && cache.delete(proyectoId));
  return valor;
}

/** Baja un archivo de Drive (para mostrarlo a través del hub). */
export async function bajarArchivo(id: string): Promise<{ data: ArrayBuffer; mimeType: string }> {
  const client = googleDriveLectura();
  if (!client) throw new DocumentacionSinConfigurar("Falta la cuenta de servicio de Google en Vercel.");
  try {
    const res = await client.request<ArrayBuffer>({ url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, responseType: "arraybuffer" });
    return { data: res.data, mimeType: res.headers.get("content-type") ?? "application/pdf" };
  } catch (e) {
    throw traducir(e);
  }
}

// ——— Asignaciones a mano ———
const COLUMNAS = ["Proyecto", "Carpeta", "Nombre de la carpeta", "Cuenta", "Asignó", "Fecha"] as const;

function pestania() {
  const client = googleClient();
  const sheet = process.env.CRM_SHEET_ID || process.env.COLA_SHEET_ID;
  if (!client || !sheet) throw new CrmSinConfigurar("Falta la planilla del CRM (COLA_SHEET_ID o CRM_SHEET_ID en Vercel).");
  return new PestaniaSimple(client, sheet, "Documentación inversores", COLUMNAS);
}

/** carpetaId → cuentaId ("" = ninguna) de las elegidas a mano. */
export async function asignacionesManuales(proyectoId: string): Promise<Record<string, string>> {
  const r: Record<string, string> = {};
  for (const f of await pestania().filas()) if (f[0] === proyectoId && f[1]) r[f[1]] = f[3] ?? "";
  return r;
}

export async function asignarAMano(o: { proyecto: string; carpeta: string; nombre: string; cuenta: string; usuario: string }): Promise<void> {
  const t = pestania();
  const filas = await t.filas();
  const i = filas.findIndex((f) => f[0] === o.proyecto && f[1] === o.carpeta);
  const fila = [o.proyecto, o.carpeta, o.nombre, o.cuenta, o.usuario, new Date().toISOString()];
  if (i >= 0) await t.escribir(i + 2, fila);
  else await t.agregar(fila);
}
