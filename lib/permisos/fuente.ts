import "server-only";
import { allowedEmails } from "../auth/allowed";
import { CrmSinConfigurar } from "../crm/fuente";
import { esDelEquipo, persona } from "../equipo";
import { googleClient } from "../google/auth";
import { PestaniaSimple } from "../google/pestania";
import { accesoDe, combinarRoles, COLUMNAS_ROLES, COLUMNAS_USUARIOS, filaDeRol, filaDeUsuario, rolDeFila, SUPER_ADMIN, usuarioDeFila, type Acceso, type ConfigUsuario, type Rol } from "./modelo";

/** La configuración de los usuarios y los roles vive en la planilla del CRM, pestañas "Usuarios" y "Roles" (se crean solas). */
function pestania(nombre: "Usuarios" | "Roles" = "Usuarios") {
  const client = googleClient();
  const sheet = process.env.CRM_SHEET_ID || process.env.COLA_SHEET_ID;
  if (!client || !sheet) throw new CrmSinConfigurar("Los permisos no se pueden leer: falta la planilla del CRM (COLA_SHEET_ID o CRM_SHEET_ID en Vercel).");
  return new PestaniaSimple(client, sheet, nombre, nombre === "Usuarios" ? COLUMNAS_USUARIOS : COLUMNAS_ROLES);
}

// Los roles cambiados o creados: igual que los usuarios, un minuto en memoria y lo último leído si falla.
let cacheRoles: { hasta: number; valor: Rol[] } | null = null;
let pedidoRoles: Promise<Rol[]> | null = null;

/** Los roles: los de fábrica con los cambios de la planilla, más los creados. */
export async function leerRoles(): Promise<Rol[]> {
  if (cacheRoles && cacheRoles.hasta > Date.now()) return cacheRoles.valor;
  let t: ReturnType<typeof pestania>;
  try {
    t = pestania("Roles");
  } catch (e) {
    if (e instanceof CrmSinConfigurar) return combinarRoles([]);
    throw e;
  }
  pedidoRoles ??= t
    .filas()
    .then((f) => {
      const valor = combinarRoles(f.filter((x) => x[0]).map(rolDeFila));
      cacheRoles = { hasta: Date.now() + 60_000, valor };
      return valor;
    })
    .catch((e) => {
      if (cacheRoles) return cacheRoles.valor;
      throw e;
    })
    .finally(() => {
      pedidoRoles = null;
    });
  return pedidoRoles;
}

/** Guarda un rol (reemplaza su fila o agrega una). */
export async function guardarRol(r: Pick<Rol, "id" | "nombre" | "descripcion" | "claves">): Promise<void> {
  const t = pestania("Roles");
  const filas = await t.filas();
  const i = filas.findIndex((f) => (f[0] ?? "").trim() === r.id);
  const fila = filaDeRol(r, new Date().toISOString());
  if (i >= 0) await t.escribir(i + 2, fila);
  else await t.agregar(fila);
  cacheRoles = null;
}

/** Borra lo guardado de un rol: uno de fábrica vuelve a como venía; uno creado deja de existir. */
export async function borrarRol(id: string): Promise<boolean> {
  const t = pestania("Roles");
  const filas = await t.filas();
  const i = filas.findIndex((f) => (f[0] ?? "").trim() === id);
  if (i < 0) return false;
  await t.escribir(i + 2, COLUMNAS_ROLES.map(() => ""));
  cacheRoles = null;
  return true;
}

// Se lee en cada página y cada pedido de datos: se guarda un minuto. Si la planilla falla, sirve
// lo último leído (si nunca se leyó, falla: mejor no mostrar que mostrar de más).
let cache: { hasta: number; valor: ConfigUsuario[] } | null = null;
let pedido: Promise<ConfigUsuario[]> | null = null;

export async function leerConfigs(fresco = false): Promise<ConfigUsuario[]> {
  if (!fresco && cache && cache.hasta > Date.now()) return cache.valor;
  let t: ReturnType<typeof pestania>;
  try {
    t = pestania();
  } catch (e) {
    // Sin planilla configurada no hay nadie configurado (cada uno queda con lo de por defecto).
    if (e instanceof CrmSinConfigurar) return [];
    throw e;
  }
  pedido ??= t
    .filas()
    .then((f) => {
      const valor = f.filter((x) => x[0]).map(usuarioDeFila);
      cache = { hasta: Date.now() + 60_000, valor };
      return valor;
    })
    .catch((e) => {
      if (cache) return cache.valor;
      throw e;
    })
    .finally(() => {
      pedido = null;
    });
  return pedido;
}

/** Lo que puede ver un usuario. El super administrador no depende de la planilla. */
export async function accesoDeEmail(email: string): Promise<Acceso> {
  const e = email.trim().toLowerCase();
  if (e === SUPER_ADMIN) return accesoDe(e, undefined, true);
  const [configs, roles] = await Promise.all([leerConfigs(), leerRoles()]);
  return accesoDe(e, configs.find((c) => c.email === e), esDelEquipo(e), roles);
}

/** Los usuarios del sistema (los mails habilitados) con su configuración, para Ajustes y las menciones. */
export async function usuariosConfigurados(): Promise<{ email: string; config: ConfigUsuario | null; acceso: Acceso; apodo: string; nombre: string }[]> {
  const [configs, roles] = await Promise.all([leerConfigs().catch(() => [] as ConfigUsuario[]), leerRoles().catch(() => combinarRoles([]))]);
  return [...allowedEmails()].map((email) => {
    const config = configs.find((c) => c.email === email) ?? null;
    const p = persona(email);
    return {
      email,
      config,
      acceso: accesoDe(email, config ?? undefined, esDelEquipo(email), roles),
      apodo: config?.usuario || p.apodo,
      nombre: config ? [config.nombre, config.apellido].filter(Boolean).join(" ") || p.nombre : p.nombre,
    };
  });
}

/** Guarda la configuración de un usuario (reemplaza su fila o agrega una). */
export async function guardarConfig(c: ConfigUsuario): Promise<void> {
  const t = pestania();
  const filas = await t.filas();
  const i = filas.findIndex((f) => (f[0] ?? "").trim().toLowerCase() === c.email);
  if (i >= 0) await t.escribir(i + 2, filaDeUsuario(c));
  else await t.agregar(filaDeUsuario(c));
  cache = null;
}

/** El nombre para mostrar y el @usuario de alguien (de Ajustes, o el de siempre). */
export async function perfilDe(email: string): Promise<{ nombre: string; apodo: string; config: ConfigUsuario | null }> {
  const e = email.trim().toLowerCase();
  const config = (await leerConfigs().catch(() => [] as ConfigUsuario[])).find((c) => c.email === e) ?? null;
  const p = persona(e);
  return { nombre: (config && [config.nombre, config.apellido].filter(Boolean).join(" ")) || p.nombre, apodo: config?.usuario || p.apodo, config };
}
