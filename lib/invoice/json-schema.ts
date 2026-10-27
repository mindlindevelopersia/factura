import { z } from "zod";

/** Palabras clave de JSON Schema que la salida estructurada de la API no acepta. */
const NO_SOPORTADAS = new Set([
  "$schema",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
]);

/**
 * Convierte un esquema zod al JSON Schema que acepta `output_config.format`.
 *
 * No usamos `zodOutputFormat` del SDK porque (en la versión 1.3.0) pasa `enum` a la
 * descripción en lugar de dejarlo como restricción, y acá los enums importan: tipo de
 * comprobante, letra, moneda, proyecto y rubro.
 */
export function toOutputSchema(schema: z.ZodType): Record<string, unknown> {
  return limpiar(z.toJSONSchema(schema, { target: "draft-2020-12" })) as Record<string, unknown>;
}

function limpiar(nodo: unknown): unknown {
  if (Array.isArray(nodo)) return nodo.map(limpiar);
  if (nodo === null || typeof nodo !== "object") return nodo;

  const out: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(nodo)) {
    if (NO_SOPORTADAS.has(clave)) continue;
    if (clave === "properties" || clave === "$defs") {
      out[clave] = Object.fromEntries(Object.entries(valor as object).map(([k, v]) => [k, limpiar(v)]));
    } else if (clave === "enum" || clave === "const" || clave === "required") {
      out[clave] = valor;
    } else {
      out[clave] = limpiar(valor);
    }
  }
  if (out.type === "object") out.additionalProperties = false;
  // ["string", "null"] pasa a anyOf, la forma documentada para campos opcionales.
  if (Array.isArray(out.type)) {
    const { type, ...resto } = out;
    return { ...resto, anyOf: (type as string[]).map((t) => ({ type: t })) };
  }
  return out;
}
