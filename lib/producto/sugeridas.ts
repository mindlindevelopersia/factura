/**
 * Ideas que propone el hub (armadas desde lo que ya sabe, por ejemplo las tarjetas de Marketing):
 * aparecen arriba del tablero hasta que alguien las publica o las descarta. Puro.
 */

import { IDEAS, type IdeaModulo } from "../marketing/ideas";
import { AREAS_EMPRESA } from "../modulos";
import { SEP_TAG } from "./tags";

export interface IdeaSugerida {
  /** Para recordar cuál se descartó (en el navegador). */
  clave: string;
  titulo: string;
  texto: string;
  tags: string[];
}

/** El orden en que conviene construir Marketing: primero medir, después lo que más rinde. */
const ORDEN_MARKETING = ["analitica", "blog", "seo", "pauta", "contenido"];

function textoMarketing(ideas: IdeaModulo[]): string {
  const orden = [...ideas].sort((a, b) => ORDEN_MARKETING.indexOf(a.sub) - ORDEN_MARKETING.indexOf(b.sub));
  const partes = [
    "El módulo de Marketing ya está en HQ con sus cinco partes en beta, cada una con su tarjeta de idea (/marketing). Falta construirlo, de menos a más. Orden sugerido: primero medir bien, después lo que más rinde.",
    "",
    "QUÉ FALTA, PARTE POR PARTE",
    ...orden.flatMap((i, n) => [
      "",
      `${n + 1}. ${i.nombre}: ${i.resumen}`,
      `   Primer paso: ${i.primerPaso}`,
      `   Después: ${i.etapas.map((e) => e.nombre.replace(/^\d+\.\s*/, "")).join(" → ")}.`,
      ...(i.agente ? [`   Agente: ${i.agente.nombre} (propone, no publica ni toca nada solo).`] : []),
    ]),
    "",
    "PARA DECIDIR",
    ...orden.flatMap((i) => i.decisiones.map((d) => `• ${i.nombre}: ${d}`)),
    "",
    "ACCESOS A PEDIR",
    "• Google Search Console y Google Analytics 4 de mindlindevelopers.com (sumar la cuenta de servicio del hub como lectora).",
    "• Unicorn Platform: confirmar si tiene API (si no, se lee el sitemap del blog).",
    "• Meta: la cuenta publicitaria, con una app de lectura (ads_read).",
    "• El sistema de atención al cliente donde caen los leads.",
  ];
  return partes.join("\n");
}

export const IDEAS_SUGERIDAS: IdeaSugerida[] = [
  {
    clave: "marketing-lo-que-falta",
    titulo: "Marketing: lo que falta",
    texto: textoMarketing(IDEAS),
    tags: ["Marketing", ...(AREAS_EMPRESA.find((a) => a.href === "/marketing")?.modulos ?? []).map((m) => `Marketing${SEP_TAG}${m.nombre}`)],
  },
];
