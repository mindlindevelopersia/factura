/** Esperas entre intentos, en ms. Las cuotas de Sheets son por minuto: la última espera es larga. */
export const ESPERAS_MS = [1500, 4000, 8000];

const dormirReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function statusDe(e: unknown): number | undefined {
  const err = e as { response?: { status?: number }; status?: number };
  return err.response?.status ?? err.status;
}

/**
 * Si conviene volver a intentar un pedido que falló.
 * - 429 (cuota agotada): siempre. Google no ejecutó el pedido, así que repetirlo no duplica nada.
 * - 5xx o un corte de red: solo si el pedido es idempotente (leer, o escribir un rango fijo).
 *   Un agregado de fila que falló así pudo haberse hecho: repetirlo podría duplicar la fila.
 */
export function reintentable(e: unknown, idempotente: boolean): boolean {
  const status = statusDe(e);
  if (status === 429) return true;
  if (!idempotente) return false;
  return status === undefined || status >= 500;
}

export async function conReintentos<T>(
  fn: () => Promise<T>,
  idempotente: boolean,
  { esperas = ESPERAS_MS, dormir = dormirReal }: { esperas?: number[]; dormir?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  for (let intento = 0; ; intento++) {
    try {
      return await fn();
    } catch (e) {
      if (intento >= esperas.length || !reintentable(e, idempotente)) throw e;
      await dormir(esperas[intento] + Math.floor(Math.random() * 250));
    }
  }
}
