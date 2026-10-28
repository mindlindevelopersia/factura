/** Lado más largo de una foto después de comprimir. Alcanza para leer una factura. */
const LADO_MAXIMO = 2400;
/** Por debajo de este tamaño, una foto se manda tal cual. */
const SIN_COMPRIMIR_HASTA = 1_500_000;

/**
 * Achica las fotos antes de subirlas: Vercel acepta hasta 4,5 MB por pedido y una foto
 * de celular suele pesar más. Los PDF no se tocan.
 */
export async function prepararArchivo(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/") || archivo.type === "image/gif") return archivo;
  const soportada = ["image/jpeg", "image/png", "image/webp"].includes(archivo.type);
  if (soportada && archivo.size <= SIN_COMPRIMIR_HASTA) return archivo;

  let imagen: ImageBitmap;
  try {
    imagen = await createImageBitmap(archivo);
  } catch {
    throw new Error("El navegador no puede abrir esta imagen. Probá sacarle una captura o exportarla como JPG.");
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(imagen.width * escala);
  canvas.height = Math.round(imagen.height * escala);
  canvas.getContext("2d")!.drawImage(imagen, 0, 0, canvas.width, canvas.height);
  imagen.close();

  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
  if (!blob) throw new Error("No se pudo comprimir la imagen.");
  return new File([blob], archivo.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}
