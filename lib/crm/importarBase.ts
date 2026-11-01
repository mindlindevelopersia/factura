/**
 * Importa una planilla cualquiera de contactos (por ejemplo, la base de posibles inversores) al CRM.
 * Las columnas se reconocen por su título; los duplicados se sacan dentro de la planilla y contra los
 * contactos que ya están, por mail, teléfono o nombre. A los que ya están se les completa lo que les
 * falte (mail o teléfono). Los nuevos entran como Dormido (base para nutrir, sin alarmas de "nuevo").
 * Todo puro (sin red).
 */

import type { Celda } from "../finanzas/ingresos";
import { nuevoId, type Contacto } from "./modelo";

type Campo = "nombre" | "apellido" | "mail" | "telefono" | "empresa" | "origen" | "referido" | "notas" | "tipo" | "presupuesto";

const TITULOS: [Campo, RegExp][] = [
  ["apellido", /^(apellidos?|last name)$/],
  ["nombre", /^(nombre( y apellido| completo)?|nombres?|name|first name|contacto|cliente|inversor)$/],
  ["mail", /(e-?mail|correo|\bmail\b)/],
  ["telefono", /(tel|cel|whats|movil|phone)/],
  ["empresa", /(empresa|compania|company)/],
  // "Referencia - Fuente": quién lo trajo. (No "OCUPACION + REFERENCIA", que empieza con otra cosa.)
  ["referido", /^(referid|referencia|recomend)/],
  ["origen", /(origen|fuente|source|canal)/],
  ["notas", /(nota|coment|observ|situaci|detalle)/],
  ["tipo", /^(tipo|type|perfil)$/],
  ["presupuesto", /(presupuesto|ticket|monto|capital|budget)/],
];

export function normalizar(t: unknown): string {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Los mails de una celda (puede haber varios separados por ; o ,). */
export const mails = (t: string) =>
  t
    .split(/[;,\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter((x) => /.+@.+\..+/.test(x));

/** Los últimos 8 dígitos: alcanza para reconocer el mismo número escrito distinto (+54 9 11…, 011…, 15…). */
export const claveTelefono = (t: string) => {
  const d = t.replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : null;
};

export interface Columnas {
  fila: number;
  campos: Partial<Record<Campo, number>>;
  titulos: string[];
  /** Las columnas con título que no son ningún campo: van a las notas, con su título. */
  extras: number[];
}

/** La fila de títulos (en las primeras 15) que reconoce al menos el nombre y otra columna. */
export function detectarColumnas(filas: Celda[][]): Columnas | null {
  for (let r = 0; r < Math.min(15, filas.length); r++) {
    const campos: Partial<Record<Campo, number>> = {};
    filas[r].forEach((c, i) => {
      const t = normalizar(c.valor);
      if (!t) return;
      const campo = TITULOS.find(([k, re]) => re.test(t) && campos[k] == null)?.[0];
      if (campo) campos[campo] = i;
    });
    if (campos.nombre != null && Object.keys(campos).length >= 2) {
      const usadas = new Set(Object.values(campos));
      const extras = filas[r].flatMap((c, i) => (!usadas.has(i) && String(c.valor ?? "").trim() ? [i] : []));
      return { fila: r, campos, titulos: filas[r].map((c) => String(c.valor ?? "").trim()), extras };
    }
  }
  return null;
}

export interface ResultadoImportacion {
  columnas: Columnas | null;
  nuevos: Contacto[];
  /** Repetidos dentro de la misma planilla. */
  repetidosEnPlanilla: number;
  /** Ya estaban en el CRM (con el motivo). */
  yaEstaban: { nombre: string; existente: string; por: "mail" | "teléfono" | "nombre" }[];
  /** A los que ya estaban, lo que se les completa. */
  completar: { id: string; nombre: string; telefono?: string; mail?: string }[];
  sinNombre: number;
}

export function importarBase(filas: Celda[][], existentes: Contacto[], ahora: string, origenPorDefecto = "Base de inversores"): ResultadoImportacion {
  const columnas = detectarColumnas(filas);
  const vacio: ResultadoImportacion = { columnas, nuevos: [], repetidosEnPlanilla: 0, yaEstaban: [], completar: [], sinNombre: 0 };
  if (!columnas) return vacio;
  const { campos } = columnas;
  // Los errores de la planilla ("#ERROR!", "#REF!") no son datos.
  const limpio = (v: unknown) => {
    const t = String(v ?? "").replace(/[\u200e\u202a-\u202e]/g, "").trim();
    return t.startsWith("#") ? "" : t;
  };
  const texto = (f: Celda[], k: Campo) => (campos[k] != null ? limpio(f[campos[k]!]?.valor) : "");
  const extras = (f: Celda[]) =>
    columnas.extras
      .map((i) => [columnas.titulos[i].replace(/[?:\s]+$/, ""), limpio(f[i]?.valor)] as const)
      .filter(([, v]) => v && !/^(no|-)$/i.test(v))
      .map(([t, v]) => `${t}: ${v}`);

  const porMail = new Map<string, Contacto>();
  const porTel = new Map<string, Contacto>();
  const porNombre = new Map<string, Contacto>();
  const indexar = (c: Contacto) => {
    for (const m of mails(c.mail)) porMail.set(m, c);
    const t = claveTelefono(c.telefono);
    if (t) porTel.set(t, c);
    porNombre.set(normalizar(c.nombre), c);
  };
  existentes.forEach(indexar);
  const nuevosIds = new Set<string>();
  const completar = new Map<string, ResultadoImportacion["completar"][number]>();
  const r: ResultadoImportacion = { ...vacio };

  for (let i = columnas.fila + 1; i < filas.length; i++) {
    const f = filas[i];
    const nombre = [texto(f, "nombre"), texto(f, "apellido")].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (!nombre) {
      if (f.some((c) => String(c.valor ?? "").trim())) r.sinNombre++;
      continue;
    }
    const mail = texto(f, "mail");
    const telefono = texto(f, "telefono");
    const m = mails(mail);
    const t = claveTelefono(telefono);
    const igual = m.map((x) => porMail.get(x)).find(Boolean) ? ("mail" as const) : t && porTel.get(t) ? ("teléfono" as const) : porNombre.get(normalizar(nombre)) ? ("nombre" as const) : null;
    const existente = m.map((x) => porMail.get(x)).find(Boolean) ?? (t ? porTel.get(t) : undefined) ?? porNombre.get(normalizar(nombre));
    if (existente && igual) {
      if (nuevosIds.has(existente.id)) {
        r.repetidosEnPlanilla++;
      } else {
        r.yaEstaban.push({ nombre, existente: existente.nombre, por: igual });
        // Lo que le falte al que ya estaba (sin pisar lo que tiene).
        const extra = { ...(completar.get(existente.id) ?? { id: existente.id, nombre: existente.nombre }) };
        if (!existente.telefono && telefono && !extra.telefono) extra.telefono = telefono;
        if (!existente.mail && mail && !extra.mail) extra.mail = mail;
        if (extra.telefono || extra.mail) completar.set(existente.id, extra);
      }
      continue;
    }
    const empresa = texto(f, "empresa");
    const presupuesto = Number(texto(f, "presupuesto").replace(/[^\d]/g, "")) || null;
    const c: Contacto = {
      id: nuevoId() + i.toString(36),
      proyectos: [],
      nombre,
      telefono,
      mail,
      tipo: texto(f, "tipo") || "Beneficiario al costo",
      origen: texto(f, "origen") || origenPorDefecto,
      referido: texto(f, "referido"),
      etapa: "Dormido",
      temperaturaManual: null,
      presupuestoUsd: presupuesto && presupuesto >= 1000 ? presupuesto : null,
      formaPago: "",
      plazo: "",
      uso: "",
      ambientes: "",
      unidades: [],
      proximoPaso: "",
      proximaFecha: null,
      motivoPerdida: "",
      volverAContactar: null,
      notas: [empresa ? `Empresa: ${empresa}.` : "", texto(f, "notas"), ...extras(f)].filter(Boolean).join(" · "),
      responsable: "Mati",
      creado: ahora,
      actualizado: ahora,
      entroEtapa: ahora,
      ultimoContacto: null,
      unidadVendida: "",
      precioVentaUsd: null,
    };
    r.nuevos.push(c);
    nuevosIds.add(c.id);
    indexar(c);
  }
  r.completar = [...completar.values()];
  return r;
}
