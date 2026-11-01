import { NextResponse } from "next/server";
import { CrmSinConfigurar } from "@/lib/crm/fuente";
import { exigir } from "@/lib/permisos/api";
import { borrarRol, guardarRol, leerRoles } from "@/lib/permisos/fuente";
import { ROLES_FIJOS, validarRol } from "@/lib/permisos/modelo";

/** Solo el super administrador edita los roles. */
async function soloSuper() {
  const permiso = await exigir("/ajustes");
  if (permiso instanceof NextResponse) return permiso;
  if (!permiso.acceso.superAdmin) return NextResponse.json({ error: "Los roles los edita solo el super administrador." }, { status: 403 });
  return permiso;
}

const fallo = (e: unknown) => {
  console.error("ajustes roles", e);
  if (e instanceof CrmSinConfigurar) return NextResponse.json({ error: e.message }, { status: 503 });
  return NextResponse.json({ error: `No se pudo guardar. ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
};

/** Guarda un rol: cambia uno (con id) o crea uno nuevo (sin id). */
export async function PUT(req: Request) {
  const permiso = await soloSuper();
  if (permiso instanceof NextResponse) return permiso;
  try {
    const v = validarRol(await req.json().catch(() => null), await leerRoles());
    if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
    await guardarRol(v.rol);
    return NextResponse.json({ roles: await leerRoles(), id: v.rol.id });
  } catch (e) {
    return fallo(e);
  }
}

/** ?id=…: uno de fábrica vuelve a como venía; uno creado se borra (quien lo tenía queda sin permisos). */
export async function DELETE(req: Request) {
  const permiso = await soloSuper();
  if (permiso instanceof NextResponse) return permiso;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id || ROLES_FIJOS.includes(id)) return NextResponse.json({ error: "Ese rol no se puede borrar." }, { status: 400 });
  try {
    if (!(await borrarRol(id))) return NextResponse.json({ error: "Ese rol no tiene cambios guardados." }, { status: 404 });
    return NextResponse.json({ roles: await leerRoles() });
  } catch (e) {
    return fallo(e);
  }
}
