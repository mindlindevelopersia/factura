const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const PREFIJOS = new Set(["20", "23", "24", "25", "26", "27", "30", "33", "34"]);

/** Deja solo los dígitos: "30-12345678-1" pasa a "30123456781". */
export function normalizeCuit(cuit: string): string {
  return cuit.replace(/\D/g, "");
}

/** Dígito verificador según el algoritmo de módulo 11 de ARCA. null si no hay uno válido. */
export function cuitCheckDigit(primeros10: string): number | null {
  const suma = PESOS.reduce((acc, peso, i) => acc + peso * Number(primeros10[i]), 0);
  const dv = 11 - (suma % 11);
  if (dv === 11) return 0;
  if (dv === 10) return null;
  return dv;
}

export function isValidCuit(cuit: string): boolean {
  const digitos = normalizeCuit(cuit);
  if (digitos.length !== 11 || !PREFIJOS.has(digitos.slice(0, 2))) return false;
  return cuitCheckDigit(digitos.slice(0, 10)) === Number(digitos[10]);
}
