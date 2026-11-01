/**
 * Los permisos del hub: qué módulos ve cada usuario y de qué proyectos.
 *
 * - Cada módulo es una "clave" ("finanzas/cash-flow", "comercial/crm", "indicadores/cac"…).
 * - Cada rol trae sus claves por defecto. A una persona se le pueden marcar otras (reemplazan las
 *   del rol) y limitar los proyectos.
 * - El super administrador (Mati) ve todo siempre: está fijo acá, no en la planilla.
 * - Quien no tiene fila en la pestaña "Usuarios": si es del equipo (lib/equipo.ts), Administrador;
 *   si no, no ve ningún módulo hasta que se le den permisos.
 *
 * Los permisos se controlan en el servidor (páginas y datos), no solo en el menú. Todo puro.
 */

import { AREAS_EMPRESA, areasDeProyecto, PROYECTOS, PROYECTO_PRINCIPAL } from "../modulos";

export const SUPER_ADMIN = "matimindlin111@gmail.com";

export interface Permiso {
  clave: string;
  nombre: string;
  /** El área ("Comercial", "Indicadores"…), para agrupar en la grilla. */
  area: string;
  /** De un proyecto (true) o de la empresa (false). */
  deProyecto: boolean;
}

/** Todas las claves, armadas con el menú (lib/modulos.ts): un área sin módulos es una clave; si tiene módulos, cada módulo. */
export const PERMISOS: Permiso[] = (() => {
  const r: Permiso[] = [];
  for (const a of AREAS_EMPRESA) for (const m of a.modulos) r.push({ clave: m.href.slice(1), nombre: m.nombre, area: a.nombre, deProyecto: false });
  const base = `/proyectos/${PROYECTO_PRINCIPAL.id}/`;
  for (const a of areasDeProyecto(PROYECTO_PRINCIPAL.id)) {
    if (!a.modulos.length) r.push({ clave: a.href.slice(base.length), nombre: a.nombre, area: a.nombre, deProyecto: true });
    for (const m of a.modulos) r.push({ clave: m.href.slice(base.length), nombre: m.nombre, area: a.nombre, deProyecto: true });
  }
  r.push({ clave: "ajustes", nombre: "Ajustes (usuarios y permisos)", area: "Ajustes", deProyecto: false });
  return r;
})();

const todas = PERMISOS.map((p) => p.clave);
const sin = (...fuera: string[]) => todas.filter((c) => !fuera.includes(c));

export interface Rol {
  id: string;
  nombre: string;
  descripcion: string;
  claves: string[];
}

export const ROLES: Rol[] = [
  { id: "super", nombre: "Super administrador", descripcion: "Todo, incluido Ajustes y los roles. Solo Mati.", claves: todas },
  { id: "admin", nombre: "Administrador", descripcion: "Todo, incluido Ajustes (puede editar usuarios, no dar el rol de super administrador).", claves: todas },
  { id: "developer", nombre: "Developer (dueño)", descripcion: "Los dueños: ven todo menos Ajustes.", claves: sin("ajustes") },
  {
    id: "contador",
    nombre: "Contador",
    descripcion: "Administración, Finanzas, Inversores, Calendario y Tareas.",
    claves: ["administracion/facturas", "finanzas/ingresos", "finanzas/cash-flow", "finanzas/egresos", "inversores/cuentas-corrientes", "inversores/cobranzas", "calendario", "tareas"],
  },
  { id: "vendedor", nombre: "Vendedor", descripcion: "Comercial (unidades, lista de precios, propuestas y CRM), Calendario y Tareas.", claves: ["comercial/unidades", "comercial/lista-de-precios", "comercial/propuesta", "comercial/crm", "calendario", "tareas"] },
  { id: "arquitectura", nombre: "Arquitectura", descripcion: "Unidades, Indicadores (CAC y materiales), Calendario y Tareas.", claves: ["comercial/unidades", "indicadores/cac", "indicadores/materiales", "calendario", "tareas"] },
  {
    id: "analista",
    nombre: "Analista",
    descripcion: "Indicadores, Finanzas, Unidades y Lista de precios, Calendario y Tareas.",
    claves: ["indicadores/cac", "indicadores/materiales", "finanzas/ingresos", "finanzas/cash-flow", "finanzas/egresos", "comercial/unidades", "comercial/lista-de-precios", "calendario", "tareas"],
  },
  { id: "sin-rol", nombre: "Sin permisos", descripcion: "Solo el inicio, hasta que se le asigne un rol.", claves: [] },
];

export const rolDe = (id: string) => ROLES.find((r) => r.id === id) ?? ROLES.find((r) => r.id === "sin-rol")!;

/** Lo que se guarda de cada usuario (pestaña "Usuarios" de la planilla del CRM). */
export interface ConfigUsuario {
  email: string;
  nombre: string;
  apellido: string;
  /** Para mencionarlo con @ ("Tadeo"). */
  usuario: string;
  celular: string;
  horario: string;
  puesto: string;
  rol: string;
  /** null: las del rol. Si no, estas claves (reemplazan las del rol). */
  claves: string[] | null;
  /** null: todos los proyectos. */
  proyectos: string[] | null;
  actualizado: string;
}

export const COLUMNAS_USUARIOS = ["Email", "Nombre", "Apellido", "Usuario", "Celular", "Horario", "Puesto", "Rol", "Permisos", "Proyectos", "Actualizado"] as const;

export const filaDeUsuario = (u: ConfigUsuario): string[] => [
  u.email.toLowerCase(),
  u.nombre,
  u.apellido,
  u.usuario,
  u.celular,
  u.horario,
  u.puesto,
  u.rol,
  u.claves ? u.claves.join(",") : "",
  u.proyectos ? u.proyectos.join(",") : "",
  u.actualizado,
];

const lista = (t: string | undefined) =>
  (t ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export const usuarioDeFila = (f: string[]): ConfigUsuario => ({
  email: (f[0] ?? "").trim().toLowerCase(),
  nombre: (f[1] ?? "").trim(),
  apellido: (f[2] ?? "").trim(),
  usuario: (f[3] ?? "").trim().replace(/^@/, ""),
  celular: (f[4] ?? "").trim(),
  horario: (f[5] ?? "").trim(),
  puesto: (f[6] ?? "").trim(),
  rol: (f[7] ?? "").trim() || "sin-rol",
  claves: (f[8] ?? "").trim() ? lista(f[8]).filter((c) => todas.includes(c)) : null,
  proyectos: (f[9] ?? "").trim() ? lista(f[9]) : null,
  actualizado: (f[10] ?? "").trim(),
});

export interface Acceso {
  email: string;
  rol: string;
  superAdmin: boolean;
  claves: string[];
  /** null: todos. */
  proyectos: string[] | null;
}

/** Lo que puede ver alguien, con su configuración (o sin ella). */
export function accesoDe(email: string, config: ConfigUsuario | undefined, esDelEquipo: boolean): Acceso {
  const e = email.trim().toLowerCase();
  if (e === SUPER_ADMIN) return { email: e, rol: "super", superAdmin: true, claves: todas, proyectos: null };
  const rol = config ? (config.rol === "super" ? "admin" : config.rol) : esDelEquipo ? "admin" : "sin-rol";
  return { email: e, rol, superAdmin: false, claves: config?.claves ?? rolDe(rol).claves, proyectos: config?.proyectos ?? null };
}

export const veProyecto = (a: Acceso, proyecto: string) => a.superAdmin || !a.proyectos || a.proyectos.includes(proyecto);

/** ¿Puede ver esta clave (en este proyecto, si es de proyecto)? */
export function puede(a: Acceso, clave: string, proyecto?: string): boolean {
  if (a.superAdmin) return true;
  if (proyecto && !veProyecto(a, proyecto)) return false;
  return a.claves.includes(clave);
}

/** ¿Ve algo del área (por ejemplo "finanzas")? Para las páginas de área y el menú. */
export const veArea = (a: Acceso, area: string, proyecto?: string) => a.superAdmin || ((!proyecto || veProyecto(a, proyecto)) && a.claves.some((c) => c === area || c.startsWith(`${area}/`)));

/** Qué hace falta para una ruta del hub: null si cualquiera con sesión puede. */
export function requisitoDeRuta(ruta: string): { clave?: string; area?: string; proyecto?: string } | null {
  const camino = ruta.split("?")[0].replace(/\/+$/, "") || "/";
  if (camino === "/ajustes" || camino.startsWith("/ajustes/")) return { clave: "ajustes" };
  if (camino.startsWith("/indicadores/")) {
    const clave = PERMISOS.find((p) => !p.deProyecto && camino.startsWith(`/${p.clave}`))?.clave;
    return clave ? { clave } : { area: "indicadores" };
  }
  if (camino === "/indicadores") return { area: "indicadores" };
  const m = camino.match(/^\/proyectos\/([^/]+)(?:\/(.*))?$/);
  if (m) {
    const [, proyecto, resto = ""] = m;
    if (!resto) return { proyecto };
    const clave = PERMISOS.filter((p) => p.deProyecto && (resto === p.clave || resto.startsWith(`${p.clave}/`))).sort((a, b) => b.clave.length - a.clave.length)[0]?.clave;
    return clave ? { clave, proyecto } : { area: resto.split("/")[0], proyecto };
  }
  return null;
}

/** ¿Puede abrir esta ruta del hub? (Para el menú, el buscador y Oliver.) */
export function puedeRuta(a: Acceso, ruta: string): boolean {
  const r = requisitoDeRuta(ruta);
  if (!r) return true;
  if (r.clave) return puede(a, r.clave, r.proyecto);
  if (r.area) return veArea(a, r.area, r.proyecto);
  return !r.proyecto || veProyecto(a, r.proyecto);
}

/** Los proyectos que ve. */
export const proyectosQueVe = (a: Acceso) => PROYECTOS.filter((p) => veProyecto(a, p.id));

/** Revisa lo que llega de Ajustes: el error, o la configuración limpia. */
export function validarConfig(x: unknown, permitidos: string[], quienEdita: Acceso): { error: string } | { config: Omit<ConfigUsuario, "actualizado"> } {
  const o = (x ?? {}) as Record<string, unknown>;
  const texto = (k: string, max: number) => (typeof o[k] === "string" ? (o[k] as string).trim().slice(0, max) : "");
  const email = texto("email", 200).toLowerCase();
  if (!permitidos.includes(email)) return { error: "Ese mail no está habilitado para entrar al hub (ALLOWED_EMAILS en Vercel)." };
  if (email === SUPER_ADMIN && !quienEdita.superAdmin) return { error: "Al super administrador solo lo edita él mismo." };
  const rol = texto("rol", 30);
  if (!ROLES.some((r) => r.id === rol) || rol === "super") return { error: "Elegí un rol." };
  const usuario = texto("usuario", 40).replace(/^@/, "");
  if (usuario && !/^[\p{L}\d._-]+$/u.test(usuario)) return { error: "El @usuario no puede tener espacios ni símbolos (sí puntos, guiones y _)." };
  const claves = o.claves === null || o.claves === undefined ? null : Array.isArray(o.claves) ? [...new Set(o.claves.map(String).filter((c) => todas.includes(c)))] : null;
  const proyectos = o.proyectos === null || o.proyectos === undefined ? null : Array.isArray(o.proyectos) ? [...new Set(o.proyectos.map(String).filter((p) => PROYECTOS.some((x) => x.id === p)))] : null;
  return {
    config: { email, nombre: texto("nombre", 60), apellido: texto("apellido", 60), usuario, celular: texto("celular", 40), horario: texto("horario", 80), puesto: texto("puesto", 60), rol, claves, proyectos },
  };
}
