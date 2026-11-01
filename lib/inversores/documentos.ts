/**
 * La documentación firmada de cada inversor: en Drive, una carpeta por inversor dentro de la
 * carpeta de documentación del proyecto. Lo que vale son los PDF sueltos de esa carpeta (el
 * boleto, el compromiso de deuda…, escaneados); las subcarpetas ("editables") no.
 *
 * Acá: qué tipo de documento es cada archivo y a qué cuenta corriente va cada carpeta (por el
 * nombre del inversor y la unidad). Lo que no se puede asignar con seguridad queda "sin asignar"
 * para elegirlo a mano. Puro.
 */

export interface ArchivoDrive {
  id: string;
  nombre: string;
  mimeType: string;
  modificado: string;
}

export interface CarpetaInversor {
  id: string;
  nombre: string;
  archivos: ArchivoDrive[];
}

export interface Documento {
  id: string;
  nombre: string;
  tipo: string;
  modificado: string;
  carpeta: string;
}

const PALABRAS_VACIAS = new Set(["de", "del", "la", "las", "los", "y", "e", "sa", "srl", "uf", "depto", "dto", "unidad", "lerma", "guemes"]);

export const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const palabras = (t: string) => normalizar(t).split(" ").filter((p) => p.length >= 3 && !PALABRAS_VACIAS.has(p));

/** Si el archivo es documentación (un PDF o una imagen escaneada). */
export const esDocumento = (a: Pick<ArchivoDrive, "mimeType">) => a.mimeType === "application/pdf" || a.mimeType.startsWith("image/");

/** El tipo de documento, por el nombre del archivo. */
export function tipoDocumento(nombre: string): string {
  const n = normalizar(nombre);
  if (n.includes("compromiso")) return "Compromiso de deuda";
  if (n.includes("boleto")) return "Boleto";
  if (n.includes("mutuo")) return "Mutuo";
  if (n.includes("adenda")) return "Adenda";
  if (n.includes("cesion")) return "Cesión";
  if (n.includes("recibo")) return "Recibo";
  if (n.includes("reserva")) return "Reserva";
  return "Documento";
}

/** Qué tanto se parece el nombre de una carpeta a una cuenta: la unidad suma 3; cada palabra del nombre, 1. */
export function parecido(carpeta: string, cuenta: { inversor: string; unidad: string }): number {
  const tokens = new Set(normalizar(carpeta).split(" "));
  const unidad = normalizar(cuenta.unidad).replace(/\s/g, "");
  const conUnidad = unidad && (tokens.has(unidad) || tokens.has(`uf${unidad}`) || normalizar(carpeta).replace(/\s/g, "").includes(`uf${unidad}`));
  const enComun = palabras(cuenta.inversor).filter((p) => tokens.has(p)).length;
  return (conUnidad ? 3 : 0) + enComun;
}

export interface Asignacion {
  /** cuentaId → las carpetas que son suyas. */
  porCuenta: Record<string, string[]>;
  sinAsignar: string[];
}

/**
 * A qué cuenta va cada carpeta. Primero las elegidas a mano; después, la cuenta que más se
 * parece, si es clara: dos coincidencias (dos palabras del nombre, o la unidad), o una sola si
 * ninguna otra cuenta tiene esa palabra. Si hay empate entre cuentas del mismo inversor (dos
 * unidades), va a todas; si es entre inversores distintos, queda sin asignar.
 */
export function asignarCarpetas(carpetas: { id: string; nombre: string }[], cuentas: { id: string; inversor: string; unidad: string }[], manuales: Record<string, string> = {}): Asignacion {
  const porCuenta: Record<string, string[]> = {};
  const sinAsignar: string[] = [];
  const sumar = (cuenta: string, carpeta: string) => (porCuenta[cuenta] ??= []).push(carpeta);
  for (const c of carpetas) {
    if (manuales[c.id] !== undefined) {
      if (manuales[c.id]) sumar(manuales[c.id], c.id);
      else sinAsignar.push(c.id);
      continue;
    }
    const puntajes = cuentas.map((x) => ({ x, p: parecido(c.nombre, x) })).filter((y) => y.p > 0);
    const mejor = Math.max(0, ...puntajes.map((y) => y.p));
    const ganadoras = puntajes.filter((y) => y.p === mejor).map((y) => y.x);
    const mismoInversor = new Set(ganadoras.map((x) => normalizar(x.inversor))).size === 1;
    const clara = mejor >= 2 || (mejor === 1 && puntajes.length === ganadoras.length);
    if (ganadoras.length && clara && mismoInversor) for (const x of ganadoras) sumar(x.id, c.id);
    else sinAsignar.push(c.id);
  }
  return { porCuenta, sinAsignar };
}

/** Los documentos de una carpeta, para mostrar (los más nuevos primero). */
export const documentosDe = (c: CarpetaInversor): Documento[] =>
  c.archivos
    .filter(esDocumento)
    .map((a) => ({ id: a.id, nombre: a.nombre, tipo: tipoDocumento(a.nombre), modificado: a.modificado, carpeta: c.nombre }))
    .sort((a, b) => b.modificado.localeCompare(a.modificado));
