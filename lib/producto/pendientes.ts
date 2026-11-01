/**
 * Lo que quedó pendiente en el hub, para cargarlo como features (cada uno con qué falta y el
 * primer paso). Aparecen en Producto · Features hasta que se cargan o se descartan. Puro.
 */

import type { Prioridad } from "../tareas/modelo";

export interface FeaturePendiente {
  titulo: string;
  descripcion: string;
  prioridad: Prioridad;
}

/** De quién son, de entrada (se puede cambiar en la ficha). */
export const RESPONSABLE_PENDIENTES = "Tade";

const texto = (o: { falta: string; decide?: string; paso: string }) =>
  [`Qué falta: ${o.falta}`, o.decide ? `Para decidir: ${o.decide}` : "", `Primer paso: ${o.paso}`].filter(Boolean).join("\n\n");

export const PENDIENTES: FeaturePendiente[] = [
  // ——— Oliver en Telegram ———
  {
    titulo: "Oliver en Telegram: probarlo con el equipo",
    prioridad: "Alta",
    descripcion: texto({
      falta: "Confirmar que el bot responde bien después de las últimas correcciones (el error de los esquemas). Si falla, a Mati le muestra una línea con el detalle técnico.",
      paso: "Cada uno conecta su Telegram (web de facturas → Subir → Conectar mi Telegram) y prueba: una tarea, una idea, un lead y \"¿qué tengo para esta semana?\". Anotar acá lo que no entienda bien.",
    }),
  },
  {
    titulo: "Oliver en Telegram: caja y egresos",
    prioridad: "Alta",
    descripcion: texto({
      falta: "Que se le pueda contar un movimiento de plata (\"saqué 500 mil del banco, bajalo de la caja de obra\") y lo cargue, preguntando de qué caja, el concepto y el proyecto. Hoy el hub lee las planillas contables pero no escribe en ellas.",
      decide: "¿Dónde se anotan los movimientos que carga el bot? (una pestaña nueva del hub para que Tadeo los pase a la contable, o escribir directo en la planilla de caja). ¿Quién puede cargarlos? (solo los que ven Finanzas).",
      paso: "Definir con Mati el circuito de caja y armar la herramienta \"registrar_movimiento\" con permiso de Finanzas.",
    }),
  },
  {
    titulo: "Oliver en Telegram: cobranzas",
    prioridad: "Normal",
    descripcion: texto({
      falta: "Preguntarle \"¿quién debe cuotas?\" o \"¿cuánto debe la 2C?\" y avisar \"Juan pagó la cuota de noviembre\". Hoy las cuentas corrientes y cobranzas solo se ven en la web.",
      paso: "Sumar herramientas de solo lectura (vencidos, saldo de una unidad) con el permiso de Inversores; el registro de pagos, después de definir el circuito de caja.",
    }),
  },
  {
    titulo: "Oliver en Telegram: entender audios",
    prioridad: "Normal",
    descripcion: texto({
      falta: "Hoy los audios se guardan como nota de la última factura. Para que los entienda hay que pasarlos a texto con un servicio de transcripción.",
      decide: "Qué servicio: Google Speech-to-Text (recomendado: usa la cuenta de servicio, ~US$ 0,016 por minuto) u OpenAI Whisper (otra cuenta y otra clave).",
      paso: "Si es Google: activar la API de Speech-to-Text en el proyecto de Google Cloud de la cuenta de servicio. Después se conecta al bot.",
    }),
  },
  {
    titulo: "Oliver en Telegram: eventos del calendario",
    prioridad: "Normal",
    descripcion: texto({
      falta: "Cargar eventos sueltos de la agenda (\"el jueves a las 10 reunión con la constructora\"). Hoy solo aparecen en el calendario las tareas con fecha.",
      paso: "Sumar la herramienta \"crear_evento\" usando la agenda del Calendario del proyecto.",
    }),
  },
  // ——— Marketing ———
  {
    titulo: "Marketing · Analítica: auditar Google Analytics",
    prioridad: "Alta",
    descripcion: texto({
      falta: "Saber si GA4 está bien instalado en mindlindevelopers.com (en Unicorn Platform) y medir los contactos: formulario, WhatsApp, mail y teléfono. Sin esto no se puede evaluar nada del resto.",
      decide: "¿Quién tiene hoy acceso de administrador a GA4 y a Unicorn Platform? ¿Qué cuenta como conversión?",
      paso: "Auditar GA4 (código instalado, duplicados, eventos) y definir los eventos de conversión y las UTMs. Ver la tarjeta en HQ → Marketing → Analítica.",
    }),
  },
  {
    titulo: "Marketing · Blog: tablero de artículos",
    prioridad: "Alta",
    descripcion: texto({
      falta: "El listado de los artículos publicados (título, fecha, idioma, tema) y después el redactor de real estate que escribe sin repetir temas.",
      decide: "¿Unicorn Platform tiene API? Si no, se leen los artículos desde el sitemap y se publica copiando y pegando.",
      paso: "Leer el sitemap del blog y cargar los artículos en el tablero. Ver HQ → Marketing → Blog.",
    }),
  },
  {
    titulo: "Marketing · SEO: conectar Search Console",
    prioridad: "Normal",
    descripcion: texto({
      falta: "Las búsquedas reales por las que aparece el sitio (impresiones, clics, posición) para armar la lista de keywords.",
      decide: "Mercados e idiomas objetivo. ¿Se paga una herramienta de keywords o se arranca con Search Console + Trends + Keyword Planner?",
      paso: "Agregar la cuenta de servicio del hub como usuario de la propiedad de Search Console de mindlindevelopers.com.",
    }),
  },
  {
    titulo: "Marketing · Pauta: monitor de Meta Ads",
    prioridad: "Normal",
    descripcion: texto({
      falta: "Ver campañas, gasto y leads de Meta Ads en el hub, con el link a Drive de cada creativo, y después el optimizador que recomienda.",
      decide: "¿Qué cuenta publicitaria y quién da el acceso? ¿Cuál es el sistema de atención al cliente donde caen los leads?",
      paso: "Crear una app de Meta con permiso de lectura (ads_read) de la cuenta publicitaria y cargar el token en Vercel.",
    }),
  },
  {
    titulo: "Marketing · Contenido: calendario editorial",
    prioridad: "Normal",
    descripcion: texto({
      falta: "Un calendario de piezas para redes (idea → guion → producción → publicada) y un agente que proponga contenidos cada semana.",
      decide: "¿Qué redes y con qué frecuencia? ¿Quién produce (interno o agencia)?",
      paso: "Armar el calendario editorial en el hub. Ver HQ → Marketing → Contenido.",
    }),
  },
  // ——— Prefactibilidad ———
  {
    titulo: "Prefactibilidad: reglas de La Plata",
    prioridad: "Normal",
    descripcion: texto({
      falta: "El cálculo para lotes en La Plata (FOS, FOT, densidad y lo que cambia respecto de CABA). Hoy el municipio se elige pero las cuentas son las de CABA.",
      paso: "Que Mati pase el Excel de prefactibilidad de La Plata para tomar las reglas de ahí.",
    }),
  },
  {
    titulo: "Prefactibilidad: pestaña de estado de resultados",
    prioridad: "Normal",
    descripcion: texto({
      falta: "El estado de resultados del lote dentro de la prefactibilidad (ventas, costos, plusvalía, resultado), para dejar de usar el Excel para eso.",
      paso: "Tomar la estructura de la pestaña EERR del Excel madre y armarla con fórmulas a la vista (\"fx\") y exportación a Excel.",
    }),
  },
  {
    titulo: "Prefactibilidad: cargar el FOS de Lerma",
    prioridad: "Normal",
    descripcion: texto({
      falta: "La prefactibilidad de Lerma avisa que falta el FOS del distrito, así que no controla la ocupación en planta.",
      paso: "Cargar el FOS del distrito en la prefactibilidad de Lerma 439.",
    }),
  },
  // ——— Hub en general ———
  {
    titulo: "Notas en los números de los demás módulos",
    prioridad: "Normal",
    descripcion: texto({
      falta: "Las notas con @ sobre un número (como en Prefactibilidad y Cash flow) en el resto: cuentas corrientes, cobranzas, egresos, lista de precios.",
      paso: "Elegir los dos o tres números donde más se discute y sumarles la nota.",
    }),
  },
  {
    titulo: "Calendario del hub en la Mac y el celular",
    prioridad: "Normal",
    descripcion: texto({
      falta: "Ver el calendario del hub (vencimientos, cobros, tareas) en el calendario de la Mac y del celular.",
      decide: "Mati: sincronizar con Google Calendar (recomendado) o un link secreto de suscripción (iCal). El link secreto es menos seguro: cualquiera que lo tenga ve el calendario.",
      paso: "Una vez decidido, armar la sincronización.",
    }),
  },
  {
    titulo: "Mails de notificaciones (resumen diario y avisos)",
    prioridad: "Normal",
    descripcion: texto({
      falta: "Que las notificaciones de la campanita lleguen también por mail, con un resumen diario y un tope por día. Quedó en espera por decisión de Mati.",
      paso: "Cuando se retome: elegir el servicio de envío de mails y armar las preferencias por persona.",
    }),
  },
  {
    titulo: "Guía de Oliver para el equipo",
    prioridad: "Normal",
    descripcion: texto({
      falta: "Una página con todo lo que se le puede pedir al bot de Telegram, para Eliana y Tadeo.",
      paso: "Armarla a partir de docs/bot-telegram.md y sumarla a la ayuda del hub.",
    }),
  },
  // ——— Carga de datos ———
  {
    titulo: "Lerma: subir los planos de las unidades",
    prioridad: "Normal",
    descripcion: texto({
      falta: "Los planos de los dos ambientes, los monoambientes y la del 9A, para que salgan en las propuestas y en Unidades.",
      paso: "Subirlos al repo en privado/proyectos/lerma-439/ con los nombres acordados (frente / contrafrente).",
    }),
  },
  {
    titulo: "CRM: importar el CRM madre y la base de inversores",
    prioridad: "Normal",
    descripcion: texto({
      falta: "Los contactos del Excel madre y la base de inversores todavía no están cargados en el CRM del hub.",
      paso: "Usar Importar planilla en CRM → Base de datos y revisar los duplicados que marque.",
    }),
  },
  {
    titulo: "Accesos: sumar a Eliana (y revisar a Tadeo)",
    prioridad: "Alta",
    descripcion: texto({
      falta: "El mail de Eliana en ALLOWED_EMAILS (Vercel) y en el equipo del hub, con su rol (Arquitectura) en Ajustes. Revisar que Tadeo tenga el rol y los permisos correctos.",
      paso: "Agregar el mail en Vercel, después configurarla en Ajustes → Usuarios. La primera vez que entre, activa la verificación en dos pasos.",
    }),
  },
  // ——— Lo de siempre (lista inicial) ———
  {
    titulo: "Mejorar todos los módulos de administración",
    prioridad: "Normal",
    descripcion: texto({ falta: "Revisar facturas, comprobantes y egresos: qué se usa, qué molesta y qué falta.", paso: "Hacer una lista de mejoras con quien carga las facturas y priorizarla." }),
  },
  {
    titulo: "Automatizar los procesos que le pasamos a Axel",
    prioridad: "Normal",
    descripcion: texto({ falta: "Los procesos que hoy se le pasan al contador a mano.", paso: "Listar qué se le manda, cada cuánto y en qué formato, para ver qué puede salir solo del hub." }),
  },
  {
    titulo: "Presupuesto base 0",
    prioridad: "Normal",
    descripcion: texto({ falta: "Armar el presupuesto de obra desde cero, rubro por rubro, para comparar contra lo real.", paso: "Definir los rubros y de dónde sale cada costo." }),
  },
  {
    titulo: "Módulo de compras y presupuestos",
    prioridad: "Normal",
    descripcion: texto({ falta: "Pedir presupuestos a proveedores desde el hub y compararlos.", paso: "Definir el circuito: quién pide, cómo se comparan y quién aprueba." }),
  },
];

const clave = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Los que todavía no están en el tablero (por el título, sin importar mayúsculas ni tildes). */
export const pendientesSinCargar = (titulos: string[]) => {
  const ya = new Set(titulos.map(clave));
  return PENDIENTES.filter((p) => !ya.has(clave(p.titulo)));
};
