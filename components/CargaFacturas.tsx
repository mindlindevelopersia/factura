"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CampoFactura, Invoice } from "@/lib/invoice/schema";
import { prepararArchivo } from "@/lib/client/comprimir";
import { validateInvoice } from "@/lib/validation";
import { aFactura, aValores, CAMPOS, type CampoEditable, type Valores } from "./formulario";

/** Facturas que se leen con la IA al mismo tiempo. */
const EN_PARALELO = 2;
const TAMANIO_MAXIMO = 4_300_000;
const ACEPTADOS = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";

type Estado = "preparando" | "en_cola" | "leyendo" | "revision" | "guardando" | "guardada" | "error";

interface Item {
  id: string;
  nombre: string;
  archivo: File | null;
  vistaPrevia: string | null;
  estado: Estado;
  error?: string;
  original?: Invoice;
  valores?: Valores;
  /** Campos que la persona cambió. */
  tocados: Set<CampoEditable>;
  /** Campos por los que la persona pasó, aunque no los haya cambiado: los da por revisados. */
  revisados: Set<CampoEditable>;
  duplicado?: boolean;
  resultado?: { fila: number | null; link: string | null; sinArchivo: boolean };
}

const ETIQUETAS: Record<Estado, string> = {
  preparando: "Preparando…",
  en_cola: "En cola",
  leyendo: "Leyendo con IA…",
  revision: "Para revisar",
  guardando: "Guardando…",
  guardada: "Cargada",
  error: "Error",
};

async function leerJson(res: Response): Promise<any> {
  if (!res.headers.get("content-type")?.includes("application/json")) {
    throw new Error("La sesión venció o el servidor no respondió. Recargá la página.");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data;
}

export function CargaFacturas() {
  const [items, setItems] = useState<Item[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const iniciados = useRef(new Set<string>());
  const input = useRef<HTMLInputElement>(null);

  const actualizar = useCallback((id: string, cambios: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...cambios } : it)));
  }, []);

  const agregar = useCallback(
    (archivos: FileList | File[]) => {
      for (const original of Array.from(archivos)) {
        const id = crypto.randomUUID();
        setItems((prev) => [
          ...prev,
          { id, nombre: original.name, archivo: null, vistaPrevia: null, estado: "preparando", tocados: new Set(), revisados: new Set() },
        ]);
        prepararArchivo(original)
          .then((archivo) => {
            if (archivo.size > TAMANIO_MAXIMO) throw new Error("El archivo pesa más de 4,3 MB. Si es un PDF escaneado, bajale la resolución.");
            actualizar(id, { archivo, vistaPrevia: URL.createObjectURL(archivo), estado: "en_cola" });
          })
          .catch((e: Error) => actualizar(id, { estado: "error", error: e.message }));
      }
    },
    [actualizar],
  );

  const leer = useCallback(
    async (item: Item) => {
      actualizar(item.id, { estado: "leyendo", error: undefined });
      try {
        const fd = new FormData();
        fd.append("archivo", item.archivo!);
        const data = await leerJson(await fetch("/api/facturas/extraer", { method: "POST", body: fd }));
        actualizar(item.id, {
          estado: "revision",
          original: data.invoice,
          valores: aValores(data.invoice),
          tocados: new Set(),
          revisados: new Set(),
          duplicado: data.duplicado,
        });
      } catch (e) {
        actualizar(item.id, { estado: "error", error: (e as Error).message });
      }
    },
    [actualizar],
  );

  // Cola: lee de a EN_PARALELO facturas.
  useEffect(() => {
    let enCurso = items.filter((i) => i.estado === "leyendo").length;
    for (const item of items) {
      if (enCurso >= EN_PARALELO) break;
      if (item.estado !== "en_cola" || iniciados.current.has(item.id)) continue;
      iniciados.current.add(item.id);
      enCurso++;
      void leer(item);
    }
  }, [items, leer]);

  async function aprobar(item: Item, invoice: Invoice) {
    actualizar(item.id, { estado: "guardando", error: undefined });
    try {
      const fd = new FormData();
      fd.append("archivo", item.archivo!);
      fd.append("datos", JSON.stringify(invoice));
      const data = await leerJson(await fetch("/api/facturas/aprobar", { method: "POST", body: fd }));
      actualizar(item.id, { estado: "guardada", resultado: data });
    } catch (e) {
      actualizar(item.id, { estado: "revision", error: (e as Error).message });
    }
  }

  function reintentar(item: Item) {
    iniciados.current.delete(item.id);
    actualizar(item.id, { estado: item.archivo ? "en_cola" : "error", error: item.archivo ? undefined : item.error });
  }

  function quitar(item: Item) {
    if (item.vistaPrevia) URL.revokeObjectURL(item.vistaPrevia);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  const pendientes = items.filter((i) => i.estado === "revision").length;
  const cargadas = items.filter((i) => i.estado === "guardada").length;

  return (
    <div className="carga">
      <div
        className={`zona-carga${arrastrando ? " zona-carga--activa" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          agregar(e.dataTransfer.files);
        }}
      >
        <p>
          <strong>Arrastrá las facturas acá</strong>
          <br />
          PDF o fotos. Podés soltar varias juntas.
        </p>
        <button type="button" className="btn btn--primario" onClick={() => input.current?.click()}>
          Elegir archivos
        </button>
        <input
          ref={input}
          type="file"
          accept={ACEPTADOS}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) agregar(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <p className="carga__resumen">
          {items.length} {items.length === 1 ? "archivo" : "archivos"} · {pendientes} para revisar · {cargadas} cargadas
        </p>
      )}

      {items.map((item) => (
        <Tarjeta
          key={item.id}
          item={item}
          onCambiar={(campo, valor) =>
            actualizar(item.id, {
              valores: { ...item.valores!, [campo]: valor },
              tocados: new Set(item.tocados).add(campo),
            })
          }
          onRevisar={(campo) => {
            if (!item.revisados.has(campo)) actualizar(item.id, { revisados: new Set(item.revisados).add(campo) });
          }}
          onAprobar={(inv) => aprobar(item, inv)}
          onReintentar={() => reintentar(item)}
          onQuitar={() => quitar(item)}
        />
      ))}
    </div>
  );
}

function Tarjeta({
  item,
  onCambiar,
  onRevisar,
  onAprobar,
  onReintentar,
  onQuitar,
}: {
  item: Item;
  onCambiar: (campo: CampoEditable, valor: string) => void;
  onRevisar: (campo: CampoEditable) => void;
  onAprobar: (inv: Invoice) => void;
  onReintentar: () => void;
  onQuitar: () => void;
}) {
  const editable = item.estado === "revision" && item.original && item.valores;
  let factura: ReturnType<typeof aFactura> | null = null;
  const dudosos = new Set<CampoFactura>();
  let problemas: string[] = [];
  if (editable) {
    factura = aFactura(item.original!, item.valores!, item.tocados);
    // Lo que la IA marcó como dudoso deja de estar en amarillo cuando la persona pasa por el
    // campo; lo que falla un control sigue en amarillo hasta que se corrija.
    for (const c of item.original!.campos_dudosos) {
      const campo = c as CampoEditable;
      if (!item.tocados.has(campo) && !item.revisados.has(campo)) dudosos.add(c);
    }
    if (factura.success) {
      const v = validateInvoice(factura.data);
      problemas = v.problemas.map((p) => p.mensaje);
      for (const p of v.problemas) p.campos.forEach((c) => dudosos.add(c));
    }
  }

  return (
    <article className={`card factura factura--${item.estado}`}>
      <header className="factura__encabezado">
        <h2>{item.nombre}</h2>
        <span className={`estado estado--${item.estado}`}>{ETIQUETAS[item.estado]}</span>
      </header>

      {item.error && (
        <p role="alert" className="alerta alerta--error">
          {item.error}
        </p>
      )}

      {item.estado === "guardada" && item.resultado && (
        <div className="alerta alerta--ok">
          Cargada en la planilla{item.resultado.fila ? ` (fila ${item.resultado.fila})` : ""} con estado "En revisión".
          {item.resultado.link && (
            <>
              {" "}
              <a href={item.resultado.link} target="_blank" rel="noreferrer">
                Ver archivo en Drive
              </a>
            </>
          )}
          {item.resultado.sinArchivo && " El archivo no se guardó en Drive: todavía no está configurado."}
        </div>
      )}

      {editable && (
        <div className="factura__cuerpo">
          <div className="factura__vista">
            {item.archivo?.type === "application/pdf" ? (
              <iframe src={item.vistaPrevia!} title={`Vista previa de ${item.nombre}`} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.vistaPrevia!} alt={`Vista previa de ${item.nombre}`} />
            )}
          </div>

          <div className="factura__datos">
            {item.duplicado && (
              <p className="alerta alerta--error">Esta factura ya está cargada en la planilla (mismo CUIT, tipo y número).</p>
            )}
            {problemas.length > 0 && (
              <ul className="alerta alerta--aviso">
                {problemas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {item.original!.observaciones && <p className="factura__nota">IA: {item.original!.observaciones}</p>}

            <div className="factura__campos">
              {CAMPOS.map((def) => (
                <label
                  key={def.campo}
                  className={`campo${dudosos.has(def.campo) ? " campo--dudoso" : ""}${def.ancho ? " campo--ancho" : ""}`}
                >
                  {def.etiqueta}
                  {def.tipo === "opciones" ? (
                    <select
                      value={item.valores![def.campo]}
                      onChange={(e) => onCambiar(def.campo, e.target.value)}
                      onBlur={() => onRevisar(def.campo)}
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
                      value={item.valores![def.campo]}
                      onChange={(e) => onCambiar(def.campo, e.target.value)}
                      onBlur={() => onRevisar(def.campo)}
                    />
                  )}
                </label>
              ))}
            </div>

            {factura && !factura.success && <p className="alerta alerta--error">Hay campos con valores inválidos.</p>}

            <div className="factura__acciones">
              <button
                type="button"
                className="btn btn--primario"
                disabled={!factura?.success}
                onClick={() => factura?.success && onAprobar(factura.data)}
              >
                Aprobar y cargar
              </button>
              <button type="button" className="btn btn--borde" onClick={onQuitar}>
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      {(item.estado === "error" || item.estado === "guardada") && (
        <div className="factura__acciones">
          {item.estado === "error" && item.archivo && (
            <button type="button" className="btn btn--borde btn--chico" onClick={onReintentar}>
              Reintentar
            </button>
          )}
          <button type="button" className="btn btn--borde btn--chico" onClick={onQuitar}>
            Quitar de la lista
          </button>
        </div>
      )}
    </article>
  );
}
