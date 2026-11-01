import { NextResponse } from "next/server";
import { CrmSinConfigurar } from "@/lib/crm/fuente";
import { exigir } from "@/lib/permisos/api";
import { guardarConfig, leerRoles, perfilDe } from "@/lib/permisos/fuente";
import { PERMISOS, rolDe } from "@/lib/permisos/modelo";

/** Mis datos, mi rol y lo que veo. */
export async function GET() {
  const permiso = await exigir();
  if (permiso instanceof NextResponse) return permiso;
  const { user, acceso } = permiso;
  const p = await perfilDe(user.email);
  return NextResponse.json({
    email: user.email,
    nombre: p.config?.nombre ?? p.nombre.split(" ")[0] ?? "",
    apellido: p.config?.apellido ?? p.nombre.split(" ").slice(1).join(" "),
    usuario: p.apodo,
    celular: p.config?.celular ?? "",
    horario: p.config?.horario ?? "",
    puesto: p.config?.puesto ?? "",
    rol: acceso.superAdmin ? "Super administrador" : rolDe(acceso.rol, await leerRoles().catch(() => undefined)).nombre,
    modulos: PERMISOS.filter((x) => acceso.claves.includes(x.clave)).map((x) => (x.nombre === x.area ? x.nombre : `${x.area} · ${x.nombre}`)),
    proyectos: acceso.proyectos,
  });
}

/** Guarda mis datos (no el rol ni los permisos: eso lo cambia un administrador). */
export async function PUT(req: Request) {
  const permiso = await exigir();
  if (permiso instanceof NextResponse) return permiso;
  const { user, acceso } = permiso;
  const o = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const texto = (k: string, max: number) => (typeof o[k] === "string" ? (o[k] as string).trim().slice(0, max) : "");
  const usuario = texto("usuario", 40).replace(/^@/, "");
  if (usuario && !/^[\p{L}\d._-]+$/u.test(usuario)) return NextResponse.json({ error: "El @usuario no puede tener espacios ni símbolos (sí puntos, guiones y _)." }, { status: 400 });
  const actual = (await perfilDe(user.email)).config;
  try {
    await guardarConfig({
      email: user.email.toLowerCase(),
      nombre: texto("nombre", 60),
      apellido: texto("apellido", 60),
      usuario,
      celular: texto("celular", 40),
      horario: texto("horario", 80),
      // Lo que define un administrador queda como estaba (o como entra hoy, si no estaba configurado).
      puesto: actual?.puesto ?? "",
      rol: actual?.rol ?? (acceso.superAdmin ? "admin" : acceso.rol),
      claves: actual?.claves ?? null,
      proyectos: actual?.proyectos ?? null,
      actualizado: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("perfil", e);
    if (e instanceof CrmSinConfigurar) return NextResponse.json({ error: e.message }, { status: 503 });
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 502 });
  }
}
