import { CAMPOS_IMPORTE, type CampoFactura, type Invoice } from "../invoice/schema";
import { isValidCuit } from "./cuit";
import { compareWithQr, parseArcaQr } from "./qr";
import { checkSum, TOLERANCIA_SUMA } from "./sum";

export { isValidCuit, normalizeCuit } from "./cuit";
export { checkSum, TOLERANCIA_SUMA } from "./sum";
export { compareWithQr, parseArcaQr, type ArcaQr } from "./qr";

export interface Problema {
  control: "cuit" | "suma" | "qr";
  campos: CampoFactura[];
  mensaje: string;
}

export interface Validacion {
  problemas: Problema[];
  /** Campos a marcar en amarillo: los que la IA dudó más los que fallaron algún control. */
  dudosos: CampoFactura[];
}

export interface ValidateOptions {
  /** Texto leído del QR de ARCA, si se pudo leer. */
  qr?: string | null;
  tolerancia?: number;
}

export function validateInvoice(inv: Invoice, options: ValidateOptions = {}): Validacion {
  const tolerancia = options.tolerancia ?? TOLERANCIA_SUMA;
  const problemas: Problema[] = [];

  if (!inv.cuit || !isValidCuit(inv.cuit)) {
    problemas.push({ control: "cuit", campos: ["cuit"], mensaje: `El CUIT del emisor (${inv.cuit ?? "vacío"}) no es válido.` });
  }
  if (inv.cuit_receptor && !isValidCuit(inv.cuit_receptor)) {
    problemas.push({
      control: "cuit",
      campos: ["cuit_receptor"],
      mensaje: `El CUIT del receptor (${inv.cuit_receptor}) no es válido.`,
    });
  }

  const suma = checkSum(inv, tolerancia);
  if (!suma.ok) {
    problemas.push({
      control: "suma",
      campos: ["total", ...CAMPOS_IMPORTE.filter((c) => inv[c] !== 0)],
      mensaje: `Los importes suman ${suma.suma} y el total es ${inv.total} (diferencia ${suma.diferencia}).`,
    });
  }

  if (options.qr) {
    const qr = parseArcaQr(options.qr);
    if (!qr) {
      problemas.push({ control: "qr", campos: [], mensaje: "El QR no es un QR de factura electrónica de ARCA." });
    } else {
      for (const d of compareWithQr(inv, qr, tolerancia)) {
        problemas.push({
          control: "qr",
          campos: [d.campo],
          mensaje: `${d.campo}: la factura dice ${d.factura ?? "vacío"} y el QR dice ${d.qr}.`,
        });
      }
    }
  }

  const dudosos = new Set<CampoFactura>(inv.campos_dudosos);
  for (const p of problemas) p.campos.forEach((c) => dudosos.add(c));
  return { problemas, dudosos: [...dudosos] };
}
