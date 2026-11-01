/**
 * Lo que hace falta para abrir un proyecto nuevo en el hub (como Lerma 439). Se muestra en la página
 * de los proyectos en preparación, con lo que ya está (Proyecto.altaLista en lib/modulos.ts).
 * Ver docs/alta-de-proyecto.md.
 */

export type TipoItem = "dato" | "planilla" | "archivo" | "decision";

export interface ItemAlta {
  id: string;
  titulo: string;
  detalle: string;
  tipo: TipoItem;
}

export const NOMBRE_TIPO: Record<TipoItem, string> = { dato: "Dato", planilla: "Planilla", archivo: "Archivos", decision: "Decisión" };

export const CHECKLIST_ALTA: { grupo: string; items: ItemAlta[] }[] = [
  {
    grupo: "El proyecto",
    items: [
      { id: "nombre", tipo: "dato", titulo: "Nombre, dirección y nombre comercial", detalle: "Ej.: Lerma 439, Villa Crespo, \"Palermo Queens\"." },
      { id: "vehiculo", tipo: "dato", titulo: "Vehículo", detalle: "Sociedad o fideicomiso, CUIT, y si tiene contabilidad y caja propias." },
      { id: "unidades", tipo: "dato", titulo: "Unidades, cocheras y pisos", detalle: "Cuántas hay y cómo se nombran (1A, PB, C1…)." },
      { id: "fechas", tipo: "dato", titulo: "Inicio de obra y entrega estimada", detalle: "La entrega define hasta cuándo van las cuotas en las propuestas." },
      { id: "accesos", tipo: "decision", titulo: "Quiénes lo ven", detalle: "Los mails que entran al hub para este proyecto." },
    ],
  },
  {
    grupo: "Planillas (compartidas con la cuenta de servicio)",
    items: [
      { id: "madre", tipo: "planilla", titulo: "Excel madre", detalle: "Lista de precios, Superficies, Ventas (con la ficha de cada operación), EE.RR y CRM, con las mismas columnas que Lerma. Como Lector." },
      { id: "flujo", tipo: "planilla", titulo: "Flujo de fondos por inversor", detalle: "Cobrado y a cobrar por mes, con los colores (verde, rosa, amarillo) y el mes base CAC." },
      { id: "pagos", tipo: "planilla", titulo: "Pagos por Inversor", detalle: "Un bloque por inversor con su costo estimado (en dólares y pesos), formal e informal y cada pago." },
      { id: "cajas", tipo: "planilla", titulo: "Cajas en pesos y en dólares", detalle: "Los egresos con fecha, descripción, rubro, a qué corresponde (proyecto o HQ), blanco o negro." },
      { id: "contable", tipo: "planilla", titulo: "Planilla contable y de facturas", detalle: "Si es otra que la de Lerma: dónde se cargan las facturas (como Editor)." },
    ],
  },
  {
    grupo: "Comercial",
    items: [
      { id: "precio", tipo: "decision", titulo: "Precio vigente y cómo sube", detalle: "US$/m², aumento por piso u orientación, y qué manda el estado de cada unidad." },
      { id: "superficies", tipo: "decision", titulo: "Cómo se cuentan las superficies", detalle: "Terrazas y patios (a qué porcentaje), amenities y quién los paga." },
      { id: "cocheras", tipo: "dato", titulo: "Cocheras", detalle: "Precio y si se venden solas o con una unidad." },
      { id: "esquema", tipo: "decision", titulo: "Esquema de pago de las propuestas", detalle: "Parte A y B (%), anticipos, cantidad de cuotas, refuerzos y vigencia." },
    ],
  },
  {
    grupo: "Material de venta (para las propuestas)",
    items: [
      { id: "logos", tipo: "archivo", titulo: "Logos del proyecto", detalle: "PNG con fondo transparente, versión oscura y clara." },
      { id: "renders", tipo: "archivo", titulo: "Renders", detalle: "Interior, exterior y amenities, en buena resolución (JPG)." },
      { id: "planos", tipo: "archivo", titulo: "Planos de cada tipología", detalle: "Uno por tipo de unidad (PNG), diciendo a qué unidades corresponde; y los de pisos especiales." },
      { id: "planta", tipo: "archivo", titulo: "Planta tipo", detalle: "La planta completa de un piso." },
      { id: "notas", tipo: "dato", titulo: "Textos de la propuesta", detalle: "Las notas legales y lo que tiene que decir sobre el modelo de pago." },
    ],
  },
  {
    grupo: "Inversores y cobranzas",
    items: [
      { id: "cuotas", tipo: "decision", titulo: "Cuotas, anticipos y refuerzos", detalle: "Qué día vencen y si hay excepciones (en Lerma: el 10; un inversor el 20)." },
      { id: "cac", tipo: "decision", titulo: "Ajuste por CAC", detalle: "Si se ajusta, desde qué mes base y con qué desfasaje (en Lerma: el índice del mes anterior)." },
      { id: "mensajes", tipo: "decision", titulo: "Formal e informal y avisos", detalle: "Qué va en los mensajes a los inversores y quién los firma." },
    ],
  },
  {
    grupo: "Management",
    items: [
      { id: "desarrolladores", tipo: "decision", titulo: "Qué cobra Mindlin", detalle: "m² (qué porcentaje y sobre qué superficie), honorarios, fee de compra del lote u otros." },
      { id: "socios", tipo: "decision", titulo: "Reparto entre socios", detalle: "En Lerma: 50 / 25 / 25." },
      { id: "hq", tipo: "decision", titulo: "Gastos de HQ", detalle: "Si se pagan gastos de la oficina con plata del proyecto y cómo se devuelven." },
    ],
  },
  {
    grupo: "CRM",
    items: [
      { id: "interesados", tipo: "planilla", titulo: "Base de interesados", detalle: "La planilla de contactos para importar (se sacan los duplicados con la base de la empresa)." },
      { id: "responsables", tipo: "decision", titulo: "Responsables", detalle: "Quién atiende los contactos y desde qué mail y WhatsApp se escribe." },
    ],
  },
];

export const TOTAL_ALTA = CHECKLIST_ALTA.reduce((s, g) => s + g.items.length, 0);
