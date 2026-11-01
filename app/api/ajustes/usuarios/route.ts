import { NextResponse } from "next/server";
import { allowedEmails } from "@/lib/auth/allowed";
import { CrmSinConfigurar } from "@/lib/crm/fuente";
import { PROYECTOS } from "@/lib/modulos";
import { exigir } from "@/lib/permisos/api";
import { guardarConfig, leerRoles, usuariosConfigurados } from "@/lib/permisos/fuente";
import { PERMISOS, SUPER_ADMIN, validarConfig } from "@/lib/permisos/modelo";

/** Los usuarios con su configuración y permisos, los roles y los módulos (para Ajustes). */
export async function GET() {
  const permiso = await exigir("/ajustes");
  if (permiso instanceof NextResponse) return permiso;
  return NextResponse.json({
    usuarios: await usuariosConfigurados(),
    roles: await leerRoles(),
    permisos: PERMISOS,
    proyectos: PROYECTOS.map((p) => ({ id: p.id, nombre: p.nombre })),
    superAdmin: SUPER_ADMIN,
    yo: permiso.acceso,
  });
}

/** Guarda la configuración de un usuario. */
export async function PUT(req: Request) {
  const permiso = await exigir("/ajustes");
  if (permiso instanceof NextResponse) return permiso;
  const v = validarConfig(await req.json().catch(() => null), [...allowedEmails()], permiso.acceso, await leerRoles());
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  try {
    await guardarConfig({ ...v.config, actualizado: new Date().toISOString() });
    return NextResponse.json({ usuarios: await usuariosConfigurados() });
  } catch (e) {
    console.error("ajustes usuarios", e);
    if (e instanceof CrmSinConfigurar) return NextResponse.json({ error: e.message }, { status: 503 });
    return NextResponse.json({ error: `No se pudo guardar. ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
}
