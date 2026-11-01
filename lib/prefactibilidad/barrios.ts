/**
 * Municipios y barrios para la prefactibilidad. La lógica de las fórmulas depende del municipio:
 * CABA es volumétrico (FOT, plusvalía de la Ley 6062); La Plata va por FOS y densidad (pendiente:
 * se carga con su Excel).
 */

export const MUNICIPIOS = ["CABA", "La Plata"] as const;

/** Los barrios que más se miran (arriba en la lista), en orden alfabético. */
export const BARRIOS_PRINCIPALES = [
  "Almagro",
  "Belgrano R",
  "Chacarita",
  "Coghlan",
  "Colegiales",
  "Montserrat",
  "Núñez",
  "Palermo",
  "Palermo Hollywood",
  "Puerto Madero",
  "Ramblas del Plata",
  "Recoleta",
  "Retiro",
  "Saavedra",
  "San Telmo",
  "Villa Crespo",
  "Villa Urquiza",
];

/** Los 48 barrios oficiales de la Ciudad de Buenos Aires. */
const BARRIOS_CABA = [
  "Agronomía",
  "Almagro",
  "Balvanera",
  "Barracas",
  "Belgrano",
  "Boedo",
  "Caballito",
  "Chacarita",
  "Coghlan",
  "Colegiales",
  "Constitución",
  "Flores",
  "Floresta",
  "La Boca",
  "La Paternal",
  "Liniers",
  "Mataderos",
  "Monte Castro",
  "Montserrat",
  "Nueva Pompeya",
  "Núñez",
  "Palermo",
  "Parque Avellaneda",
  "Parque Chacabuco",
  "Parque Chas",
  "Parque Patricios",
  "Puerto Madero",
  "Recoleta",
  "Retiro",
  "Saavedra",
  "San Cristóbal",
  "San Nicolás",
  "San Telmo",
  "Vélez Sarsfield",
  "Versalles",
  "Villa Crespo",
  "Villa del Parque",
  "Villa Devoto",
  "Villa General Mitre",
  "Villa Lugano",
  "Villa Luro",
  "Villa Ortúzar",
  "Villa Pueyrredón",
  "Villa Real",
  "Villa Riachuelo",
  "Villa Santa Rita",
  "Villa Soldati",
  "Villa Urquiza",
];

/** El resto de los barrios de CABA (los que no están arriba), en orden alfabético. */
export const OTROS_BARRIOS = BARRIOS_CABA.filter((b) => !BARRIOS_PRINCIPALES.includes(b)).sort((a, b) => a.localeCompare(b, "es"));
