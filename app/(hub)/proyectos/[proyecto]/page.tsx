import type { Metadata } from "next";
import { AvisoBeta } from "@/components/Beta";
import { CajaBuscar } from "@/components/Buscador";
import { Tablero } from "@/components/proyectos/Tablero";
import { TarjetasModulos } from "@/components/TarjetasModulos";
import { requireRuta } from "@/lib/auth/session";
import { areasDeProyecto, proyecto as buscar } from "@/lib/modulos";
import { accesoDeEmail } from "@/lib/permisos/fuente";
import { veArea } from "@/lib/permisos/modelo";

export const metadata: Metadata = { title: "Proyecto" };

/** La portada de un proyecto: el tablero y sus áreas. */
export default async function PaginaProyecto({ params }: { params: Promise<{ proyecto: string }> }) {
  const user = await requireRuta(`/proyectos/${(await params).proyecto}`);
  const { proyecto: id } = await params;
  // El tablero muestra ventas y unidades: solo para quien ve algo de Comercial.
  const acceso = await accesoDeEmail(user.email).catch(() => null);
  const veComercial = !acceso || veArea(acceso, "comercial", id);
  const p = buscar(id)!;
  return (
    <main className="app-main" id="contenido">
      <AvisoBeta />
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Proyecto · {p.vehiculo}</span>
          <h1>{p.nombre}</h1>
          <p>{p.descripcion}</p>
        </div>
      </div>
      <CajaBuscar placeholder={`Buscar en ${p.nombre}: leads, unidades, inversores, tareas…`} />
      {p.planillaMadre && veComercial && <Tablero />}
      <h2 className="cac__titulo-seccion indicadores__modulos">Áreas del proyecto</h2>
      <TarjetasModulos items={areasDeProyecto(p.id)} />
    </main>
  );
}
