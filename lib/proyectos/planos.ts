/**
 * Los planos e imágenes de cada proyecto (en privado/proyectos/<id>/, servidos con sesión por /api/proyectos/<id>/imagenes/<archivo>), sacados de "Propuestas
 * comerciales" del Excel madre. Los planos son por tipología: A y C de 2 ambientes, B y D
 * monoambientes, A+B y C+D de 3 ambientes, y la PB. Los pisos 8 y 9 tienen otra planta: sin plano.
 */

export interface UnidadParaPlano {
  nivel: number;
  tipologia: string;
  orientacion: string;
}

export const IMAGENES: Record<string, { render: string; renderTerraza: string; plantaTipo: string; frase: string } | undefined> = {
  "lerma-439": {
    render: "/api/proyectos/lerma-439/imagenes/render-interior.jpg",
    renderTerraza: "/api/proyectos/lerma-439/imagenes/render-terraza.jpg",
    plantaTipo: "/api/proyectos/lerma-439/imagenes/planta-tipo.png",
    frase: "Palermo Queens · Villa Crespo",
  },
};

export function planoDe(proyecto: string, u: UnidadParaPlano): string | null {
  if (proyecto !== "lerma-439") return null;
  const base = "/api/proyectos/lerma-439/imagenes/";
  if (u.nivel === 0) return `${base}plano-pb.png`;
  if (u.nivel >= 8) return null;
  const t = u.tipologia.toLowerCase();
  const lado = /contra/i.test(u.orientacion) ? "contrafrente" : /frente/i.test(u.orientacion) ? "frente" : null;
  if (!lado) return null;
  if (t.includes("3 amb")) return `${base}plano-3amb-${lado}.png`;
  if (t.includes("2 amb")) return `${base}plano-2amb-${lado}.png`;
  if (t.includes("mono")) return `${base}plano-mono-${lado}.png`;
  return null;
}
