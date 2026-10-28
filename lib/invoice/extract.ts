import Anthropic from "@anthropic-ai/sdk";
import rubrosConfig from "../../config/rubros.json";
import { EMPRESA } from "../empresa";
import { RUBROS_DETALLE } from "./proveedores";
import { toOutputSchema } from "./json-schema";
import { SYSTEM_PROMPT, userPrompt } from "./prompt";
import { buildInvoiceSchema, type Invoice } from "./schema";

export const MODEL = "claude-opus-5-5";

export const TIPOS_ARCHIVO = {
  "application/pdf": "document",
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
} as const;
export type MediaType = keyof typeof TIPOS_ARCHIVO;

export interface InvoiceFile {
  name: string;
  mediaType: string;
  data: Uint8Array;
}

export interface ExtractOptions {
  client?: Anthropic;
  /** Lista cerrada de rubros. Por defecto, la de config/rubros.json. */
  rubros?: readonly string[];
  /** Valores de "Corresponde a". Por defecto, los de config/empresa.json. */
  correspondeA?: readonly string[];
  /** Rubros detallados. Por defecto, los de config/proveedores.json. */
  rubrosDetalle?: readonly string[];
  /** Lo que escribió quien mandó el comprobante. Puede aclarar a qué corresponde o el concepto. */
  comentario?: string;
}

export interface ExtractionResult {
  invoice: Invoice;
  /** Modelo que respondió: puede ser otro si hubo fallback por rechazo. */
  model: string;
  fallback: boolean;
  usage: { input_tokens: number; output_tokens: number };
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly reason: "unsupported_file" | "refusal" | "max_tokens" | "unparsed",
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

export function isSupportedMediaType(mediaType: string): mediaType is MediaType {
  return mediaType in TIPOS_ARCHIVO;
}

function fileBlock(file: InvoiceFile): Anthropic.Beta.BetaContentBlockParam {
  const { mediaType } = file;
  if (!isSupportedMediaType(mediaType)) {
    throw new ExtractionError(`Tipo de archivo no soportado: ${mediaType} (${file.name})`, "unsupported_file");
  }
  const data = Buffer.from(file.data).toString("base64");
  if (mediaType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: mediaType, data } };
  }
  return { type: "image", source: { type: "base64", media_type: mediaType, data } };
}

/** Lee un comprobante (PDF o imagen) con Claude y devuelve sus datos para la planilla. */
export async function extractInvoice(file: InvoiceFile, options: ExtractOptions = {}): Promise<ExtractionResult> {
  const client = options.client ?? new Anthropic();
  const rubros = options.rubros ?? rubrosConfig;
  const schema = buildInvoiceSchema(
    rubros,
    options.correspondeA ?? EMPRESA.corresponde_a,
    options.rubrosDetalle ?? RUBROS_DETALLE,
  );

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: toOutputSchema(schema) } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: [fileBlock(file), { type: "text", text: userPrompt(rubros, options.comentario) }] }],
  });

  if (response.stop_reason === "refusal") {
    throw new ExtractionError(
      `El modelo rechazó leer ${file.name} (${response.stop_details?.category ?? "sin categoría"})`,
      "refusal",
    );
  }
  if (response.stop_reason === "max_tokens") {
    throw new ExtractionError(`La respuesta para ${file.name} se cortó por max_tokens`, "max_tokens");
  }
  const texto = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  let parsed: ReturnType<typeof schema.safeParse>;
  try {
    parsed = schema.safeParse(JSON.parse(texto));
  } catch {
    throw new ExtractionError(`La respuesta para ${file.name} no es JSON válido`, "unparsed");
  }
  if (!parsed.success) {
    throw new ExtractionError(`La respuesta para ${file.name} no cumple el esquema: ${parsed.error.message}`, "unparsed");
  }

  return {
    invoice: parsed.data,
    model: response.model,
    fallback: (response.usage.iterations ?? []).some((it) => it.type === "fallback_message"),
    usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
  };
}
