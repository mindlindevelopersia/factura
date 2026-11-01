/**
 * Marketing (HQ): la idea de cada submódulo, para arrancar. Todos están en beta: cada página
 * muestra su "tarjeta de idea" (para qué es, qué va a tener por etapas, con qué se integra, qué
 * hay que decidir y el primer paso concreto) hasta que se construya. Es el punto de partida para
 * Tadeo: cuando un submódulo se arma, su tarjeta pasa a ser la documentación.
 */

export interface IdeaModulo {
  sub: string;
  nombre: string;
  resumen: string;
  /** Para qué sirve, en una o dos frases. */
  objetivo: string;
  etapas: { nombre: string; items: string[] }[];
  integraciones: { nombre: string; para: string; nota?: string }[];
  /** Un agente (Claude) que trabaje en el submódulo, si tiene. */
  agente?: { nombre: string; hace: string[]; limites: string[] };
  decisiones: string[];
  primerPaso: string;
}

export const IDEA_MARKETING = {
  resumen:
    "Toda la gestión de marketing desde el hub: qué buscar (SEO), qué escribir (blog), qué pautar (Meta Ads) y qué publicar (redes), con los resultados a la vista para decidir rápido. Se ordena por lo que hacemos (no por inbound/outbound) y arranca de menos a más.",
  principios: [
    "Medir primero: sin Google Analytics y Search Console bien configurados, el resto no se puede evaluar (ver Analítica).",
    "Todo vinculado: la keyword → el artículo → la visita → el lead del CRM; la campaña → el lead → la venta.",
    "Los agentes proponen, una persona decide: nada se publica ni se cambia en una campaña sin aprobación.",
    "Sin inventar: los agentes trabajan con datos reales (keywords, artículos, métricas) y lo dicen cuando no los tienen.",
  ],
};

export const IDEAS: IdeaModulo[] = [
  {
    sub: "seo",
    nombre: "SEO y keywords",
    resumen: "Qué busca la gente, por qué palabras nos encuentran y qué mejorar del sitio.",
    objetivo: "Tener una lista viva de keywords priorizadas (las que ya traen visitas y las que conviene atacar) que alimenta al redactor del blog, y un control de la salud del sitio.",
    etapas: [
      {
        nombre: "1. Lo que ya pasa",
        items: [
          "Conectar Google Search Console: las búsquedas reales por las que aparece mindlindevelopers.com (impresiones, clics, posición), por página y por país.",
          "Lista de keywords con estado: Usando · Para atacar · Descartada; con el artículo que la trabaja.",
          "Oportunidades automáticas: búsquedas con muchas impresiones y pocos clics, o en posición 8–20 (cerca de la primera página).",
        ],
      },
      {
        nombre: "2. Buscar nuevas",
        items: [
          "Google Trends para estacionalidad y comparar temas (\"comprar en pozo\", \"inversión inmobiliaria\", barrios).",
          "Volúmenes de búsqueda: Keyword Planner de Google Ads (gratis con una cuenta de Ads) o un servicio pago (DataForSEO, Semrush) si hace falta más detalle.",
          "Agrupar por intención (inversión, vivienda, barrio, financiación, extranjeros) y por idioma.",
        ],
      },
      {
        nombre: "3. Salud del sitio",
        items: [
          "PageSpeed Insights (velocidad en celular y compu) y Core Web Vitals por página.",
          "Títulos y descripciones que faltan o se repiten, páginas que Google no indexa (Search Console).",
          "Un checklist de optimización por página, con avisos.",
        ],
      },
    ],
    integraciones: [
      { nombre: "Google Search Console", para: "las búsquedas reales, impresiones, clics y posición", nota: "Gratis. Hay que agregar la cuenta de servicio del hub como usuario de la propiedad." },
      { nombre: "Google Trends", para: "tendencias y estacionalidad", nota: "No tiene API oficial estable: arrancar a mano o con un servicio." },
      { nombre: "Google Ads · Keyword Planner", para: "volumen de búsqueda estimado", nota: "Requiere una cuenta de Google Ads (no hace falta gastar)." },
      { nombre: "PageSpeed Insights", para: "velocidad y Core Web Vitals", nota: "API gratuita." },
    ],
    decisiones: ["¿Mercados e idiomas objetivo? (Argentina, latinos en el exterior, rusos…)", "¿Pagamos una herramienta de keywords o arrancamos con Search Console + Trends + Keyword Planner?"],
    primerPaso: "Dar acceso a Search Console de mindlindevelopers.com a la cuenta de servicio del hub y traer las búsquedas de los últimos 16 meses.",
  },
  {
    sub: "blog",
    nombre: "Blog",
    resumen: "El tablero de los artículos (cuántos, de qué, cuáles funcionan) y el redactor que escribe los nuevos.",
    objetivo: "Saber qué hay publicado y qué rinde, y producir artículos de real estate con las keywords elegidas, en el idioma que haga falta, sin repetir lo que ya está.",
    etapas: [
      {
        nombre: "1. Tablero",
        items: [
          "El listado de todos los artículos publicados en mindlindevelopers.com/blog: título, fecha, idioma, tema, keyword principal.",
          "Cuántos hay por tema, idioma y mes; huecos (temas o barrios sin artículo).",
          "Rendimiento por artículo: visitas, tiempo de lectura, de dónde llegan (Analytics) y por qué búsquedas (Search Console); los que más funcionan y los que no.",
          "Leads que llegaron desde cada artículo (con UTM o la página de entrada, cruzado con el CRM).",
        ],
      },
      {
        nombre: "2. Redactor",
        items: [
          "Elegís una o varias keywords (del submódulo SEO), el público y el idioma (castellano, inglés, ruso…); propone un índice y después el artículo.",
          "Antes de escribir, revisa los artículos existentes para no repetir: si el tema ya está, propone actualizar el viejo o un ángulo distinto.",
          "Sale con título SEO, meta descripción, URL sugerida, estructura de títulos, links internos a otros artículos y a los proyectos, y llamado a la acción.",
          "Borrador → revisión → aprobado → publicado, con quién lo aprobó.",
        ],
      },
      {
        nombre: "3. Publicar y actualizar",
        items: [
          "Publicar desde el hub si Unicorn Platform lo permite (API); si no, copiar con el formato listo para pegar.",
          "Avisos de artículos viejos que pierden visitas: el redactor propone la actualización.",
        ],
      },
    ],
    integraciones: [
      { nombre: "Unicorn Platform", para: "la lista de artículos y, si se puede, publicar", nota: "A confirmar si tiene API. Plan B confiable: leer el sitemap (mindlindevelopers.com/sitemap.xml) o el RSS del blog para listar los artículos y su contenido." },
      { nombre: "Google Analytics 4", para: "visitas y comportamiento por artículo", nota: "Data API de GA4 con la cuenta de servicio (ver Analítica)." },
      { nombre: "Google Search Console", para: "saber por qué búsquedas llega cada artículo" },
      { nombre: "CRM del hub", para: "los leads que vienen de cada artículo" },
    ],
    agente: {
      nombre: "Redactor de real estate",
      hace: [
        "Escribe artículos de real estate (inversión, compra en pozo, barrios, financiación, CAC, dólar, extranjeros) en castellano, inglés, ruso u otro idioma.",
        "Usa las keywords del submódulo SEO de forma natural, con estructura pensada para Google.",
        "Compara con el blog existente para no repetir temas y sugiere links internos.",
        "Usa datos del hub cuando sirven (CAC, dólar, avance de obra) citando la fuente.",
      ],
      limites: ["No publica solo: siempre pasa por revisión.", "No inventa datos, precios ni promesas de rentabilidad: si no tiene el dato, lo marca para completar."],
    },
    decisiones: ["¿Unicorn Platform tiene API? Si no, ¿alcanza con el sitemap para leer y copiar-pegar para publicar?", "¿Cuántos artículos por mes y en qué idiomas?", "¿Quién aprueba antes de publicar?"],
    primerPaso: "Leer el sitemap del blog para cargar todos los artículos publicados en el tablero (título, URL, fecha, idioma) y clasificarlos por tema.",
  },
  {
    sub: "pauta",
    nombre: "Pauta (paid)",
    resumen: "El monitor de las campañas que corren: cuánto se gasta, qué rinde y qué cambiar.",
    objetivo: "Ver en un solo lugar qué campañas y contenidos están corriendo, cuánto cuestan y cuántos leads (y ventas) traen, para decidir rápido si la pauta viene bien o mal.",
    etapas: [
      {
        nombre: "1. Monitor",
        items: [
          "Campañas, conjuntos y anuncios de Meta Ads (Facebook e Instagram): estado, presupuesto, gasto, alcance, frecuencia, CTR, costo por lead.",
          "Cada anuncio con su creativo (Reel, imagen, carrusel) y el link a la carpeta de Drive donde está el original.",
          "Gasto por mes y por proyecto; alertas (gasto sin leads, frecuencia alta, costo por lead que se dispara).",
        ],
      },
      {
        nombre: "2. Del anuncio a la venta",
        items: [
          "Los leads que entran por la campaña llegan al CRM con su origen (campaña, anuncio) para saber cuáles terminan en propuesta o venta.",
          "Vincular con el sistema de atención al cliente donde caen hoy los leads de las campañas.",
          "Costo por lead calificado y por venta, no solo por lead.",
        ],
      },
      {
        nombre: "3. Optimizador",
        items: ["Un agente que lee los resultados y recomienda qué pausar, qué escalar y qué contenidos hacer.", "Más adelante, Google Ads con el mismo tablero."],
      },
    ],
    integraciones: [
      { nombre: "Meta Marketing API", para: "campañas, gasto, métricas y creativos", nota: "Hace falta una app de Meta con acceso de lectura (ads_read) a la cuenta publicitaria." },
      { nombre: "Google Drive", para: "los creativos originales (link por anuncio)" },
      { nombre: "CRM del hub", para: "los leads de cada campaña y en qué terminan" },
      { nombre: "Sistema de atención al cliente", para: "seguir los leads donde caen hoy", nota: "A definir cuál es y si tiene API." },
    ],
    agente: {
      nombre: "Optimizador de pauta",
      hace: [
        "Lee las métricas de cada campaña y anuncio, compara contra el histórico y contra los leads del CRM.",
        "Recomienda: pausar, escalar, cambiar audiencia o renovar el creativo, con el porqué y los números.",
        "Propone ideas de contenido según lo que mejor funcionó (formato, mensaje, proyecto).",
      ],
      limites: [
        "No toca las campañas: recomienda y una persona decide.",
        "No mira los videos: trabaja con métricas, textos y miniaturas (si se quiere que \"vea\" un Reel, se le pasa la transcripción o capturas).",
      ],
    },
    decisiones: ["¿Qué cuenta publicitaria de Meta y quién da el acceso?", "¿Cuál es el sistema de atención al cliente donde caen los leads?", "¿Vamos a pautar en Google también?"],
    primerPaso: "Crear la app de Meta con permiso de lectura de la cuenta publicitaria y traer las campañas de los últimos 6 meses con su gasto y leads.",
  },
  {
    sub: "contenido",
    nombre: "Contenido para redes",
    resumen: "Propuestas constantes de qué publicar y el calendario de lo que se hace.",
    objetivo: "No quedarse nunca sin ideas: un calendario editorial con propuestas que salen de lo que pasa (obra, ventas, blog, indicadores) y de lo que mejor funciona.",
    etapas: [
      {
        nombre: "1. Calendario",
        items: ["Cada pieza con estado: idea → guion → producción → publicada; red (Instagram, LinkedIn, TikTok, YouTube), formato y fecha.", "El link a la carpeta de Drive del material y quién se ocupa (aparece en el Calendario y en Tareas)."],
      },
      {
        nombre: "2. Propuestas",
        items: [
          "Un agente que propone contenidos cada semana: avance de obra, unidades disponibles, un artículo del blog convertido en Reel o carrusel, el CAC del mes, testimonios.",
          "Guion, texto del posteo y hashtags listos para revisar.",
        ],
      },
      {
        nombre: "3. Qué funciona",
        items: ["Métricas de cada publicación (Instagram/Facebook con la Graph API de Meta) para que las próximas propuestas aprendan de las mejores."],
      },
    ],
    integraciones: [
      { nombre: "Meta Graph API", para: "publicaciones e insights de Instagram y Facebook" },
      { nombre: "Google Drive", para: "el material de cada pieza" },
      { nombre: "Blog, obra e indicadores del hub", para: "sacar las ideas de lo que pasa" },
    ],
    agente: {
      nombre: "Generador de contenido",
      hace: ["Propone ideas, guiones y textos para redes a partir de lo que pasa en los proyectos y en el blog.", "Adapta un mismo tema a cada red y formato."],
      limites: ["No publica: propone y alguien aprueba.", "No inventa avances ni precios: usa los datos del hub."],
    },
    decisiones: ["¿Qué redes y con qué frecuencia?", "¿Quién produce (interno, agencia)?"],
    primerPaso: "Armar el calendario editorial en el hub (piezas con estado, red, fecha, responsable y link a Drive) y que el agente proponga las de la próxima semana.",
  },
  {
    sub: "analitica",
    nombre: "Analítica",
    resumen: "Que Google Analytics y Search Console midan bien: la base de todo lo demás.",
    objetivo: "Medir bien el sitio para poder decidir: visitas, de dónde vienen, qué leen y, sobre todo, cuántos contactos genera cada canal.",
    etapas: [
      {
        nombre: "1. Configurar bien",
        items: [
          "Revisar la instalación de GA4 en Unicorn Platform (el código de medición en todas las páginas, sin duplicados).",
          "Eventos de conversión: formulario enviado, click en WhatsApp, click en mail y en teléfono.",
          "UTMs estándar para redes, pauta y mails, para saber de dónde viene cada lead.",
          "Vincular GA4 con Search Console y con Google Ads.",
        ],
      },
      {
        nombre: "2. Tablero",
        items: ["Visitas, usuarios y conversiones por canal, página e idioma, mes contra mes.", "Embudo: visita → contacto → lead en el CRM → propuesta → venta."],
      },
    ],
    integraciones: [
      { nombre: "Google Analytics 4 (Data API)", para: "las métricas del sitio", nota: "Agregar la cuenta de servicio del hub como lectora de la propiedad de GA4." },
      { nombre: "Google Search Console", para: "el lado de las búsquedas" },
      { nombre: "CRM del hub", para: "cerrar el círculo hasta la venta" },
    ],
    decisiones: ["¿Quién tiene hoy el acceso de administrador a GA4 y a Unicorn Platform?", "¿Qué cuenta como conversión (formulario, WhatsApp, ambos)?"],
    primerPaso: "Auditar GA4 en mindlindevelopers.com (si el código está, si se duplica, qué eventos mide) y dejar los eventos de conversión y las UTMs definidos.",
  },
];
