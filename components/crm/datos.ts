"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { UnidadDisponible } from "@/lib/crm/alarmas";
import type { Actividad, CambiosContacto, Contacto } from "@/lib/crm/modelo";
import type { MensajeSugerido } from "@/lib/crm/mensajes";
import { leerJson } from "../formato";
import { useProyectoId } from "../proyectos/datos";

export interface DatosCrm {
  contactos: Contacto[];
  actividad: Actividad[];
  unidades: UnidadDisponible[];
  usuario: string;
  ahora: string;
}

/** El CRM del proyecto: contactos, actividad y las acciones (crear, cambiar, registrar, importar). */
export function useCrm() {
  const id = useProyectoId();
  const base = `/api/proyectos/${id}/crm`;
  const [datos, setDatos] = useState<DatosCrm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await leerJson<DatosCrm>(await fetch(base)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [base]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const reemplazar = (c: Contacto, actividad: Actividad[] = []) =>
    setDatos((d) => (d ? { ...d, contactos: d.contactos.some((x) => x.id === c.id) ? d.contactos.map((x) => (x.id === c.id ? c : x)) : [c, ...d.contactos], actividad: [...actividad, ...d.actividad] } : d));

  const crear = async (contacto: CambiosContacto, nota: string) => {
    const r = await leerJson<{ contacto: Contacto }>(await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contacto, nota }) }));
    reemplazar(r.contacto, [{ fecha: r.contacto.creado, usuario: datos?.usuario ?? "", contactoId: r.contacto.id, contacto: r.contacto.nombre, tipo: "Nota", detalle: nota ? `Alta: ${nota}` : "Alta del contacto", etapa: r.contacto.etapa }]);
    return r.contacto;
  };

  const actualizar = async (contactoId: string, cambios: CambiosContacto, actividad?: { tipo: string; detalle: string }) => {
    const r = await leerJson<{ contacto: Contacto }>(
      await fetch(`${base}/${contactoId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ cambios, actividad }) }),
    );
    const antes = datos?.contactos.find((x) => x.id === contactoId);
    const nuevas: Actividad[] = [];
    const ahora = r.contacto.actualizado;
    if (actividad && (actividad.detalle.trim() || actividad.tipo !== "Nota")) nuevas.push({ fecha: ahora, usuario: datos?.usuario ?? "", contactoId, contacto: r.contacto.nombre, tipo: actividad.tipo, detalle: actividad.detalle, etapa: r.contacto.etapa });
    if (antes && cambios.etapa && cambios.etapa !== antes.etapa) nuevas.push({ fecha: ahora, usuario: datos?.usuario ?? "", contactoId, contacto: r.contacto.nombre, tipo: "Cambio de etapa", detalle: `${antes.etapa} → ${r.contacto.etapa}`, etapa: r.contacto.etapa });
    reemplazar(r.contacto, nuevas);
    return r.contacto;
  };

  const importar = async () => {
    const r = await leerJson<{ importados: number }>(await fetch(`${base}/importar`, { method: "POST" }));
    await cargar();
    return r.importados;
  };

  const mensajeIa = async (contactoId: string, indicacion: string) =>
    leerJson<MensajeSugerido>(await fetch(`${base}/mensaje`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: contactoId, indicacion }) }));

  // Los contactos de este proyecto (los que no tienen proyecto, también).
  const contactos = useMemo(() => (datos?.contactos ?? []).filter((c) => !c.proyecto || c.proyecto === id), [datos, id]);
  const precioMinimo = useMemo(() => (datos?.unidades.length ? Math.min(...datos.unidades.map((u) => u.precioUsd)) : null), [datos]);

  return { datos, contactos, precioMinimo, error, cargando, recargar: cargar, crear, actualizar, importar, mensajeIa, proyecto: id };
}

export type Crm = ReturnType<typeof useCrm>;

export const usd = (n: number | null | undefined) => (n == null ? "—" : `US$ ${Math.round(n).toLocaleString("es-AR")}`);
export const fechaCorta = (f: string | null | undefined) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}${f.slice(0, 4) !== new Date().getFullYear().toString() ? `/${f.slice(2, 4)}` : ""}` : "—");
export function sumarDias(hoy: string, n: number): string {
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
