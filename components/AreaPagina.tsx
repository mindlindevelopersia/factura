import { TarjetasModulos } from "@/components/TarjetasModulos";
import { AREAS } from "@/lib/modulos";

/** La página de un área: su nombre, qué abarca y una tarjeta por módulo. */
export function AreaPagina({ href }: { href: string }) {
  const area = AREAS.find((a) => a.href === href)!;
  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Área</span>
          <h1>{area.nombre}</h1>
          <p>{area.descripcion}</p>
        </div>
      </div>
      <TarjetasModulos items={area.modulos} />
    </main>
  );
}
