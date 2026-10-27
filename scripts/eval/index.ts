/**
 * Evalúa el extractor contra un mes de facturas ya cargadas a mano.
 * Uso y formato de entrada: scripts/eval/README.md
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { parse as parseCsv } from "csv-parse/sync";
import { extractInvoice, type ExtractionResult } from "../../lib/invoice/extract";
import { validateInvoice } from "../../lib/validation";
import {
  claveDeFila,
  claveEmparejamiento,
  compararFila,
  normalizarEncabezado,
  type Comparacion,
  type Decimal,
  type FilaEsperada,
} from "./compare";

const EXTENSIONES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Precio de lista de claude-opus-5-5 en US$ por millón de tokens, para estimar el costo. */
const PRECIO = { input: 4, output: 20 };

async function leerEsperado(archivo: string): Promise<FilaEsperada[]> {
  const contenido = (await readFile(archivo, "utf8")).replace(/^﻿/, "");
  const primeraLinea = contenido.split(/\r?\n/, 1)[0];
  const delimiter = [";", "\t", ","].reduce((mejor, d) =>
    primeraLinea.split(d).length > primeraLinea.split(mejor).length ? d : mejor,
  );
  return parseCsv(contenido, {
    delimiter,
    columns: (encabezados: string[]) => encabezados.map(normalizarEncabezado),
    skip_empty_lines: true,
    relax_column_count: true,
  }) as FilaEsperada[];
}

async function enParalelo<T>(items: T[], concurrencia: number, fn: (item: T) => Promise<void>) {
  const cola = [...items];
  await Promise.all(
    Array.from({ length: Math.min(concurrencia, cola.length) }, async () => {
      for (let item = cola.shift(); item !== undefined; item = cola.shift()) await fn(item);
    }),
  );
}

function csv(filas: (string | number)[][]): string {
  const celda = (v: string | number) => {
    const s = String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return filas.map((f) => f.map(celda).join(",")).join("\n") + "\n";
}

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Sin .env.local: se usan las variables del entorno.
  }
  const { values } = parseArgs({
    options: {
      dir: { type: "string" },
      esperado: { type: "string" },
      salida: { type: "string" },
      decimal: { type: "string", default: "coma" },
      concurrencia: { type: "string", default: "4" },
      rehacer: { type: "boolean", default: false },
    },
  });
  if (!values.dir) {
    console.error("Uso: npm run eval -- --dir <carpeta con facturas> [--esperado esperado.csv] [--salida carpeta]");
    process.exit(1);
  }
  const dir = values.dir;
  const esperadoPath = values.esperado ?? path.join(dir, "esperado.csv");
  const salida = values.salida ?? path.join("eval-out", path.basename(path.resolve(dir)));
  const decimal = values.decimal as Decimal;
  if (decimal !== "coma" && decimal !== "punto") throw new Error("--decimal tiene que ser coma o punto");

  const cacheDir = path.join(salida, "extracciones");
  await mkdir(cacheDir, { recursive: true });

  const archivos = (await readdir(dir)).filter((f) => EXTENSIONES[path.extname(f).toLowerCase()]).sort();
  const filas = await leerEsperado(esperadoPath);
  console.log(`${archivos.length} facturas, ${filas.length} filas esperadas.`);

  // 1. Extraer (o reusar lo extraído en una corrida anterior).
  const extracciones = new Map<string, ExtractionResult>();
  const errores: { archivo: string; error: string }[] = [];
  let nuevas = 0;
  await enParalelo(archivos, Number(values.concurrencia), async (archivo) => {
    const cache = path.join(cacheDir, `${archivo}.json`);
    if (!values.rehacer) {
      try {
        extracciones.set(archivo, JSON.parse(await readFile(cache, "utf8")));
        return;
      } catch {
        // No hay extracción previa.
      }
    }
    try {
      const data = await readFile(path.join(dir, archivo));
      const mediaType = EXTENSIONES[path.extname(archivo).toLowerCase()];
      const resultado = await extractInvoice({ name: archivo, mediaType, data });
      await writeFile(cache, JSON.stringify(resultado, null, 2));
      extracciones.set(archivo, resultado);
      nuevas++;
      console.log(`  ✓ ${archivo}`);
    } catch (e) {
      errores.push({ archivo, error: e instanceof Error ? e.message : String(e) });
      console.log(`  ✗ ${archivo}: ${e instanceof Error ? e.message : e}`);
    }
  });

  // 2. Emparejar cada extracción con su fila: por nombre de archivo o por CUIT + punto de venta + número.
  const porArchivo = new Map(filas.filter((f) => f.archivo).map((f) => [f.archivo.trim(), f]));
  const porClave = new Map(filas.map((f) => [claveDeFila(f), f]).filter(([k]) => k) as [string, FilaEsperada][]);
  const usadas = new Set<FilaEsperada>();
  const sinFila: string[] = [];

  const porCampo: Record<string, { comparados: number; aciertos: number }> = {};
  const diferencias: (string | number)[][] = [["archivo", "campo", "esperado", "obtenido"]];
  const controles = { cuit: 0, suma: 0 };
  const uso = { input_tokens: 0, output_tokens: 0 };
  let fallbacks = 0;

  for (const archivo of archivos) {
    const r = extracciones.get(archivo);
    if (!r) continue;
    const inv = r.invoice;
    uso.input_tokens += r.usage.input_tokens;
    uso.output_tokens += r.usage.output_tokens;
    if (r.fallback) fallbacks++;
    const { problemas } = validateInvoice(inv);
    if (problemas.some((p) => p.control === "cuit" && p.campos.includes("cuit"))) controles.cuit++;
    if (problemas.some((p) => p.control === "suma")) controles.suma++;

    const fila = porArchivo.get(archivo) ?? porClave.get(claveEmparejamiento(inv.cuit, inv.punto_venta, inv.numero) ?? "");
    if (!fila) {
      sinFila.push(archivo);
      continue;
    }
    usadas.add(fila);
    const comparacion: Record<string, Comparacion> = compararFila(fila, inv, decimal);
    for (const [campo, c] of Object.entries(comparacion)) {
      if (c.acierto === null) continue;
      porCampo[campo] ??= { comparados: 0, aciertos: 0 };
      porCampo[campo].comparados++;
      if (c.acierto) porCampo[campo].aciertos++;
      else diferencias.push([archivo, campo, c.esperado, c.obtenido]);
    }
  }
  const filasSinArchivo = filas.filter((f) => !usadas.has(f));

  // 3. Reporte.
  const tabla = Object.entries(porCampo).map(([campo, { comparados, aciertos }]) => ({
    campo,
    aciertos,
    comparados,
    "%": Math.round((aciertos / comparados) * 1000) / 10,
  }));
  const costo = (uso.input_tokens * PRECIO.input + uso.output_tokens * PRECIO.output) / 1e6;
  const resumen = {
    facturas: archivos.length,
    extraidas: extracciones.size,
    extraidas_en_esta_corrida: nuevas,
    errores,
    sin_fila_esperada: sinFila,
    filas_sin_archivo: filasSinArchivo.length,
    con_fallback: fallbacks,
    cuit_invalido: controles.cuit,
    suma_no_cierra: controles.suma,
    costo_estimado_usd: Math.round(costo * 100) / 100,
    costo_por_factura_usd: extracciones.size ? Math.round((costo / extracciones.size) * 1000) / 1000 : 0,
  };

  console.table(tabla);
  console.log(resumen);
  await writeFile(path.join(salida, "reporte.json"), JSON.stringify({ resumen, por_campo: tabla }, null, 2));
  await writeFile(path.join(salida, "diferencias.csv"), csv(diferencias));
  console.log(`Reporte en ${path.join(salida, "reporte.json")} y diferencias en ${path.join(salida, "diferencias.csv")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
