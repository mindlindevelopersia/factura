export const TAMANIO_MAXIMO_WEB = 4_300_000;
export const TIPOS_CARGA =
  "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";

/** Validación previa al envío; las imágenes grandes se comprimen antes de validar el peso. */
export function errorArchivo(
  archivo: Pick<File, "type" | "size">,
): string | null {
  if (!archivo.size) return "El archivo está vacío. Elegí otro archivo.";
  if (!TIPOS_CARGA.split(",").includes(archivo.type))
    return "Formato no compatible. Usá PDF, JPG, PNG o WEBP; las fotos HEIC se convierten si tu navegador lo permite.";
  if (archivo.type === "application/pdf" && archivo.size > TAMANIO_MAXIMO_WEB)
    return "El PDF supera los 4,3 MB. Reducí su tamaño o mandalo por Telegram.";
  return null;
}
