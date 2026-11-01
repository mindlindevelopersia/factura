/**
 * Los mensajes que propone el CRM: una plantilla por etapa, completada con lo que se sabe del
 * contacto (nombre, unidades que le sirven, precio). Sirven sin IA; con IA (Oliver) se puede pedir
 * uno armado con todo el historial. Todo puro (sin red).
 */

import type { UnidadDisponible } from "./alarmas";
import type { Contacto } from "./modelo";

export interface MensajeSugerido {
  whatsapp: string;
  asunto: string;
  mail: string;
}

const usd = (n: number) => `US$ ${Math.round(n).toLocaleString("es-AR")}`;
const primerNombre = (n: string) => n.trim().split(/\s+/)[0] || n;

export function mensajeSugerido(c: Contacto, unidades: UnidadDisponible[], proyecto: string, firma: string): MensajeSugerido {
  const nombre = primerNombre(c.nombre);
  const u = unidades.find((x) => c.unidades.includes(x.codigo)) ?? unidades[0];
  const unidad = u ? `la ${u.codigo} (${u.tipologia.toLowerCase()}, ${u.m2.toLocaleString("es-AR", { maximumFractionDigits: 0 })} m², ${usd(u.precioUsd)})` : null;
  let cuerpo: string;
  let asunto: string;
  switch (c.etapa) {
    case "Nuevo":
    case "Contactado":
      asunto = `${proyecto}: te cuento cómo funciona`;
      cuerpo = `Hola ${nombre}, ¿cómo estás? Soy ${firma}, de Mindlin Developers. Te escribo por ${proyecto}, en Villa Crespo. Para recomendarte la unidad que mejor te sirva, ¿me contás qué estás buscando (ambientes), con qué presupuesto y para cuándo? Si te sirve, lo hablamos por teléfono en 10 minutos.`;
      break;
    case "Interesado":
      asunto = `${proyecto}: la unidad que te recomiendo`;
      cuerpo = unidad
        ? `Hola ${nombre}! Con lo que me contaste, la que mejor te sirve es ${unidad}. Es un desarrollo al costo: pagás un anticipo y el resto en cuotas en pesos ajustadas por CAC. ¿Te armo la propuesta con los números?`
        : `Hola ${nombre}! Te mando la información de ${proyecto}. Es un desarrollo al costo: pagás un anticipo y el resto en cuotas en pesos ajustadas por CAC. ¿Te armo una propuesta con los números?`;
      break;
    case "Evaluando":
      asunto = `${proyecto}: tu propuesta`;
      cuerpo = `Hola ${nombre}, ¿pudiste ver la propuesta${unidad ? ` de ${unidad}` : ""}? Te recuerdo que la lista de precios se actualiza y la propuesta vale por 7 días. Si tenés alguna duda con las cuotas o los refuerzos, lo vemos juntos.`;
      break;
    case "Negociando":
      asunto = `${proyecto}: cerramos`;
      cuerpo = `Hola ${nombre}! Ya tenemos casi todo. Si te parece, avanzamos con el boleto esta semana para mantenerte el precio. ¿Qué día te queda bien?`;
      break;
    case "Vendido":
      asunto = `${proyecto}: gracias por confiar`;
      cuerpo = `Hola ${nombre}! ¿Cómo va todo? Te escribo para agradecerte otra vez por sumarte a ${proyecto}. Si conocés a alguien que esté buscando invertir o comprar en pozo, me encantaría que me pases su contacto: quedan pocas unidades.`;
      break;
    case "Dormido":
    case "Perdido":
      asunto = `Novedades de ${proyecto}`;
      cuerpo = `Hola ${nombre}, ¿cómo va? Te escribo con novedades de ${proyecto}: la obra sigue avanzando y quedan pocas unidades${unidad ? `, entre ellas ${unidad}` : ""}. También estamos preparando un nuevo proyecto. ¿Querés que te cuente?`;
      break;
    default:
      asunto = `${proyecto}`;
      cuerpo = `Hola ${nombre}! ¿Cómo estás? Te escribo de Mindlin Developers.`;
  }
  return { whatsapp: cuerpo, asunto, mail: `${cuerpo}\n\nSaludos,\n${firma}\nMindlin Developers` };
}

/** El link para abrir WhatsApp con el mensaje escrito (null si el teléfono no sirve). */
export function linkWhatsapp(telefono: string, texto: string, normalizar: (t: string) => string | null): string | null {
  const n = normalizar(telefono);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : null;
}

/** Zoho Mail: se abre la bandeja y el mail queda copiado para pegar (no hay un link oficial verificado para escribirlo armado). */
export const ZOHO_MAIL = "https://mail.zoho.com/zm/";
