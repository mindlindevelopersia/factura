/**
 * Los rubros del presupuesto de obra (base 0): la plantilla con la que arranca cada proyecto.
 * Sale de los rubros del sistema que mostró Mati (costo hard y soft) más el terreno y los
 * impuestos del cash flow del Excel madre. Cada ítem dice:
 * - `claves`: palabras de la descripción de un pago de la caja que lo asignan a ese ítem;
 * - `rubrosCaja`: los rubros de la caja que van a ese ítem si ninguna palabra coincide;
 * - `delExcel`: las líneas del cash flow del Excel madre de las que sale su monto inicial.
 * Puro.
 */

export const GRUPOS_PRESUPUESTO = [
  { id: "terreno", nombre: "Terreno", detalle: "compra y gastos de la operación" },
  { id: "hard", nombre: "Costo hard", detalle: "construcción física" },
  { id: "soft", nombre: "Costo soft", detalle: "honorarios, derechos, proyecto e imprevistos" },
  { id: "impuestos", nombre: "Impuestos y gastos", detalle: "IVA, ingresos brutos, bancos y escribanos" },
] as const;
export type GrupoPresupuesto = (typeof GRUPOS_PRESUPUESTO)[number]["id"];

export interface RubroBase {
  id: string;
  nombre: string;
  grupo: GrupoPresupuesto;
  claves?: RegExp;
  rubrosCaja?: string[];
  delExcel?: string[];
}

export const RUBROS_BASE: RubroBase[] = [
  // ——— Terreno ———
  { id: "terreno", nombre: "Valor del terreno", grupo: "terreno", claves: /compra (de )?lote|terreno/, rubrosCaja: ["terreno"], delExcel: ["Valor del terreno"] },
  { id: "comision-terreno", nombre: "Comisión inmobiliaria", grupo: "terreno", claves: /comision inmob/, delExcel: ["Comisión inmobiliaria"] },
  { id: "escritura", nombre: "Escritura y transferencia", grupo: "terreno", claves: /escritura|transf\w* de dominio/, delExcel: ["Transfr. de Dominio (Escritura)"] },
  // ——— Hard ———
  { id: "demolicion", nombre: "Demolición", grupo: "hard", claves: /demoli/, delExcel: ["Costo Demolición"] },
  { id: "preliminares", nombre: "Trabajos preliminares", grupo: "hard", claves: /preliminar|obrador|cerco|vallado|infraestructura previa/, delExcel: ["Infraestructura previa"] },
  { id: "movimiento-suelo", nombre: "Movimiento de suelo", grupo: "hard", claves: /movimiento de suelo|excavac|tosca|submuraci/, delExcel: ["Movimientos de suelos"] },
  { id: "estructura", nombre: "Estructura", grupo: "hard", claves: /estructura|hormig|herpaco|hierro|encofr/, rubrosCaja: ["hormigon", "hierro"], delExcel: ["Estructura Mano de Obra", "Estructura Materiales"] },
  { id: "aislaciones", nombre: "Aislaciones", grupo: "hard", claves: /aislac|impermeab|membrana/ },
  { id: "mamposteria", nombre: "Mampostería", grupo: "hard", claves: /mamposter|albanil|ladrill|bloque/, delExcel: ["Albañilería"] },
  { id: "contrapisos", nombre: "Contrapisos y carpetas", grupo: "hard", claves: /contrapiso|carpeta/ },
  { id: "revoques", nombre: "Revoques", grupo: "hard", claves: /revoque/ },
  { id: "yeseria", nombre: "Yesería", grupo: "hard", claves: /yeser|\byeso\b|enlucido/, delExcel: ["Yesería"] },
  { id: "durlock", nombre: "Durlock", grupo: "hard", claves: /durlock|placa de yeso|steel ?frame/ },
  { id: "pisos", nombre: "Pisos", grupo: "hard", claves: /\bpisos?\b|porcelanat|ceramic/, delExcel: ["Colocación de Pisos y Revestimientos"] },
  { id: "revestimientos", nombre: "Revestimientos", grupo: "hard", claves: /revestim|azulej/ },
  { id: "pintura", nombre: "Pintura", grupo: "hard", claves: /pintur/, delExcel: ["Pintura"] },
  { id: "zocalos", nombre: "Zócalos", grupo: "hard", claves: /zocalo/ },
  { id: "electricidad", nombre: "Electricidad", grupo: "hard", claves: /electric|transformador|tablero|cableado/, rubrosCaja: ["electricidad"], delExcel: ["Instalación eléctrica", "Mano de Obra Instalación Eléctrica"] },
  { id: "sanitaria", nombre: "Instalación sanitaria y gas", grupo: "hard", claves: /sanitari|plomer|\bgas\b|cloaca|agua corriente/, delExcel: ["Instalación Sanitaria", "Mano de Obra Instalación Sanitaria", "Instalación de gas"] },
  { id: "calefaccion", nombre: "Calefacción", grupo: "hard", claves: /calefacc|radiador|losa radiante|caldera/ },
  { id: "ascensor", nombre: "Ascensor", grupo: "hard", claves: /ascensor/, delExcel: ["Ascensores"] },
  { id: "artefactos", nombre: "Artefactos y griferías", grupo: "hard", claves: /artefacto|griferi|sanitarios ferrum|inodoro|bacha/, delExcel: ["Instalación Sanitaria Artefactos", "Mano de Obra Instalación Sanitaria Artefactos"] },
  { id: "carpinterias", nombre: "Carpinterías y aberturas", grupo: "hard", claves: /carpinter|abertur|ventana/, delExcel: ["Carpinterías", "Mano de Aberturas"] },
  { id: "vidrios", nombre: "Vidrios", grupo: "hard", claves: /vidri|cristal/, delExcel: ["Vidrios"] },
  { id: "puertas", nombre: "Puertas", grupo: "hard", claves: /puerta/ },
  { id: "mobiliario", nombre: "Mobiliario fijo", grupo: "hard", claves: /mobiliario|mueble|placard|bajo mesada|cocina/, delExcel: ["Colocación Mobiliario FIjo"] },
  { id: "marmol", nombre: "Mármol y mesadas", grupo: "hard", claves: /marmol|granito|mesada/ },
  { id: "espejos", nombre: "Espejos", grupo: "hard", claves: /espejo/ },
  { id: "herreria", nombre: "Herrería", grupo: "hard", claves: /herreri|baranda|reja/ },
  { id: "herrajes", nombre: "Herrajes", grupo: "hard", claves: /herraje|cerradura|picaporte/ },
  { id: "aire", nombre: "Aire acondicionado", grupo: "hard", claves: /aire acond|split|climatiz/ },
  { id: "amenities", nombre: "Amenities y paisajismo", grupo: "hard", claves: /amenit|paisaj|parquiz|laundry|cowork|terraza/, delExcel: ["Infraestructura y paisajismo PB", "Amenities (laundry + cowork + terraza)"] },
  { id: "ayuda-gremio", nombre: "Ayuda de gremio", grupo: "hard", claves: /ayuda de gremio/ },
  { id: "limpieza", nombre: "Limpieza de obra", grupo: "hard", claves: /limpieza|volquete/, delExcel: ["Limpieza de Obra Final"] },
  { id: "varios", nombre: "Varios de obra", grupo: "hard", claves: /varios de obra/, delExcel: ["Otros gastos generales"] },
  // ——— Soft ———
  { id: "imprevistos", nombre: "Imprevistos", grupo: "soft" },
  { id: "derechos", nombre: "Derechos y aprobaciones municipales", grupo: "soft", claves: /derechos?|permiso de obra|inicio de obra|aprobaci|municipal|plusval/, rubrosCaja: ["derechos"] },
  { id: "proyecto", nombre: "Proyecto (honorarios)", grupo: "soft", claves: /proyecto|arquitect|renderista/ },
  { id: "direccion", nombre: "Dirección de obra (honorarios)", grupo: "soft", claves: /direcci\w* de obra/ },
  { id: "ejecucion", nombre: "Ejecución", grupo: "soft", claves: /ejecuci|jefe de obra|capataz/ },
  { id: "asesores", nombre: "Asesores (estructura, instalaciones, código)", grupo: "soft", claves: /asesor|calculista|ingenier|seg(uridad)? (e|y) hig/, delExcel: ["Asesor de arquitectura y código", "Asesor instalaciones", "Asesor estructura"] },
  { id: "gestores", nombre: "Gestores y encomiendas", grupo: "soft", claves: /gestor|encomienda|empalizada|epcir/, delExcel: ["Gestores", "Encomiendas"] },
  { id: "seguros", nombre: "Seguros", grupo: "soft", claves: /seguro|federacion patronal|mercantil andina|rivadavia|\bart\b/, rubrosCaja: ["seguros"] },
  // ——— Impuestos y gastos ———
  { id: "iva", nombre: "IVA (débito − crédito)", grupo: "impuestos", claves: /\biva\b/, delExcel: ["IVA (débito − crédito)"] },
  { id: "iibb", nombre: "Ingresos brutos y otros impuestos", grupo: "impuestos", claves: /\biibb\b|ingresos brutos|\bvep\b|arca|afip|\babl\b|sellos/, rubrosCaja: ["impuestos"], delExcel: ["Ingresos brutos y otros impuestos", "Impuestos"] },
  { id: "bancarios", nombre: "Gastos bancarios", grupo: "impuestos", claves: /\bdeb\b|\bcred\b|comision banc|mantenimiento cuenta/, rubrosCaja: ["bancarios"] },
  { id: "escribanos", nombre: "Escribanos y contador", grupo: "impuestos", claves: /escriban|contador/, delExcel: ["Escribanos"] },
];

/** El grupo de un pago de la caja que no se pudo asignar a ningún ítem (por su rubro de la caja). */
export function grupoDeRubroCaja(rubro: string): GrupoPresupuesto {
  if (rubro === "terreno") return "terreno";
  if (["honorarios", "seguros", "derechos", "sueldos", "administracion", "servicios"].includes(rubro)) return "soft";
  if (["impuestos", "bancarios"].includes(rubro)) return "impuestos";
  return "hard";
}
