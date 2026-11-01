import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { ItemCola } from "../cola/item";
import { hoyBA } from "../crm/alarmas";
import { actualizarContacto, crearContacto, leerCrm } from "../crm/fuente";
import { contactoNuevo, ETAPAS, nuevoId as idContacto, ORIGENES, TIPOS_ACTIVIDAD, validarContacto, type CambiosContacto, type Etapa } from "../crm/modelo";
import { historicoMep, unidadesDisponibles } from "../finanzas/fuente";
import { sumarMeses } from "../finanzas/ingresos";
import { PROYECTO_PRINCIPAL, PROYECTOS, rutaProyecto } from "../modulos";
import { avisarAsignacion, avisarMenciones, notificar, usuariosDelSistema } from "../notificaciones/fuente";
import { extracto, usuarioPorApodo } from "../notificaciones/modelo";
import { comentarIdea, crearIdea, leerIdeas } from "../producto/fuente";
import { limpiarTags, TODOS_LOS_TAGS } from "../producto/tags";
import { puedeRuta, veProyecto, type Acceso } from "../permisos/modelo";
import { calcularPropuesta, ENTREGA, parametrosIniciales, propuestaAUrl } from "../proyectos/propuesta";
import { crearPropuesta } from "../proyectos/propuestasFuente";
import { actualizarTarea, comentar, crearTarea, leerTareas } from "../tareas/fuente";
import { abierta, ESTADOS, PRIORIDADES, PROYECTO_PRODUCTO, RELACIONES, rutaDeTarea, TIPOS, validarCambios, type CambiosTarea, type Tarea } from "../tareas/modelo";

/**
 * Lo que el bot de Telegram puede hacer en el hub, como herramientas de Claude. Cada una revisa
 * los permisos de quien escribe (los mismos de la web) antes de leer o cambiar algo.
 */

export interface ContextoBot {
  email: string;
  /** El @usuario de quien escribe (Mati, Tade). */
  usuario: string;
  acceso: Acceso;
  equipo: string[];
  appUrl: string;
  /** La última factura que mandó por este chat en la última media hora, si hay. */
  factura: { item: ItemCola; anotar: (texto: string) => Promise<void> } | null;
}

export interface ResultadoHerramienta {
  /** Lo que lee Claude (JSON corto). */
  contenido: string;
  error?: boolean;
  /** Lo que se hizo, para recordarlo en la conversación ("creó la tarea t123"). */
  accion?: string;
  /** Botones para la respuesta. */
  opciones?: string[];
}

// ——— Esquemas (estrictos: todos los campos, null cuando no se dijo) ———
const texto = (description: string) => ({ type: "string", description });
const textoONull = (description: string) => ({ anyOf: [{ type: "string" }, { type: "null" }], description });
const numeroONull = (description: string) => ({ anyOf: [{ type: "number" }, { type: "null" }], description });
const lista = (vals: readonly string[], description: string) => ({ type: "string", enum: [...vals], description });
const listaONull = (vals: readonly string[], description: string) => ({ anyOf: [{ type: "string", enum: [...vals] }, { type: "null" }], description });
const objeto = (props: Record<string, object>) => ({ type: "object" as const, properties: props, required: Object.keys(props), additionalProperties: false });

const IDS_PROYECTOS = PROYECTOS.map((p) => p.id);
const proyectoTarea = lista(["", PROYECTO_PRODUCTO, ...IDS_PROYECTOS], 'El proyecto: el id ("lerma-439"), "" para algo general de la empresa, o "producto" para un feature del hub.');
const proyectoComercial = lista(IDS_PROYECTOS, "El id del proyecto.");
const fecha = (d: string) => textoONull(`${d} En formato AAAA-MM-DD, calculada desde hoy. null si no se dijo.`);

export const HERRAMIENTAS: Anthropic.Beta.BetaTool[] = [
  {
    name: "buscar_tareas",
    description: "Busca tareas del hub (y features de Producto). Sirve para \"¿qué tengo pendiente?\", \"las tareas de Eliana\" o para encontrar una tarea antes de cambiarla.",
    strict: true,
    input_schema: objeto({
      texto: textoONull("Palabras a buscar en el título, la descripción o con quién; null para todas."),
      responsable: textoONull("El @usuario del responsable; null para todos."),
      proyecto: textoONull('Id de proyecto, "" (generales) o "producto"; null para todos.'),
      incluir_cerradas: { type: "boolean", description: "true para incluir las hechas y canceladas." },
    }),
  },
  {
    name: "crear_tarea",
    description: "Crea una tarea. Usala cuando tengas al menos qué hacer, quién (o que se dijo que es de quien escribe) y para cuándo (o que se dijo que no tiene fecha).",
    strict: true,
    input_schema: objeto({
      titulo: texto("Qué hay que hacer, corto y con verbo."),
      descripcion: texto("Detalles y contexto. Vacío si no hay."),
      responsable: texto("El @usuario de quien la tiene que hacer (de la lista del equipo)."),
      vence: fecha("Para cuándo."),
      hora: textoONull("HH:MM si se dijo; null si no."),
      prioridad: lista(PRIORIDADES, "Normal, salvo que se diga importante (Alta) o urgente (Urgente)."),
      tipo: lista(TIPOS, "El tipo de tarea."),
      proyecto: proyectoTarea,
      relacion: lista(RELACIONES, "Con quién tiene que ver."),
      con: texto("Nombre del inversor, lead o proveedor, o la unidad. Vacío si es interna."),
      subtareas: { type: "array", items: { type: "string" }, description: "Pasos sueltos; vacío si no hay." },
    }),
  },
  {
    name: "cambiar_tarea",
    description: "Cambia una tarea existente (por su id, de buscar_tareas): marcarla hecha, cambiar fecha, responsable o prioridad, o dejarle un comentario.",
    strict: true,
    input_schema: objeto({
      id: texto("El id de la tarea."),
      estado: listaONull(ESTADOS, "Nuevo estado; null si no cambia."),
      responsable: textoONull("Nuevo responsable (@usuario); null si no cambia."),
      vence: textoONull('Nueva fecha AAAA-MM-DD, "" para sacarle la fecha; null si no cambia.'),
      prioridad: listaONull(PRIORIDADES, "Nueva prioridad; null si no cambia."),
      titulo: textoONull("Nuevo título; null si no cambia."),
      comentario: textoONull("Un comentario para dejar en la tarea; null si no."),
    }),
  },
  {
    name: "buscar_contactos",
    description: "Busca leads y contactos del CRM por nombre, teléfono, mail o notas.",
    strict: true,
    input_schema: objeto({ texto: texto("Lo que hay que buscar.") }),
  },
  {
    name: "crear_contacto",
    description: "Carga un lead nuevo en el CRM. Antes buscalo con buscar_contactos para no duplicarlo.",
    strict: true,
    input_schema: objeto({
      nombre: texto("Nombre y apellido."),
      telefono: texto("Vacío si no se dijo."),
      mail: texto("Vacío si no se dijo."),
      origen: lista(["", ...ORIGENES], "Cómo llegó; vacío si no se dijo."),
      referido: texto("Quién lo refirió; vacío si no."),
      proyecto: proyectoComercial,
      unidades: { type: "array", items: { type: "string" }, description: 'Unidades que le interesan ("2C"); vacío si no.' },
      presupuesto_usd: numeroONull("Presupuesto en dólares; null si no se dijo."),
      notas: texto("Lo que se sabe de la persona. Vacío si no hay."),
      proximo_paso: texto("Qué hay que hacer con él. Vacío si no se dijo."),
      proxima_fecha: fecha("Cuándo es el próximo paso."),
      responsable: textoONull("Quién lo atiende (@usuario); null para quien escribe."),
    }),
  },
  {
    name: "registrar_seguimiento",
    description: "Anota algo de un contacto del CRM (una llamada, un WhatsApp, una reunión, una nota) y, si se dijo, le cambia la etapa o el próximo paso.",
    strict: true,
    input_schema: objeto({
      contacto_id: texto("El id del contacto (de buscar_contactos)."),
      tipo: lista(TIPOS_ACTIVIDAD.filter((t) => t !== "Cambio de etapa"), "Qué fue."),
      detalle: texto("Qué pasó."),
      etapa: listaONull(ETAPAS, "Nueva etapa; null si no cambia."),
      proximo_paso: textoONull("Nuevo próximo paso; null si no cambia."),
      proxima_fecha: fecha("Fecha del próximo paso."),
    }),
  },
  {
    name: "unidades_disponibles",
    description: "Las unidades que se pueden ofrecer de un proyecto (libres y en reventa), con m² y precio de lista.",
    strict: true,
    input_schema: objeto({ proyecto: proyectoComercial }),
  },
  {
    name: "crear_propuesta",
    description: "Arma y guarda una propuesta comercial con las condiciones de siempre (70/30, anticipos, cuotas hasta la entrega, refuerzos) al dólar MEP de hoy. Devuelve el link para verla, ajustarla y descargar el PDF.",
    strict: true,
    input_schema: objeto({
      proyecto: proyectoComercial,
      unidad: texto('Código de la unidad ("2C").'),
      cliente: texto("Nombre del cliente."),
      contacto_id: textoONull("El id del contacto del CRM si está cargado; null si no."),
      precio_usd: numeroONull("Precio en dólares si se dijo uno distinto al de lista; null para el de lista."),
    }),
  },
  {
    name: "buscar_ideas",
    description: "Busca ideas del tablero de Producto (mejoras y módulos nuevos para el hub). Usala antes de cargar una idea, para no repetirla, o para comentar una.",
    strict: true,
    input_schema: objeto({ texto: textoONull("Palabras a buscar; null para las últimas.") }),
  },
  {
    name: "crear_idea",
    description: "Carga una idea en el tablero de Producto (algo para sumar o mejorar en el hub: un módulo, una pantalla, un proceso). No es una tarea: no tiene responsable ni fecha.",
    strict: true,
    input_schema: objeto({
      titulo: texto("La idea en pocas palabras."),
      descripcion: texto("Qué es, para qué sirve y cómo se la imagina, con lo que se dijo (sin inventar)."),
      areas: { type: "array", items: { type: "string", enum: TODOS_LOS_TAGS }, description: 'A qué áreas o módulos del hub aplica ("Marketing", "Marketing · Blog"); vacío si no se sabe.' },
    }),
  },
  {
    name: "comentar_idea",
    description: "Deja un comentario en una idea de Producto (por su id, de buscar_ideas). Le avisa a quien la escribió.",
    strict: true,
    input_schema: objeto({ id: texto("El id de la idea."), comentario: texto("El comentario.") }),
  },
  {
    name: "nota_en_factura",
    description: "Anota un comentario en la última factura que mandó por este chat (solo si la hay; está en el contexto).",
    strict: true,
    input_schema: objeto({ texto: texto("El comentario.") }),
  },
  {
    name: "ofrecer_opciones",
    description: "Agrega botones a tu respuesta para que conteste con un toque (por ejemplo los nombres del equipo, o Hoy / Mañana / Sin fecha). Usala cuando hagas una pregunta con pocas respuestas posibles.",
    strict: true,
    input_schema: objeto({ opciones: { type: "array", items: { type: "string" }, description: "Entre 2 y 8 opciones cortas." } }),
  },
];

// ——— Ejecución ———
const json = (x: unknown) => JSON.stringify(x);
const error = (mensaje: string): ResultadoHerramienta => ({ contenido: json({ error: mensaje }), error: true });
const fechaOk = (f: unknown) => (typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : null);
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** La ruta de la web que hay que poder ver para tocar una tarea. */
const rutaTareas = (proyecto: string) => (proyecto === PROYECTO_PRODUCTO ? "/producto/features" : rutaProyecto(proyecto || PROYECTO_PRINCIPAL.id, "tareas"));
const puedeTarea = (a: Acceso, t: Pick<Tarea, "proyecto">) => puedeRuta(a, rutaTareas(t.proyecto)) && (!t.proyecto || t.proyecto === PROYECTO_PRODUCTO || veProyecto(a, t.proyecto));
const puedeComercial = (a: Acceso, proyecto: string, que: "comercial/crm" | "comercial/propuesta") => veProyecto(a, proyecto) && puedeRuta(a, rutaProyecto(proyecto, que));

const resumenTarea = (t: Tarea) => ({ id: t.id, titulo: t.titulo, estado: t.estado, responsable: t.responsable, vence: t.vence, prioridad: t.prioridad, proyecto: t.proyecto || "general", con: t.con || undefined });

export async function ejecutar(nombre: string, entrada: Record<string, unknown>, ctx: ContextoBot): Promise<ResultadoHerramienta> {
  const link = (ruta: string) => `${ctx.appUrl}${ruta}`;
  switch (nombre) {
    case "buscar_tareas": {
      const q = typeof entrada.texto === "string" ? sinTildes(entrada.texto) : "";
      const { tareas } = await leerTareas();
      const l = tareas
        .filter((t) => puedeTarea(ctx.acceso, t))
        .filter((t) => entrada.incluir_cerradas === true || abierta(t))
        .filter((t) => typeof entrada.responsable !== "string" || sinTildes(t.responsable) === sinTildes(entrada.responsable))
        .filter((t) => typeof entrada.proyecto !== "string" || t.proyecto === entrada.proyecto)
        .filter((t) => !q || q.split(/\s+/).every((p) => sinTildes(`${t.titulo} ${t.descripcion} ${t.con}`).includes(p)))
        .sort((a, b) => (a.vence ?? "9999").localeCompare(b.vence ?? "9999"));
      return { contenido: json({ hoy: hoyBA(), total: l.length, tareas: l.slice(0, 15).map(resumenTarea) }) };
    }
    case "crear_tarea": {
      const proyecto = String(entrada.proyecto ?? "");
      if (!puedeTarea(ctx.acceso, { proyecto })) return error("No tiene permiso para cargar tareas ahí.");
      const v = validarCambios(
        {
          titulo: entrada.titulo,
          descripcion: entrada.descripcion,
          responsable: entrada.responsable || ctx.usuario,
          vence: fechaOk(entrada.vence),
          hora: typeof entrada.hora === "string" && /^\d{1,2}:\d{2}$/.test(entrada.hora) ? entrada.hora : "",
          prioridad: entrada.prioridad,
          tipo: entrada.tipo,
          relacion: entrada.con ? entrada.relacion : "Interna",
          con: entrada.con,
          subtareas: Array.isArray(entrada.subtareas) ? entrada.subtareas.map((texto) => ({ texto: String(texto), hecha: false })) : [],
        },
        true,
      );
      if ("error" in v) return error(v.error);
      const t = await crearTarea({ ...v.cambios, proyecto }, ctx.usuario, proyecto);
      const url = link(rutaDeTarea(t));
      if (t.responsable && t.responsable !== ctx.usuario) {
        await avisarAsignacion({ apodo: t.responsable, titulo: `la tarea ${t.titulo}`, texto: "Desde Telegram", link: rutaDeTarea(t), de: ctx.usuario, deEmail: ctx.email }).catch((e) => console.error("bot aviso", e));
      }
      return { contenido: json({ creada: resumenTarea(t), link: url }), accion: `creó la tarea ${t.id} "${t.titulo}"` };
    }
    case "cambiar_tarea": {
      const id = String(entrada.id ?? "");
      const actual = (await leerTareas()).tareas.find((t) => t.id === id);
      if (!actual) return error("No encontré esa tarea.");
      if (!puedeTarea(ctx.acceso, actual)) return error("No tiene permiso para cambiar esa tarea.");
      const cambios: Record<string, unknown> = {};
      for (const k of ["estado", "responsable", "prioridad", "titulo"] as const) if (typeof entrada[k] === "string" && entrada[k]) cambios[k] = entrada[k];
      if (entrada.vence === "") cambios.vence = null;
      else if (fechaOk(entrada.vence)) cambios.vence = entrada.vence;
      const v = validarCambios(cambios, false);
      if ("error" in v) return error(v.error);
      const r = Object.keys(v.cambios).length ? await actualizarTarea(id, v.cambios as CambiosTarea) : { antes: actual, tarea: actual };
      if (!r) return error("No encontré esa tarea.");
      if (typeof entrada.comentario === "string" && entrada.comentario.trim()) await comentar(id, ctx.usuario, entrada.comentario.trim());
      if (r.tarea.responsable !== r.antes.responsable && r.tarea.responsable && r.tarea.responsable !== ctx.usuario) {
        await avisarAsignacion({ apodo: r.tarea.responsable, titulo: `la tarea ${r.tarea.titulo}`, texto: "Desde Telegram", link: rutaDeTarea(r.tarea), de: ctx.usuario, deEmail: ctx.email }).catch((e) => console.error("bot aviso", e));
      }
      return { contenido: json({ tarea: resumenTarea(r.tarea), link: link(rutaDeTarea(r.tarea)) }), accion: `cambió la tarea ${id}` };
    }
    case "buscar_contactos": {
      const q = sinTildes(String(entrada.texto ?? "")).trim();
      const { contactos } = await leerCrm();
      const visibles = contactos.filter((c) => (c.proyectos.length ? c.proyectos : [PROYECTO_PRINCIPAL.id]).some((p) => puedeComercial(ctx.acceso, p, "comercial/crm")));
      const l = visibles.filter((c) => q.split(/\s+/).every((p) => sinTildes(`${c.nombre} ${c.telefono} ${c.mail} ${c.notas} ${c.referido}`).includes(p)));
      return {
        contenido: json({
          total: l.length,
          contactos: l.slice(0, 8).map((c) => ({ id: c.id, nombre: c.nombre, etapa: c.etapa, telefono: c.telefono, mail: c.mail, unidades: c.unidades, proximo_paso: c.proximoPaso, proxima_fecha: c.proximaFecha, responsable: c.responsable, proyectos: c.proyectos })),
        }),
      };
    }
    case "crear_contacto": {
      const proyecto = String(entrada.proyecto ?? PROYECTO_PRINCIPAL.id);
      if (!puedeComercial(ctx.acceso, proyecto, "comercial/crm")) return error("No tiene permiso para cargar leads en ese proyecto.");
      const datos: CambiosContacto = {
        nombre: String(entrada.nombre ?? "").trim(),
        telefono: String(entrada.telefono ?? ""),
        mail: String(entrada.mail ?? ""),
        origen: String(entrada.origen ?? ""),
        referido: String(entrada.referido ?? ""),
        unidades: Array.isArray(entrada.unidades) ? entrada.unidades.map(String) : [],
        presupuestoUsd: typeof entrada.presupuesto_usd === "number" ? entrada.presupuesto_usd : null,
        notas: String(entrada.notas ?? ""),
        proximoPaso: String(entrada.proximo_paso ?? ""),
        proximaFecha: fechaOk(entrada.proxima_fecha),
        responsable: typeof entrada.responsable === "string" && entrada.responsable ? entrada.responsable : ctx.usuario,
      };
      const e = validarContacto(datos, true);
      if (e) return error(e);
      const ahora = new Date().toISOString();
      const c = contactoNuevo(datos, { id: idContacto(), proyecto, usuario: ctx.usuario, ahora });
      await crearContacto(c, { fecha: ahora, usuario: ctx.usuario, contactoId: c.id, contacto: c.nombre, tipo: "Nota", detalle: "Alta del contacto (desde Telegram)", etapa: c.etapa });
      const ruta = `${rutaProyecto(proyecto, "comercial/crm")}?contacto=${c.id}`;
      if (c.responsable !== ctx.usuario) await avisarAsignacion({ apodo: c.responsable, titulo: `el lead nuevo ${c.nombre}`, texto: c.etapa, link: ruta, de: ctx.usuario, deEmail: ctx.email }).catch((x) => console.error("bot aviso", x));
      return { contenido: json({ creado: { id: c.id, nombre: c.nombre, etapa: c.etapa }, link: link(ruta) }), accion: `cargó el lead ${c.id} "${c.nombre}"` };
    }
    case "registrar_seguimiento": {
      const id = String(entrada.contacto_id ?? "");
      const actual = (await leerCrm()).contactos.find((c) => c.id === id);
      if (!actual) return error("No encontré ese contacto.");
      const proyecto = actual.proyectos[0] ?? PROYECTO_PRINCIPAL.id;
      if (!puedeComercial(ctx.acceso, proyecto, "comercial/crm")) return error("No tiene permiso para ese contacto.");
      const cambios: CambiosContacto = {};
      if (typeof entrada.etapa === "string" && (ETAPAS as readonly string[]).includes(entrada.etapa)) cambios.etapa = entrada.etapa as Etapa;
      if (typeof entrada.proximo_paso === "string") cambios.proximoPaso = entrada.proximo_paso;
      if (fechaOk(entrada.proxima_fecha)) cambios.proximaFecha = fechaOk(entrada.proxima_fecha);
      const e = validarContacto(cambios, false);
      if (e) return error(e);
      const ahora = new Date().toISOString();
      const c = await actualizarContacto(id, cambios, { fecha: ahora, usuario: ctx.usuario, contactoId: id, tipo: String(entrada.tipo ?? "Nota"), detalle: String(entrada.detalle ?? "") }, ahora);
      if (!c) return error("No encontré ese contacto.");
      return { contenido: json({ contacto: { id: c.id, nombre: c.nombre, etapa: c.etapa, proximo_paso: c.proximoPaso, proxima_fecha: c.proximaFecha }, link: link(`${rutaProyecto(proyecto, "comercial/crm")}?contacto=${c.id}`) }), accion: `anotó un seguimiento de ${c.nombre} (${c.id})` };
    }
    case "unidades_disponibles": {
      const proyecto = String(entrada.proyecto ?? PROYECTO_PRINCIPAL.id);
      if (!puedeComercial(ctx.acceso, proyecto, "comercial/propuesta") && !puedeComercial(ctx.acceso, proyecto, "comercial/crm")) return error("No tiene permiso para ver las unidades de ese proyecto.");
      const l = await unidadesDisponibles(proyecto);
      return { contenido: json({ unidades: l.map((u) => ({ codigo: u.codigo, tipologia: u.tipologia, orientacion: u.orientacion, m2: Math.round(u.m2 * 10) / 10, precio_usd: Math.round(u.precioUsd), tipo: u.tipo })) }) };
    }
    case "crear_propuesta": {
      const proyecto = String(entrada.proyecto ?? PROYECTO_PRINCIPAL.id);
      if (!puedeComercial(ctx.acceso, proyecto, "comercial/propuesta")) return error("No tiene permiso para armar propuestas en ese proyecto.");
      const codigo = String(entrada.unidad ?? "").trim().toUpperCase();
      const u = (await unidadesDisponibles(proyecto)).find((x) => x.codigo.toUpperCase() === codigo);
      if (!u) return error(`La unidad ${codigo} no está disponible (o no existe). Usá unidades_disponibles para ver cuáles hay.`);
      // El último día publicado (la serie viene por fecha, pero no se da por hecho).
      const mep = (await historicoMep()).valor.reduce<{ fecha: string; venta: number } | null>((a, b) => (!a || b.fecha > a.fecha ? b : a), null)?.venta;
      if (!mep) return error("No pude leer el dólar MEP de hoy.");
      const hoy = hoyBA();
      const p = parametrosIniciales({
        cliente: String(entrada.cliente ?? "").trim(),
        unidad: u.codigo,
        precioUsd: typeof entrada.precio_usd === "number" && entrada.precio_usd > 0 ? entrada.precio_usd : u.precioUsd,
        tipoCambio: mep,
        hoy,
        entrega: ENTREGA[proyecto] ?? sumarMeses(hoy.slice(0, 7), 18),
      });
      const r = calcularPropuesta(p);
      const contactoId = typeof entrada.contacto_id === "string" ? entrada.contacto_id : "";
      const g = await crearPropuesta(proyecto, { cliente: p.cliente, contactoId, unidad: p.unidad, precioUsd: p.precioUsd, totalArs: r.totalArs, vence: r.hasta, parametros: propuestaAUrl(p) }, ctx.usuario);
      const url = link(`${rutaProyecto(proyecto, "comercial/propuesta")}?id=${g.id}&${g.parametros}${contactoId ? `&contacto=${contactoId}` : ""}`);
      return {
        contenido: json({ propuesta: { id: g.id, unidad: p.unidad, cliente: p.cliente, precio_usd: p.precioUsd, dolar_mep: p.tipoCambio, total_ars: Math.round(r.totalArs), vence: r.hasta, cuotas: p.cuotas.cantidad }, link: url }),
        accion: `guardó la propuesta ${g.id} (${p.unidad} para ${p.cliente})`,
      };
    }
    case "buscar_ideas": {
      if (!puedeRuta(ctx.acceso, "/producto/ideas")) return error("No tiene permiso para ver las ideas de Producto.");
      const q = typeof entrada.texto === "string" ? sinTildes(entrada.texto) : "";
      const { ideas } = await leerIdeas();
      const l = ideas.filter((i) => !q || q.split(/\s+/).every((p) => sinTildes(`${i.titulo} ${i.texto} ${i.tags.join(" ")}`).includes(p))).slice(-10).reverse();
      return { contenido: json({ total: l.length, ideas: l.map((i) => ({ id: i.id, titulo: i.titulo, estado: i.estado, autor: i.autor, areas: i.tags, creada: i.creada.slice(0, 10) })) }) };
    }
    case "crear_idea": {
      if (!puedeRuta(ctx.acceso, "/producto/ideas")) return error("No tiene permiso para cargar ideas de Producto.");
      const titulo = String(entrada.titulo ?? "").trim().slice(0, 200);
      if (!titulo) return error("La idea necesita un título.");
      const idea = await crearIdea(titulo, String(entrada.descripcion ?? "").slice(0, 10000), ctx.usuario, limpiarTags(entrada.areas));
      const ruta = `/producto/ideas?idea=${idea.id}`;
      await avisarMenciones({ texto: `${idea.titulo}\n${idea.texto}`, titulo: `Idea: ${idea.titulo}`, link: ruta, de: ctx.usuario, deEmail: ctx.email }).catch((e) => console.error("bot aviso", e));
      return { contenido: json({ creada: { id: idea.id, titulo: idea.titulo, areas: idea.tags }, link: link(ruta) }), accion: `cargó la idea ${idea.id} "${idea.titulo}"` };
    }
    case "comentar_idea": {
      if (!puedeRuta(ctx.acceso, "/producto/ideas")) return error("No tiene permiso para las ideas de Producto.");
      const id = String(entrada.id ?? "");
      const idea = (await leerIdeas()).ideas.find((i) => i.id === id);
      if (!idea) return error("No encontré esa idea.");
      const comentario = String(entrada.comentario ?? "").trim().slice(0, 3000);
      if (!comentario) return error("El comentario está vacío.");
      await comentarIdea(id, ctx.usuario, comentario);
      const ruta = `/producto/ideas?idea=${id}`;
      const autor = usuarioPorApodo(idea.autor, await usuariosDelSistema());
      await Promise.all([
        avisarMenciones({ texto: comentario, titulo: `Idea: ${idea.titulo}`, link: ruta, de: ctx.usuario, deEmail: ctx.email }),
        autor && autor.email !== ctx.email ? notificar([{ para: autor, tipo: "comentario", titulo: `${ctx.usuario} comentó tu idea: ${idea.titulo}`, texto: extracto(comentario), link: ruta, de: ctx.usuario, deEmail: ctx.email }]) : null,
      ]).catch((e) => console.error("bot aviso", e));
      return { contenido: json({ ok: true, link: link(ruta) }), accion: `comentó la idea ${id}` };
    }
    case "nota_en_factura": {
      if (!ctx.factura) return error("No hay una factura de este chat en la última media hora.");
      await ctx.factura.anotar(String(entrada.texto ?? ""));
      return { contenido: json({ ok: true }), accion: "anotó un comentario en la última factura" };
    }
    case "ofrecer_opciones": {
      const opciones = (Array.isArray(entrada.opciones) ? entrada.opciones : []).map((x) => String(x).slice(0, 40)).filter(Boolean).slice(0, 8);
      return { contenido: json({ ok: true }), opciones };
    }
    default:
      return error(`No existe la herramienta ${nombre}.`);
  }
}
