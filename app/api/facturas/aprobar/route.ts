import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { archivoDeFormulario } from "@/lib/invoice/archivo";
import { FacturaSchema } from "@/lib/invoice/schema";
import { claveDuplicado } from "@/lib/invoice/tipos";
import { pestaniaDe } from "@/lib/sheets/columnas";
import { PestaniaSinConfigurar, planillaDesdeEnv } from "@/lib/sheets/planilla";
import { almacenDesdeEnv, nombreArchivo } from "@/lib/storage/archivos";

export const maxDuration = 60;

function hoyEnBuenosAires(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

/**
 * Guarda el archivo en la carpeta de su categoría (si hay almacén configurado) y agrega la
 * fila en la pestaña que corresponde: ventas en ingresos, compras y honorarios en egresos.
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sesión vencida. Volvé a ingresar." }, { status: 401 });

  const form = await req.formData();
  const archivo = await archivoDeFormulario(form);
  if ("error" in archivo) return NextResponse.json(archivo, { status: 400 });

  let datos: unknown;
  try {
    datos = JSON.parse(String(form.get("datos")));
  } catch {
    return NextResponse.json({ error: "Datos de la factura inválidos." }, { status: 400 });
  }
  const parsed = FacturaSchema.safeParse(datos);
  if (!parsed.success) {
    return NextResponse.json({ error: `Datos de la factura inválidos: ${parsed.error.message}` }, { status: 400 });
  }
  const factura = parsed.data;

  const planilla = planillaDesdeEnv();
  if (!planilla) return NextResponse.json({ error: "Falta configurar la planilla en el servidor." }, { status: 503 });
  const pestania = pestaniaDe(factura);
  if (!planilla.tiene(pestania)) {
    return NextResponse.json({ error: new PestaniaSinConfigurar(pestania).message }, { status: 503 });
  }

  const clave = claveDuplicado(factura);
  if (clave && (await planilla.registros()).claves.has(clave)) {
    return NextResponse.json({ error: "Esta factura ya está cargada en la planilla." }, { status: 409 });
  }

  const almacen = almacenDesdeEnv();
  let link: string | null = null;
  if (almacen) {
    try {
      ({ url: link } = await almacen.guardar({
        ...archivo,
        carpeta: factura.categoria,
        nombre: nombreArchivo(factura, archivo.mediaType),
      }));
    } catch (e) {
      console.error("No se pudo guardar el archivo", e);
      return NextResponse.json({ error: "No se pudo guardar el archivo en Drive. No se cargó la fila." }, { status: 502 });
    }
  }

  const resultado = await planilla.agregar({ factura, link, fechaRegistro: hoyEnBuenosAires() });
  console.log(`${user.email} cargó ${clave ?? "una factura sin número"} en "${resultado.pestania}", fila ${resultado.fila}`);
  return NextResponse.json({ ok: true, ...resultado, link, sinArchivo: !almacen });
}
