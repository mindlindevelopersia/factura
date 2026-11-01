import "server-only";
import { agregarNota, ultimoDelChat, type Servicios } from "../cola/servicio";
import { hoyBA } from "../crm/alarmas";
import { EQUIPO_APODOS } from "../equipo";
import { accesoDeEmail, perfilDe } from "../permisos/fuente";
import { resumen } from "../telegram/mensajes";
import { conversar, type RespuestaBot } from "./agente";
import { guardarConversacion, leerConversacion } from "./conversacion";
import { turnoBot } from "./historial";
import { contextoBot } from "./instrucciones";

/** Un mensaje escrito al bot: arma el contexto de quien escribe, conversa y guarda la charla. */
export async function atenderConAsistente(o: { s: Servicios; chat: number; email: string; de: string; texto: string; appUrl: string }): Promise<RespuestaBot> {
  const [perfil, acceso, historial, ultima] = await Promise.all([
    perfilDe(o.email),
    accesoDeEmail(o.email),
    leerConversacion(o.chat).catch((e) => (console.error("bot: leer charla", e), [])),
    ultimoDelChat(o.s, o.chat).catch(() => null),
  ]);
  const equipo = [...new Set([perfil.apodo, ...EQUIPO_APODOS])];
  const factura = ultima
    ? { item: ultima, anotar: async (texto: string) => void (await agregarNota(o.s, ultima.id, { tipo: "texto", texto, de: o.de, fecha: new Date().toISOString() })) }
    : null;
  const r = await conversar({
    ctx: { email: o.email, usuario: perfil.apodo, acceso, equipo, appUrl: o.appUrl, factura },
    contexto: contextoBot({ hoy: hoyBA(), nombre: perfil.nombre, usuario: perfil.apodo, equipo, appUrl: o.appUrl, factura: ultima ? resumen(ultima) : null }),
    historial,
    mensaje: o.texto,
  });
  await guardarConversacion(o.chat, o.email, [...historial, { rol: "user", texto: o.texto }, turnoBot(r.texto, r.acciones)]).catch((e) => console.error("bot: guardar charla", e));
  return r;
}
