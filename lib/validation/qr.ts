import type { CampoFactura, Invoice, Moneda } from "../invoice/schema";
import { codigoArca } from "../invoice/tipos";
import { normalizeCuit } from "./cuit";

/**
 * Datos del QR de ARCA. El QR apunta a https://www.afip.gob.ar/fe/qr/?p=<base64 de este JSON>.
 * Especificación: https://www.afip.gob.ar/fe/qr/especificaciones.asp
 */
export interface ArcaQr {
  ver: number;
  fecha: string;
  cuit: number;
  ptoVta: number;
  tipoCmp: number;
  nroCmp: number;
  importe: number;
  moneda: string;
  ctz: number;
  tipoDocRec?: number;
  nroDocRec?: number;
  tipoCodAut: "E" | "A";
  codAut: number;
}

const MONEDAS_ARCA: Record<string, Moneda> = { PES: "ARS", DOL: "USD", "060": "EUR" };

/** Decodifica el contenido de un QR de ARCA. null si no es un QR de factura electrónica. */
export function parseArcaQr(contenido: string): ArcaQr | null {
  let p: string | null;
  try {
    p = new URL(contenido.trim()).searchParams.get("p");
  } catch {
    return null;
  }
  if (!p) return null;
  try {
    // Algunos emisores usan base64 url-safe o sin relleno.
    const json = Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const data = JSON.parse(json) as Partial<ArcaQr>;
    if (data.cuit == null || data.ptoVta == null || data.tipoCmp == null || data.nroCmp == null) return null;
    return data as ArcaQr;
  } catch {
    return null;
  }
}

export interface QrDiferencia {
  campo: CampoFactura;
  factura: string | number | null;
  qr: string | number;
}

/** Compara lo extraído con el QR. Devuelve las diferencias; vacío si todo coincide. */
export function compareWithQr(inv: Invoice, qr: ArcaQr, toleranciaImporte = 0.05): QrDiferencia[] {
  const difs: QrDiferencia[] = [];
  const distinto = (campo: CampoFactura, factura: string | number | null, valorQr: string | number) => {
    if (String(factura ?? "") !== String(valorQr)) difs.push({ campo, factura, qr: valorQr });
  };

  distinto("cuit", inv.cuit && normalizeCuit(inv.cuit), String(qr.cuit));
  distinto("punto_venta", inv.punto_venta, qr.ptoVta);
  distinto("numero", inv.numero, qr.nroCmp);
  distinto("tipo_comprobante", codigoArca(inv), qr.tipoCmp);
  if (qr.fecha) distinto("fecha_factura", inv.fecha_factura, qr.fecha);
  if (qr.codAut) distinto("cae", inv.cae && inv.cae.replace(/\D/g, ""), String(qr.codAut));
  const moneda = MONEDAS_ARCA[qr.moneda];
  if (moneda) distinto("moneda", inv.moneda, moneda);
  if (Math.abs(inv.total - qr.importe) > toleranciaImporte) {
    difs.push({ campo: "total", factura: inv.total, qr: qr.importe });
  }
  return difs;
}
