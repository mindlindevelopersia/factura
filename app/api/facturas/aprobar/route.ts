import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { archivoDeFormulario } from "@/lib/invoice/archivo";
import { InvoiceSchema } from "@/lib/invoice/schema";
import { claveDuplicado } from "@/lib/invoice/tipos";
import { planillaDesdeEnv } from "@/lib/sheets/planilla";
import { almacenDesdeEnv, nombreArchivo } from "@/lib/storage/archivos";

export const maxDuration = 60;

function hoyEnBuenosAires(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

/** Guarda el archivo (si hay almacén configurado) y agrega la fila en la planilla con estado "En revisión". */
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
  const parsed = InvoiceSchema.safeParse(datos);
  if (!parsed.success) {
    return NextResponse.json({ error: `Datos de la factura inválidos: ${parsed.error.message}` }, { status: 400 });
  }
  const invoice = parsed.data;

  const planilla = planillaDesdeEnv();
  if (!planilla) return NextResponse.json({ error: "Falta configurar la planilla en el servidor." }, { status: 503 });

  const clave = claveDuplicado(invoice);
  if (clave && (await planilla.existe(clave))) {
    return NextResponse.json({ error: "Esta factura ya está cargada en la planilla." }, { status: 409 });
  }

  const almacen = almacenDesdeEnv();
  let link: string | null = null;
  if (almacen) {
    try {
      ({ url: link } = await almacen.guardar({ ...archivo, nombre: nombreArchivo(invoice, archivo.mediaType) }));
    } catch (e) {
      console.error("No se pudo guardar el archivo", e);
      return NextResponse.json({ error: "No se pudo guardar el archivo en Drive. No se cargó la fila." }, { status: 502 });
    }
  }

  const { fila } = await planilla.agregar({ invoice, link, cargadoPor: user.email, fechaRegistro: hoyEnBuenosAires() });
  return NextResponse.json({ ok: true, fila, link, sinArchivo: !almacen });
}
