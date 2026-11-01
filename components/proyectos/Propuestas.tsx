"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { calcularPropuesta, parametrosIniciales, propuestaDeUrl } from "@/lib/proyectos/propuesta";
import { mensajePropuesta, whatsappPropuesta, type PropuestaGuardada } from "@/lib/proyectos/propuestasGuardadas";
import { proyecto as buscarProyecto } from "@/lib/modulos";
import { leerJson } from "../formato";
import { Icono } from "../Icono";
import { useCrm } from "../crm/datos";
import { useProyectoId } from "./datos";

const usd = (n: number) => `US$ ${Math.round(n).toLocaleString("es-AR")}`;
const fecha = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : "—");
const hoyBA = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

/** La lista de propuestas guardadas del proyecto: abrir y editar, descargar el PDF o mandarla por WhatsApp. */
export function Propuestas() {
  const id = useProyectoId();
  const proyecto = buscarProyecto(id);
  const ruta = usePathname();
  const crm = useCrm();
  const [lista, setLista] = useState<PropuestaGuardada[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");

  useEffect(() => {
    let vivo = true;
    fetch(`/api/proyectos/${id}/propuestas`)
      .then((r) => leerJson<{ propuestas: PropuestaGuardada[] }>(r))
      .then((d) => vivo && setLista(d.propuestas))
      .catch((e) => vivo && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      vivo = false;
    };
  }, [id]);

  const hoy = hoyBA();
  const filtradas = useMemo(() => {
    const t = buscar.trim().toLowerCase();
    return (lista ?? []).filter((x) => !t || `${x.cliente} ${x.unidad} ${x.autor}`.toLowerCase().includes(t));
  }, [lista, buscar]);

  const abrir = (x: PropuestaGuardada, extra = "") => `${ruta}?id=${x.id}&${x.parametros}${x.contactoId ? `&contacto=${x.contactoId}` : ""}${extra}`;
  const whatsapp = (x: PropuestaGuardada) => {
    const p = propuestaDeUrl(new URLSearchParams(x.parametros), parametrosIniciales({ cliente: x.cliente, unidad: x.unidad, precioUsd: x.precioUsd, tipoCambio: 1, hoy: x.creada.slice(0, 10), entrega: x.creada.slice(0, 7) }));
    const telefono = crm.contactos.find((c) => c.id === x.contactoId)?.telefono ?? "";
    return whatsappPropuesta(telefono, mensajePropuesta(p, calcularPropuesta(p), proyecto?.nombre.toUpperCase() ?? id));
  };

  return (
    <section className="card propuestas">
      <div className="propuestas__barra">
        <Link href={`${ruta}?nueva=1`} className="btn btn--primario">
          + Nueva propuesta
        </Link>
        <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por cliente, unidad o quién la hizo" aria-label="Buscar propuestas" />
      </div>
      {error && <p className="alerta alerta--error">{error}</p>}
      {!lista && !error && <p className="ficha__nota">Cargando las propuestas…</p>}
      {lista && !lista.length && <p className="ficha__nota">Todavía no hay propuestas guardadas. Armá una con &quot;Nueva propuesta&quot; y tocá Guardar.</p>}
      {lista && lista.length > 0 && (
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Unidad</th>
                <th className="tabla__numero">Valor</th>
                <th>Vence</th>
                <th>La hizo</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((x) => {
                const vencida = x.vence < hoy;
                return (
                  <tr key={x.id}>
                    <td data-etiqueta="Fecha">
                      {fecha(x.creada)}
                      {x.actualizada.slice(0, 16) !== x.creada.slice(0, 16) && <span className="tabla__sub">Cambiada el {fecha(x.actualizada)}</span>}
                    </td>
                    <td data-etiqueta="Cliente">
                      <Link className="ingresos__enlace" href={abrir(x)}>
                        {x.cliente || "Sin nombre"}
                      </Link>
                    </td>
                    <td data-etiqueta="Unidad">UF {x.unidad}</td>
                    <td data-etiqueta="Valor" className="tabla__numero">
                      {usd(x.precioUsd)}
                    </td>
                    <td data-etiqueta="Vence">
                      <span className={vencida ? "ingresos__vencido" : undefined}>{fecha(x.vence)}</span>
                      {vencida && <span className="tabla__sub">Vencida</span>}
                    </td>
                    <td data-etiqueta="La hizo">
                      {x.autor || "—"}
                      {x.editor && x.editor !== x.autor && <span className="tabla__sub">Cambió: {x.editor}</span>}
                    </td>
                    <td className="propuestas__acciones">
                      <Link className="btn btn--borde btn--chico" href={abrir(x)}>
                        Abrir
                      </Link>
                      <Link className="btn btn--borde btn--chico" href={abrir(x, "&imprimir=1")} title="Abre la propuesta y la manda a guardar en PDF">
                        <Icono nombre="imprimir" size={14} /> PDF
                      </Link>
                      <a className="btn btn--borde btn--chico" href={whatsapp(x)} target="_blank" rel="noreferrer" title="Abre WhatsApp con el mensaje armado: adjuntale el PDF">
                        WhatsApp
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
