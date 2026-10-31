import type { NextConfig } from "next";
import { PROYECTO_PRINCIPAL, RUTAS_MUDADAS } from "./lib/modulos";

const nextConfig: NextConfig = {
  // Las áreas que se mudaron adentro de los proyectos: las rutas viejas (y los links que ya mandó
  // el bot de Telegram, con su ?revisar=) llevan a las de Lerma.
  async redirects() {
    return RUTAS_MUDADAS.map((a) => ({ source: `/${a}/:ruta*`, destination: `/proyectos/${PROYECTO_PRINCIPAL.id}/${a}/:ruta*`, permanent: false }));
  },
};

export default nextConfig;
