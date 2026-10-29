import "server-only";
import carpetasConfiguradas from "../config/drive.json";
import type { Categoria } from "./invoice/schema";
import { planillaDesdeEnv } from "./sheets/planilla";
import { almacenDesdeEnv } from "./storage/archivos";

/**
 * Los accesos directos del panel a la planilla y a las carpetas de Drive. La web nunca muestra
 * los links de Google: cada botón apunta a /ir/<destino>, que pide sesión y recién ahí
 * redirige (app/ir/[destino]/route.ts). Abrir el archivo en Google igual requiere que la cuenta
 * de quien entra tenga permiso en Google: ver "Accesos a la planilla y a Drive" en el README.
 */
export const DESTINOS = {
  "planilla-egresos": { grupo: "planilla", texto: "Planilla · Compras y honorarios" },
  "planilla-ingresos": { grupo: "planilla", texto: "Planilla · Ventas" },
  "drive-compra": { grupo: "drive", texto: "Drive · Compras" },
  "drive-honorarios": { grupo: "drive", texto: "Drive · Honorarios" },
  "drive-venta": { grupo: "drive", texto: "Drive · Ventas" },
} as const;
export type Destino = keyof typeof DESTINOS;

export interface Enlace {
  destino: Destino;
  grupo: "planilla" | "drive";
  texto: string;
  /** Si no está disponible, por qué (qué falta configurar). */
  falta: string | null;
}

export const esDestino = (d: string): d is Destino => Object.hasOwn(DESTINOS, d);

/** Los links de las carpetas cambian solo si se reconfigura el script: se piden cada 10 minutos. */
const VIGENCIA_CARPETAS_MS = 10 * 60 * 1000;
let carpetas: { hasta: number; links: Promise<Carpetas> } | null = null;

type Carpetas = Partial<Record<Categoria | "pendientes", string>>;

function carpetasDeDrive(): Promise<Carpetas> {
  const almacen = almacenDesdeEnv();
  if (!almacen) return Promise.resolve({});
  if (!carpetas || carpetas.hasta < Date.now()) {
    const links = almacen.carpetas();
    carpetas = { hasta: Date.now() + VIGENCIA_CARPETAS_MS, links };
    links.catch(() => {
      if (carpetas?.links === links) carpetas = null;
    });
  }
  return carpetas.links;
}

/** El link de Google de un destino (y de una fila, en la planilla), o el motivo por el que no hay. */
export async function urlDe(destino: Destino, fila?: number): Promise<{ url: string } | { falta: string }> {
  if (destino === "planilla-egresos" || destino === "planilla-ingresos") {
    const planilla = planillaDesdeEnv();
    const pestania = destino === "planilla-egresos" ? "egresos" : "ingresos";
    if (!planilla?.enlace) return { falta: "Falta configurar la planilla (SHEET_ID)." };
    if (!planilla.tiene(pestania)) return { falta: "Falta configurar la pestaña de ventas (SHEET_TAB_INGRESOS)." };
    try {
      return { url: await planilla.enlace(pestania, fila) };
    } catch (e) {
      return { falta: `No se pudo abrir la planilla: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  const categoria = destino.replace("drive-", "") as Categoria;
  // Los IDs de las carpetas no son secretos (quién las abre lo decide Google): si están en
  // config/drive.json, no hace falta preguntarle al script.
  const id = (carpetasConfiguradas as Partial<Record<Categoria, string>>)[categoria]?.trim();
  if (id) return { url: `https://drive.google.com/drive/folders/${id}` };
  if (!almacenDesdeEnv()) return { falta: "Falta configurar el script de Drive (APPS_SCRIPT_URL)." };
  try {
    const url = (await carpetasDeDrive())[categoria];
    return url ? { url } : { falta: "Falta cargar los IDs de las carpetas de Drive en config/drive.json (docs/mapa.md, \"Qué falta\")." };
  } catch (e) {
    return { falta: `No se pudo hablar con el script de Drive: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Los accesos del panel, con lo que falte para cada uno. */
export async function enlaces(): Promise<Enlace[]> {
  return Promise.all(
    (Object.keys(DESTINOS) as Destino[]).map(async (destino) => {
      const r = await urlDe(destino);
      return { destino, ...DESTINOS[destino], falta: "falta" in r ? r.falta : null };
    }),
  );
}
