"use client";

import { useEffect, useRef, useState } from "react";
import type { Pendiente } from "@/lib/cola/servicio";
import type { Factura } from "@/lib/invoice/schema";
import { importesSinColumna } from "@/lib/sheets/columnas";
import { validateInvoice } from "@/lib/validation";
import { fechaHora, leerJson } from "./formato";
import { aFactura, aValores, camposDe, ETIQUETAS_IMPORTE, type CampoEditable, type Valores } from "./formulario";

const ETIQUETAS_ESTADO = { leyendo: "Leyendo con IA…", pendiente: "Para revisar", error: "Error" } as const;

/**
 * Ficha de un comprobante de la cola: el archivo al lado de los datos editables.
 * En amarillo, lo que la IA marcó como dudoso y lo que falla un control.
 */
export function FichaRevision({
  item,
  resaltar,
  onResuelto,
}: {
  item: Pendiente;
  resaltar: boolean;
  /** Se llama cuando el comprobante se aprobó, descartó o volvió a leer: hay que recargar la lista. */
  onResuelto: (mensaje: string) => void;
}) {
  const original = item.lectura?.factura;
  const [valores, setValores] = useState<Valores | null>(original ? aValores(original) : null);
  const [tocados, setTocados] = useState<Set<CampoEditable>>(new Set());
  const [revisados, setRevisados] = useState<Set<CampoEditable>>(new Set());
  const [ocupado, setOcupado] = useState<null | "aprobar" | "descartar" | "reintentar">(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);

  // Si la lectura cambió (se reintentó), se vuelve a armar el formulario.
  const lecturaClave = item.lectura ? JSON.stringify(item.lectura.factura) : "";
  useEffect(() => {
    setValores(item.lectura ? aValores(item.lectura.factura) : null);
    setTocados(new Set());
    setRevisados(new Set());
  }, [lecturaClave]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (resaltar) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [resaltar]);

  async function accion(nombre: "aprobar" | "descartar" | "reintentar", factura?: Factura) {
    if (nombre === "descartar" && !window.confirm("¿Descartar este comprobante? El archivo va a la papelera de Drive.")) return;
    setOcupado(nombre);
    setError(null);
    try {
      const res = await fetch(`/api/cola/${item.id}/${nombre}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(factura ? { factura } : {}),
      });
      const { item: nuevo } = await leerJson<{ item: Pendiente }>(res);
      if (nombre === "aprobar") {
        const r = nuevo.resultado;
        onResuelto(`Cargada en "${r?.pestania}"${r?.fila ? `, fila ${r.fila}` : ""}.`);
      } else {
        onResuelto(nombre === "descartar" ? "Comprobante descartado." : "Se volvió a leer.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  let factura: ReturnType<typeof aFactura> | null = null;
  const dudosos = new Set<string>();
  let problemas: string[] = [];
  if (original && valores) {
    factura = aFactura(original, valores, tocados);
    // Lo que la IA marcó como dudoso deja de estar en amarillo cuando la persona pasa por el
    // campo; lo que falla un control sigue en amarillo hasta que se corrija.
    for (const c of original.campos_dudosos) {
      const campo = c as CampoEditable;
      if (!tocados.has(campo) && !revisados.has(campo)) dudosos.add(c);
    }
    if (factura.success) {
      const v = validateInvoice(factura.data);
      problemas = v.problemas.map((p) => p.mensaje);
      for (const p of v.problemas) p.campos.forEach((c) => dudosos.add(c));
    }
  }

  const sinColumna = factura?.success ? importesSinColumna(factura.data) : [];
  const archivoUrl = `/api/cola/${item.id}/archivo`;
  const estado = item.estado as keyof typeof ETIQUETAS_ESTADO;

  return (
    <article ref={ref} className={`card factura factura--${item.estado}${resaltar ? " factura--resaltada" : ""}`}>
      <header className="factura__encabezado">
        <div>
          <h2>{item.archivo.nombre}</h2>
          <p className="factura__origen">
            {item.origen === "telegram" ? "Por Telegram" : "Subida a la web"} · {item.enviadaPor} · {fechaHora(item.recibida)}
          </p>
        </div>
        <span className={`estado estado--${item.estado === "pendiente" ? "revision" : item.estado}`}>{ETIQUETAS_ESTADO[estado]}</span>
      </header>

      {(error || item.error) && (
        <p role="alert" className="alerta alerta--error">
          {error ?? item.error}
        </p>
      )}

      {item.estado !== "leyendo" && (
        <div className="factura__cuerpo">
          <div className="factura__vista">
            {item.archivo.mediaType === "application/pdf" ? (
              <iframe src={archivoUrl} title={`Vista previa de ${item.archivo.nombre}`} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={archivoUrl} alt={`Vista previa de ${item.archivo.nombre}`} />
            )}
          </div>

          <div className="factura__datos">
            {item.cargada?.tipo === "duplicada" && (
              <p className="alerta alerta--error">
                Esta factura ya está cargada en la planilla, en la fila {item.cargada.fila} (mismo CUIT, tipo, número y total).
              </p>
            )}
            {item.cargada?.tipo === "mismo_numero" && (
              <p className="alerta alerta--aviso">
                En la fila {item.cargada.fila} hay una factura del mismo proveedor con este número pero otro total. Fijate que no
                sea la misma antes de aprobar.
              </p>
            )}
            {problemas.length > 0 && (
              <ul className="alerta alerta--aviso">
                {problemas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {sinColumna.length > 0 && (
              <p className="alerta alerta--aviso">
                La planilla no tiene columna para {sinColumna.map((c) => ETIQUETAS_IMPORTE[c]).join(", ")}: quedan solo dentro del total.
              </p>
            )}
            {item.lectura?.desde && (
              <p className="factura__nota">
                {item.lectura.desde.pestania === "ingresos" ? "Cliente, tipo de pago y depto" : 'Razón social, rubro y "corresponde a"'}{" "}
                tomados de la última carga de esta contraparte (fila {item.lectura.desde.fila}).
              </p>
            )}
            {original?.observaciones && <p className="factura__nota">IA: {original.observaciones}</p>}

            {valores && (
              <div className="factura__campos">
                {camposDe(valores.categoria).map((def) => (
                  <label
                    key={def.campo}
                    className={`campo${dudosos.has(def.campo) ? " campo--dudoso" : ""}${def.ancho ? " campo--ancho" : ""}`}
                  >
                    {def.etiqueta}
                    {def.tipo === "opciones" ? (
                      <select
                        value={valores[def.campo]}
                        onChange={(e) => {
                          setValores({ ...valores, [def.campo]: e.target.value });
                          setTocados(new Set(tocados).add(def.campo));
                        }}
                        onBlur={() => setRevisados(new Set(revisados).add(def.campo))}
                      >
                        {def.opciones!.map((o) => (
                          <option key={o.valor} value={o.valor}>
                            {o.texto}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={def.tipo === "fecha" ? "date" : def.tipo === "texto" ? "text" : "number"}
                        step={def.tipo === "importe" ? "0.01" : def.tipo === "entero" ? "1" : undefined}
                        inputMode={def.tipo === "importe" ? "decimal" : def.tipo === "entero" ? "numeric" : undefined}
                        value={valores[def.campo]}
                        onChange={(e) => {
                          setValores({ ...valores, [def.campo]: e.target.value });
                          setTocados(new Set(tocados).add(def.campo));
                        }}
                        onBlur={() => setRevisados(new Set(revisados).add(def.campo))}
                      />
                    )}
                  </label>
                ))}
              </div>
            )}

            {factura && !factura.success && <p className="alerta alerta--error">Hay campos con valores inválidos.</p>}

            <div className="factura__acciones">
              {item.estado === "pendiente" && (
                <button
                  type="button"
                  className="btn btn--primario"
                  disabled={!factura?.success || ocupado !== null}
                  onClick={() => factura?.success && accion("aprobar", factura.data)}
                >
                  {ocupado === "aprobar" ? "Cargando…" : "Aprobar y cargar"}
                </button>
              )}
              {item.estado === "error" && (
                <button type="button" className="btn btn--primario" disabled={ocupado !== null} onClick={() => accion("reintentar")}>
                  {ocupado === "reintentar" ? "Leyendo…" : "Reintentar"}
                </button>
              )}
              <button type="button" className="btn btn--borde" disabled={ocupado !== null} onClick={() => accion("descartar")}>
                Descartar
              </button>
              {item.estado === "pendiente" && (
                <button type="button" className="btn btn--borde" disabled={ocupado !== null} onClick={() => accion("reintentar")}>
                  {ocupado === "reintentar" ? "Leyendo…" : "Volver a leer"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
