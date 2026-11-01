import type { Metadata } from "next";
import { AvisoBeta } from "@/components/Beta";
import { Ficha } from "@/components/inversores/Ficha";
import { requireRuta } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Cuenta corriente" };

export default async function PaginaFicha({ params }: { params: Promise<{ id: string; proyecto: string }> }) {
  await requireRuta(`/proyectos/${(await params).proyecto}/inversores/cuentas-corrientes`);
  const { id } = await params;

  return (
    <main className="app-main" id="contenido">
      <AvisoBeta />
      <Ficha id={id} />
    </main>
  );
}
