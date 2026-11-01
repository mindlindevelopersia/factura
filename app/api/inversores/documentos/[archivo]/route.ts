import { NextResponse } from "next/server";
import { esDocumento } from "@/lib/inversores/documentos";
import { bajarArchivo, carpetasInversores, DocumentacionSinConfigurar } from "@/lib/inversores/documentosFuente";
import { PROYECTO_PRINCIPAL, rutaProyecto } from "@/lib/modulos";
import { exigir } from "@/lib/permisos/api";

/**
 * Abre un documento firmado a través del hub: así no hace falta compartir el Drive con cada uno,
 * y solo lo ve quien puede ver las cuentas corrientes. Solo sirve para archivos de la carpeta de
 * documentación (no cualquier archivo de Drive).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ archivo: string }> }) {
  const permiso = await exigir(rutaProyecto(PROYECTO_PRINCIPAL.id, "inversores/cuentas-corrientes"));
  if (permiso instanceof NextResponse) return permiso;
  const { archivo } = await params;
  try {
    const carpetas = await carpetasInversores(PROYECTO_PRINCIPAL.id);
    const a = carpetas.flatMap((c) => c.archivos).find((x) => x.id === archivo && esDocumento(x));
    if (!a) return NextResponse.json({ error: "Ese documento no está en la carpeta de documentación." }, { status: 404 });
    const { data, mimeType } = await bajarArchivo(a.id);
    return new NextResponse(data, {
      headers: {
        "content-type": mimeType,
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(a.nombre)}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof DocumentacionSinConfigurar) return NextResponse.json({ error: e.message }, { status: 503 });
    console.error("inversores/documentos/archivo", e);
    return NextResponse.json({ error: "No se pudo abrir el documento." }, { status: 502 });
  }
}
