import { notFound } from "next/navigation";
import { Icono } from "@/components/Icono";
import { proyecto as buscar } from "@/lib/modulos";
import { CHECKLIST_ALTA, NOMBRE_TIPO, TOTAL_ALTA } from "@/lib/proyectos/alta";

/** Todo lo de un proyecto. Uno desconocido no existe; uno bloqueado todavía no se puede abrir. */
export default async function LayoutProyecto({ children, params }: { children: React.ReactNode; params: Promise<{ proyecto: string }> }) {
  const { proyecto: id } = await params;
  const p = buscar(id);
  if (!p) notFound();
  if (p.estado === "bloqueado") {
    return (
      <main className="app-main" id="contenido">
        <div className="pagina-encabezado">
          <div>
            <span className="eyebrow">Proyecto · {p.vehiculo}</span>
            <h1>{p.nombre}</h1>
            <p>{p.descripcion}</p>
          </div>
        </div>
        <div className="area-vacia">
          <Icono nombre="ensayo" size={22} />
          <strong>Este proyecto todavía está en preparación</strong>
          <p>Cuando esté todo lo de abajo, se abren sus módulos. Las planillas se comparten como Lector con {process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "la cuenta de servicio de la app"}.</p>
        </div>
        <section className="card ingresos__seccion alta">
          <h2>
            Para abrirlo: {(p.altaLista ?? []).length} de {TOTAL_ALTA} listos
          </h2>
          {CHECKLIST_ALTA.map((g) => (
            <div key={g.grupo} className="alta__grupo">
              <h3>{g.grupo}</h3>
              <ul>
                {g.items.map((i) => {
                  const listo = (p.altaLista ?? []).includes(i.id);
                  return (
                    <li key={i.id} className={listo ? "alta__item alta__item--listo" : "alta__item"}>
                      <span className="alta__marca" aria-label={listo ? "Listo" : "Falta"}>
                        {listo ? "✓" : ""}
                      </span>
                      <span>
                        <strong>{i.titulo}</strong> <span className="alta__tipo">{NOMBRE_TIPO[i.tipo]}</span>
                        <span className="alta__detalle">{i.detalle}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </main>
    );
  }
  return children;
}
