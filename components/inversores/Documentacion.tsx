"use client";

import { useCallback, useEffect, useState } from "react";
import type { Documento } from "@/lib/inversores/documentos";
import { PROYECTO_PRINCIPAL, rutaProyecto } from "@/lib/modulos";
import { leerJson } from "../formato";
import { Icono } from "../Icono";
import { usePuedeRuta } from "../Permisos";

interface DatosDocumentacion {
  porCuenta: Record<string, Documento[]>;
  porUnidad: Record<string, Documento[]>;
  sinAsignar: { id: string; nombre: string; documentos: number }[];
  carpetas: { id: string; nombre: string }[];
  carpetaDe: Record<string, string[]>;
  cuentas: { id: string; inversor: string; unidad: string }[];
}

const RUTA = rutaProyecto(PROYECTO_PRINCIPAL.id, "inversores/cuentas-corrientes");

/** Una sola lectura para toda la página (la ficha, la lista y el CRM la comparten). */
let pedido: Promise<DatosDocumentacion> | null = null;
function leer(fresco = false): Promise<DatosDocumentacion> {
  if (fresco || !pedido) {
    pedido = fetch(`/api/inversores/documentos${fresco ? "?fresco=1" : ""}`).then((r) => leerJson<DatosDocumentacion>(r));
    pedido.catch(() => (pedido = null));
  }
  return pedido;
}

function useDocumentacion() {
  const puede = usePuedeRuta()(RUTA);
  const [datos, setDatos] = useState<DatosDocumentacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cargar = useCallback(async (fresco = false) => {
    try {
      setDatos(await leer(fresco));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    if (puede) void cargar();
  }, [puede, cargar]);
  return { puede, datos, error, cargar };
}

const fecha = (f: string) => (f ? f.split("-").reverse().join("/") : "");

function ListaDocumentos({ docs }: { docs: Documento[] }) {
  return (
    <ul className="docs__lista">
      {docs.map((d) => (
        <li key={d.id}>
          <a className="docs__item" href={`/api/inversores/documentos/${d.id}`} target="_blank" rel="noreferrer">
            <Icono nombre="archivo" size={18} />
            <span>
              <strong>{d.tipo}</strong>
              <small>
                {d.nombre}
                {d.modificado ? ` · ${fecha(d.modificado)}` : ""}
              </small>
            </span>
            <Icono nombre="externo" size={14} />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** La documentación firmada de una cuenta corriente (o de una unidad, desde el CRM). */
export function DocumentosInversor({ cuenta, unidad, titulo = "Documentación firmada" }: { cuenta?: string; unidad?: string; titulo?: string }) {
  const { puede, datos, error } = useDocumentacion();
  if (!puede) return null;
  const docs = datos ? (cuenta ? datos.porCuenta[cuenta] : unidad ? datos.porUnidad[unidad.toUpperCase()] : undefined) : undefined;
  return (
    <section className="card docs solo-pantalla" aria-label={titulo}>
      <h3>{titulo}</h3>
      {error ? (
        <p className="crm-ficha__sub">{error}</p>
      ) : !datos ? (
        <p className="crm-ficha__sub">Buscando en Drive…</p>
      ) : docs?.length ? (
        <ListaDocumentos docs={docs} />
      ) : docs ? (
        <p className="crm-ficha__sub">Su carpeta está, pero no tiene PDF (solo editables).</p>
      ) : (
        <p className="crm-ficha__sub">No encontré su carpeta en Drive. Si está con otro nombre, asignala desde Cuentas corrientes → &quot;Documentación sin asignar&quot;.</p>
      )}
    </section>
  );
}

/** Las carpetas de Drive que no se pudieron asignar solas: se eligen a mano (una vez). */
export function DocumentacionSinAsignar() {
  const { puede, datos, error, cargar } = useDocumentacion();
  const [eleccion, setEleccion] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  if (!puede) return null;
  if (error) return <p className="alerta alerta--aviso solo-pantalla">Documentación firmada: {error}</p>;
  if (!datos?.sinAsignar.length) return null;
  const asignar = async (carpeta: string) => {
    setGuardando(carpeta);
    setAviso(null);
    try {
      await leerJson(await fetch("/api/inversores/documentos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ carpeta, cuenta: eleccion[carpeta] ?? "" }) }));
      await cargar(true);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(null);
    }
  };
  return (
    <details className="card docs__sin-asignar solo-pantalla">
      <summary>
        <Icono nombre="archivo" size={16} /> Documentación sin asignar <span className="revisar__contador">{datos.sinAsignar.length}</span>
      </summary>
      <p className="crm-ficha__sub">Carpetas de Drive que no pude asociar solas a un inversor (por el nombre). Elegí de quién es cada una; queda guardado.</p>
      {aviso && <p className="oliver__error">{aviso}</p>}
      <ul className="docs__asignar">
        {datos.sinAsignar.map((c) => (
          <li key={c.id}>
            <span data-sensible="">
              <strong>{c.nombre}</strong>
              <small>
                {c.documentos} {c.documentos === 1 ? "PDF" : "PDF"}
              </small>
            </span>
            <select value={eleccion[c.id] ?? ""} onChange={(e) => setEleccion((x) => ({ ...x, [c.id]: e.target.value }))} aria-label={`De quién es ${c.nombre}`}>
              <option value="">Elegí el inversor…</option>
              {datos.cuentas.map((x) => (
                <option key={x.id} value={x.id}>
                  UF {x.unidad} · {x.inversor}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn--borde btn--chico" disabled={!eleccion[c.id] || guardando === c.id} onClick={() => void asignar(c.id)}>
              {guardando === c.id ? "Guardando…" : "Asignar"}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
