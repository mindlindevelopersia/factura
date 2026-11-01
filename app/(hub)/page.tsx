import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EtiquetaBeta } from "@/components/Beta";
import { Icono } from "@/components/Icono";
import { CajaBuscar } from "@/components/Buscador";
import { DolarHoy } from "@/components/indicadores/Dolar";
import { TarjetasModulos } from "@/components/TarjetasModulos";
import { requireUser } from "@/lib/auth/session";
import { persona, saludoDelMomento } from "@/lib/equipo";
import { AREAS_EMPRESA, PROYECTOS, RUTA_FACTURAS, rutaProyecto } from "@/lib/modulos";

export const metadata: Metadata = { title: "Inicio" };

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<{ revisar?: string }>;
}) {
  // Los avisos de Telegram anteriores al hub apuntan a /?revisar=<id>: siguen abriendo la factura.
  const { revisar } = await searchParams;
  if (revisar) redirect(`${RUTA_FACTURAS}?revisar=${encodeURIComponent(revisar)}`);
  const user = await requireUser();
  const quien = persona(user.email, user.name);

  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Mindlin Developers</span>
          <h1>
            {saludoDelMomento()}, {quien.apodo}
          </h1>
          <p>El dólar del día, cada proyecto con su administración, sus finanzas, su comercial y sus inversores, y lo que es de toda la empresa.</p>
        </div>
      </div>
      <CajaBuscar />
      <DolarHoy />
      <h2 className="cac__titulo-seccion">Proyectos</h2>
      <ul className="tarjetas-modulos">
        {PROYECTOS.map((p) => (
          <li key={p.id}>
            {p.estado === "activo" ? (
              <Link href={rutaProyecto(p.id)} className="tarjeta-modulo">
                <span className="tarjeta-modulo__icono">
                  <Icono nombre="proyecto" size={22} />
                </span>
                <span className="tarjeta-modulo__texto">
                  <strong>{p.nombre}</strong>
                  <span>{p.descripcion}</span>
                  <span className="tarjeta-modulo__lista">{p.vehiculo}</span>
                </span>
                <Icono nombre="flecha" size={18} className="tarjeta-modulo__flecha" />
              </Link>
            ) : (
              <Link href={rutaProyecto(p.id)} className="tarjeta-modulo tarjeta-modulo--bloqueada">
                <span className="tarjeta-modulo__icono">
                  <Icono nombre="proyecto" size={22} />
                </span>
                <span className="tarjeta-modulo__texto">
                  <strong>
                    {p.nombre} <EtiquetaBeta />
                  </strong>
                  <span>{p.descripcion}: mirá qué falta para abrirlo.</span>
                  <span className="tarjeta-modulo__lista">{p.vehiculo}</span>
                </span>
                <Icono nombre="flecha" size={18} className="tarjeta-modulo__flecha" />
              </Link>
            )}
          </li>
        ))}
      </ul>
      <h2 className="cac__titulo-seccion indicadores__modulos">De toda la empresa</h2>
      <TarjetasModulos items={AREAS_EMPRESA} />
    </main>
  );
}
