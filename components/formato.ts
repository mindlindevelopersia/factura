/** "29/10 14:32" en hora de Buenos Aires. */
export function fechaHora(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

export function importe(n: number | undefined, moneda = "ARS"): string {
  if (n == null) return "";
  const texto = n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Espacio que no corta: el "$" no queda solo al final de un renglón.
  return moneda === "ARS" ? `$\u00a0${texto}` : `${moneda}\u00a0${texto}`;
}

/** Un error del servidor, con su código: 503 quiere decir que falta configurar algo. */
export class ErrorRespuesta extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function leerJson<T = unknown>(res: Response): Promise<T> {
  if (!res.headers.get("content-type")?.includes("application/json")) {
    throw new Error("La sesión venció o el servidor no respondió. Recargá la página.");
  }
  const data = await res.json();
  if (!res.ok) throw new ErrorRespuesta(data.error ?? `Error ${res.status}`, res.status);
  return data as T;
}
