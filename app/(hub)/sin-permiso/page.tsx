import type { Metadata } from "next";
import Link from "next/link";
import { Icono } from "@/components/Icono";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sin permiso" };

/** Adonde va quien abre una página que no tiene habilitada. */
export default async function SinPermiso() {
  await requireUser();
  return (
    <main className="app-main" id="contenido">
      <div className="area-vacia">
        <Icono nombre="alerta" size={22} />
        <strong>No tenés permiso para ver esta sección</strong>
        <p>Si la necesitás, pedile a un administrador que te la habilite en Ajustes → Usuarios.</p>
        <Link href="/" className="btn btn--primario btn--chico">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
