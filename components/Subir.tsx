"use client";

import { useEffect, useRef, useState } from "react";
import { prepararArchivo } from "@/lib/client/comprimir";
import { errorArchivo, TAMANIO_MAXIMO_WEB, TIPOS_CARGA } from "@/lib/client/archivo";
import type { ItemCola } from "@/lib/cola/item";
import { ErrorRespuesta, leerJson } from "./formato";
import { Icono } from "./Icono";

interface Subida {
  id: string;
  archivo: File;
  comentario: string;
  estado: "en_cola" | "subiendo" | "lista" | "repetida" | "error";
  detalle?: string;
  itemId?: string;
  reintentable?: boolean;
}
const ETIQUETAS = {
  en_cola: "En espera",
  subiendo: "Leyendo con IA",
  lista: "Lista para revisar",
  repetida: "Ya estaba",
  error: "No se pudo completar",
};

export function Subir({
  onSubida,
  onIrARevisar,
  onActividad,
}: {
  onSubida: (id: string) => void;
  onIrARevisar: (id?: string) => void;
  onActividad: (cantidad: number) => void;
}) {
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [comentario, setComentario] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const cola = useRef<Subida[]>([]);
  const activos = useRef(0);
  const profundidadDrag = useRef(0);
  const actualizar = (id: string, cambios: Partial<Subida>) =>
    setSubidas((prev) => prev.map((s) => (s.id === id ? { ...s, ...cambios } : s)));
  const pendientes = subidas.filter((s) => s.estado === "en_cola" || s.estado === "subiendo").length;
  const listas = subidas.filter((s) => s.estado === "lista").length;

  useEffect(() => {
    onActividad(pendientes);
  }, [pendientes, onActividad]);
  useEffect(() => {
    if (!pendientes) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [pendientes]);

  async function subir(s: Subida) {
    actualizar(s.id, {
      estado: "subiendo",
      detalle: undefined,
      reintentable: false,
    });
    try {
      const archivo = await prepararArchivo(s.archivo);
      if (archivo.size > TAMANIO_MAXIMO_WEB)
        throw new Error("El archivo sigue superando los 4,3 MB. Reducí su tamaño o mandalo por Telegram.");
      const fd = new FormData();
      fd.append("archivo", archivo);
      if (s.comentario.trim()) fd.append("comentario", s.comentario.trim());
      const { item } = await leerJson<{ item: ItemCola }>(await fetch("/api/cola", { method: "POST", body: fd }));
      actualizar(s.id, {
        estado: item.estado === "error" ? "error" : "lista",
        detalle: item.error ?? undefined,
        itemId: item.id,
      });
      onSubida(item.id);
    } catch (e) {
      const repetida = e instanceof ErrorRespuesta && e.status === 409;
      actualizar(s.id, {
        estado: repetida ? "repetida" : "error",
        detalle: (e as Error).message,
        reintentable: !repetida,
      });
    }
  }

  function consumir() {
    while (activos.current < 2 && cola.current.length) {
      const siguiente = cola.current.shift()!;
      ++activos.current;
      void subir(siguiente).finally(() => {
        --activos.current;
        consumir();
      });
    }
  }
  function agregar(archivos: FileList | File[]) {
    const nuevas: Subida[] = Array.from(archivos).map((archivo) => {
      const error = errorArchivo(archivo);
      return {
        id: crypto.randomUUID(),
        archivo,
        comentario,
        estado: error ? "error" : "en_cola",
        detalle: error ?? undefined,
      };
    });
    if (!nuevas.length) return;
    setSubidas((prev) => [...nuevas, ...prev]);
    if (nuevas.some((s) => s.estado === "en_cola")) setComentario("");
    cola.current.push(...nuevas.filter((s) => s.estado === "en_cola"));
    consumir();
  }

  return (
    <div className="subir">
      <div className="card carga-panel">
        <div
          className={`zona-carga${arrastrando ? " zona-carga--activa" : ""}`}
          onDragEnter={(e) => {
            e.preventDefault();
            ++profundidadDrag.current;
            setArrastrando(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => {
            e.preventDefault();
            if (--profundidadDrag.current <= 0) {
              profundidadDrag.current = 0;
              setArrastrando(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            profundidadDrag.current = 0;
            setArrastrando(false);
            agregar(e.dataTransfer.files);
          }}
        >
          <span className="zona-carga__icono">
            <Icono nombre="subir" size={28} />
          </span>
          <h3>{arrastrando ? "Soltá los archivos para subirlos" : "Arrastrá tus facturas acá"}</h3>
          <p>Podés subir varios PDF o fotos juntos.</p>
          <button type="button" className="btn btn--primario" onClick={() => input.current?.click()}>
            <Icono nombre="subir" size={18} />
            Elegir archivos
          </button>
          <span className="zona-carga__ayuda">PDF hasta 4,3 MB · JPG, PNG y WEBP · Las fotos grandes se comprimen</span>
          <input
            ref={input}
            type="file"
            aria-label="Archivos de facturas"
            accept={TIPOS_CARGA}
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) agregar(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        <label className="campo subir__comentario">
          Comentario para estos archivos <span className="campo__opcional">Opcional</span>
          <input
            type="text"
            value={comentario}
            placeholder="Por ejemplo: obra de Lerma, ya está pagada"
            onChange={(e) => setComentario(e.target.value)}
          />
          <span className="campo__ayuda">Se guarda con la próxima carga y ayuda a la IA a entender el contexto.</span>
        </label>
        <p className="carga-panel__nota">
          <Icono nombre="check" size={16} />
          Vos tenés el control: nada se registra en la planilla hasta que lo revisás y aprobás.
        </p>
      </div>
      {subidas.length > 0 && (
        <div className="card progreso-cargas">
          <div className="seccion-titulo">
            <div>
              <h3>Archivos de esta sesión</h3>
              <p role="status" aria-live="polite">
                {pendientes
                  ? `${pendientes} ${pendientes === 1 ? "archivo en proceso" : "archivos en proceso"}. La lectura suele tardar entre 10 y 40 segundos.`
                  : "Se completó el procesamiento de los archivos."}
              </p>
            </div>
            {listas > 0 && (
              <button type="button" className="btn btn--primario btn--chico" onClick={() => onIrARevisar()}>
                Ir a revisar <Icono nombre="flecha" size={16} />
              </button>
            )}
          </div>
          <ul className="subidas">
            {subidas.map((s) => (
              <li key={s.id} className="subidas__item">
                <Icono
                  nombre={
                    s.estado === "lista"
                      ? "check"
                      : s.estado === "error"
                        ? "alerta"
                        : s.estado === "subiendo"
                          ? "recargar"
                          : "archivo"
                  }
                  className={s.estado === "subiendo" ? "girando" : undefined}
                />
                <span className="subidas__nombre">{s.archivo.name}</span>
                <span
                  className={`estado estado--${s.estado === "lista" ? "guardada" : s.estado === "error" ? "error" : s.estado === "repetida" ? "aviso" : "leyendo"}`}
                >
                  {ETIQUETAS[s.estado]}
                </span>
                {s.detalle && (
                  <span className={`subidas__detalle${s.estado === "repetida" ? " subidas__detalle--aviso" : ""}`}>
                    {s.detalle}
                  </span>
                )}
                {s.reintentable && (
                  <button
                    type="button"
                    className="btn btn--texto btn--chico"
                    onClick={() => {
                      actualizar(s.id, {
                        estado: "en_cola",
                        reintentable: false,
                      });
                      cola.current.push(s);
                      consumir();
                    }}
                  >
                    Reintentar
                  </button>
                )}
                {s.itemId && s.estado === "error" && (
                  <button type="button" className="btn btn--texto btn--chico" onClick={() => onIrARevisar(s.itemId)}>
                    Revisar en la bandeja
                  </button>
                )}
              </li>
            ))}
          </ul>
          {pendientes > 0 && (
            <p className="campo__ayuda">
              Podés cambiar de sección. Para terminar las cargas, mantené abierta esta pestaña.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
