/**
 * Modo privado (el "ojito" de arriba, como el de los bancos para ocultar el saldo): para grabar o
 * mostrar la pantalla sin dejar ver números ni datos personales. Acá está qué se considera sensible
 * en un texto; la pantalla lo desenfoca sin tocar el contenido (CSS Custom Highlight API), y lo
 * que no es texto suelto (nombres de inversores y leads, campos con montos) se marca con
 * `data-sensible`. Puro.
 */

export const CLAVE_PRIVADO = "hub-privado";

const PATRONES = [
  // Montos: "US$ 113.286", "$ 1.234,56", "USD 15.000", "$ 1,2 M", "US$ 12 mil".
  String.raw`-?(?:U\$S|US\$|USD|ARS|\$)[\s ]?-?\d[\d.,]*(?:[\s ](?:mil|M|mill\.?|millones|k))?`,
  // Superficies: "1.538 m²", "45,5 m2".
  String.raw`\d[\d.,]*[\s ]?m[²2]`,
  // Porcentajes: "12%", "8,5 %".
  String.raw`-?\d[\d.,]*[\s ]?%`,
  // Números con separador de miles ("1.538", "113.286,40") o con decimales ("1721,73").
  String.raw`\b\d{1,3}(?:\.\d{3})+(?:,\d+)?\b`,
  String.raw`\b\d+,\d+\b`,
  // Mails y teléfonos.
  String.raw`[\w.+-]+@[\w-]+\.[\w.-]+`,
  // (con "+" o con espacios; una fecha "2026-11-02" no es un teléfono).
  String.raw`\+\d[\d\s-]{7,}\d`,
  String.raw`\b\d{2,4} \d{3,4}[\s-]?\d{4}\b`,
  // Números largos sueltos (cuentas, CUIT, DNI); los años (4 cifras) quedan visibles.
  String.raw`\b\d{5,}\b`,
];

const REGEX = new RegExp(PATRONES.map((p) => `(?:${p})`).join("|"), "g");

/** Los tramos [desde, hasta) de un texto que hay que ocultar. */
export function tramosSensibles(texto: string): [number, number][] {
  const r: [number, number][] = [];
  if (!/\d|@/.test(texto)) return r;
  for (const m of texto.matchAll(REGEX)) {
    // Una mención (@Mati) no es un mail.
    if (m[0].startsWith("@")) continue;
    r.push([m.index!, m.index! + m[0].length]);
  }
  return r;
}
