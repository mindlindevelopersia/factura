"use client";

import { useRef, useState } from "react";
import { prepararArchivo } from "@/lib/client/comprimir";
import type { ItemCola } from "@/lib/cola/item";
import { leerJson } from "./formato";

/** Facturas que se suben y leen al mismo tiempo. */
const EN_PARALELO = 2;
const TAMANIO_MAXIMO = 4_300_000;
const ACEPTADOS = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";

interface Subida {
  id: string;
  nombre: string;
  estado: "en_cola" | "subiendo" | "lista" | "error";
  detalle?: string;
}

const ETIQUETAS: Record<Subida["estado"], string> = {
  en_cola: "En cola",
  subiendo: "Subiendo y leyendo con IA…",
  lista: "Lista para revisar",
  error: "Error",
};

/**
 * Subir comprobantes desde la web. Cada archivo se guarda en Drive, entra en la cola y se
 * lee con la IA; después aparece en "Para revisar", igual que los que llegan por Telegram.
 */
export function Subir({ onSubida, onIrARevisar }: { onSubida: () => void; onIrARevisar: () => void }) {
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const actualizar = (id: string, cambios: Partial<Subida>) =>
    setSubidas((prev) => prev.map((s) => (s.id === id ? { ...s, ...cambios } : s)));

  async function subir(id: string, original: File) {
    actualizar(id, { estado: "subiendo" });
    try {
      const archivo = await prepararArchivo(original);
      if (archivo.size > TAMANIO_MAXIMO) throw new Error("Pesa más de 4,3 MB. Si es un PDF escaneado, bajale la resolución o mandalo por Telegram.");
      const fd = new FormData();
      fd.append("archivo", archivo);
      const { item } = await leerJson<{ item: ItemCola }>(await fetch("/api/cola", { method: "POST", body: fd }));
      actualizar(id, item.estado === "error" ? { estado: "error", detalle: item.error ?? undefined } : { estado: "lista" });
      onSubida();
    } catch (e) {
      actualizar(id, { estado: "error", detalle: (e as Error).message });
    }
  }

  async function agregar(archivos: FileList | File[]) {
    const nuevas = Array.from(archivos).map((archivo) => ({ archivo, subida: { id: crypto.randomUUID(), nombre: archivo.name, estado: "en_cola" as const } }));
    setSubidas((prev) => [...nuevas.map((n) => n.subida), ...prev]);
    const cola = [...nuevas];
    await Promise.all(
      Array.from({ length: Math.min(EN_PARALELO, cola.length) }, async () => {
        for (let n = cola.shift(); n; n = cola.shift()) await subir(n.subida.id, n.archivo);
      }),
    );
  }

  const listas = subidas.filter((s) => s.estado === "lista").length;

  return (
    <div className="subir">
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
          void agregar(e.dataTransfer.files);
        }}
      >
        <p>
          <strong>Arrastrá las facturas acá</strong>
          <br />
          PDF o fotos. Podés soltar varias juntas. Quedan para revisar, no se cargan solas.
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
            if (e.target.files) void agregar(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {subidas.length > 0 && (
        <ul className="subidas">
          {subidas.map((s) => (
            <li key={s.id} className="subidas__item">
              <span className="subidas__nombre">{s.nombre}</span>
              <span className={`estado estado--${s.estado === "lista" ? "guardada" : s.estado === "error" ? "error" : "revision"}`}>
                {ETIQUETAS[s.estado]}
              </span>
              {s.detalle && <span className="subidas__detalle">{s.detalle}</span>}
            </li>
          ))}
        </ul>
      )}
      {listas > 0 && (
        <button type="button" className="btn btn--borde" onClick={onIrARevisar}>
          Revisar {listas === 1 ? "la factura leída" : `las ${listas} facturas leídas`}
        </button>
      )}
    </div>
  );
}
