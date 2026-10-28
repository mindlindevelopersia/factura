import { isSupportedMediaType, type InvoiceFile } from "./extract";

/** Vercel acepta hasta 4,5 MB por pedido; dejamos margen para el resto del formulario. */
export const TAMANIO_MAXIMO = 4_300_000;

/** Lee y valida el archivo de un formulario. Devuelve el archivo o un mensaje de error. */
export async function archivoDeFormulario(form: FormData): Promise<InvoiceFile | { error: string }> {
  const archivo = form.get("archivo");
  if (!(archivo instanceof File)) return { error: "Falta el archivo." };
  if (!isSupportedMediaType(archivo.type)) {
    return { error: `Tipo de archivo no soportado (${archivo.type || "desconocido"}). Usá PDF, JPG, PNG o WEBP.` };
  }
  if (archivo.size > TAMANIO_MAXIMO) return { error: "El archivo pesa más de 4,3 MB." };
  return { name: archivo.name, mediaType: archivo.type, data: new Uint8Array(await archivo.arrayBuffer()) };
}
