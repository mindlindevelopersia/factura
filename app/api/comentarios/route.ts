import { NextResponse } from "next/server";
import { leerComentariosDatos, comentarDato } from "@/lib/comentarios/fuente";
import { hilos, rutaBase, validarComentario } from "@/lib/comentarios/modelo";
import { errorCrm } from "@/lib/crm/api";
import { persona } from "@/lib/equipo";
import { avisarMenciones, notificar, usuariosDelSistema } from "@/lib/notificaciones/fuente";
import { extracto, menciones, usuarioPorApodo, type Usuario } from "@/lib/notificaciones/modelo";
import { exigir } from "@/lib/permisos/api";
import { perfilDe } from "@/lib/permisos/fuente";

/** ?ruta=/proyectos/…&prefijo=pf:…: los comentarios de los datos de esa página (si la puede ver). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ruta = rutaBase(u.searchParams.get("ruta") ?? "");
  const permiso = await exigir(ruta);
  if (permiso instanceof NextResponse) return permiso;
  try {
    return NextResponse.json({ comentarios: await leerComentariosDatos(ruta, u.searchParams.get("prefijo") ?? "") });
  } catch (e) {
    return errorCrm(e, "comentarios GET");
  }
}

/** Un comentario nuevo o una respuesta. Avisa a los mencionados y a quienes ya están en el hilo. */
export async function POST(req: Request) {
  const v = validarComentario(await req.json().catch(() => null));
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
  const permiso = await exigir(v.datos.ruta);
  if (permiso instanceof NextResponse) return permiso;
  const email = permiso.user.email.toLowerCase();
  const usuario = (await perfilDe(email).catch(() => null))?.apodo || persona(email, permiso.user.name).apodo;
  try {
    const previos = v.datos.padre ? await leerComentariosDatos(v.datos.ruta, v.datos.clave) : [];
    const c = await comentarDato(v.datos, usuario);
    const link = v.datos.ruta;
    const titulo = v.datos.etiqueta || "un dato";
    const usuarios = await usuariosDelSistema();
    const mencionados = new Set(menciones(c.texto, usuarios).map((x) => x.email));
    const hilo = c.padre ? hilos([...previos, c], c.clave).find((h) => h.raiz.id === c.padre) : null;
    const enElHilo = hilo ? [hilo.raiz.usuario, ...hilo.respuestas.map((r) => r.usuario)].map((a) => usuarioPorApodo(a, usuarios)).filter((x): x is Usuario => !!x && !mencionados.has(x.email)) : [];
    await Promise.all([
      avisarMenciones({ texto: c.texto, titulo, link, de: usuario, deEmail: email }),
      notificar([...new Map(enElHilo.map((x) => [x.email, x])).values()].map((x) => ({ para: x, tipo: "comentario" as const, titulo: `${usuario} respondió en: ${titulo}`, texto: extracto(c.texto), link, de: usuario, deEmail: email }))),
    ]);
    return NextResponse.json({ comentario: c });
  } catch (e) {
    return errorCrm(e, "comentarios POST");
  }
}
