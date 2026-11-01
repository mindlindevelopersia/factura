import type { Metadata } from "next";
import { requireRuta } from "@/lib/auth/session";
import { AreaPagina } from "@/components/AreaPagina";
import { areaDeProyecto } from "@/lib/modulos";

export const metadata: Metadata = { title: "Finanzas" };

export default async function Finanzas({ params }: { params: Promise<{ proyecto: string }> }) {
  await requireRuta(`/proyectos/${(await params).proyecto}/finanzas`);
  const { proyecto } = await params;
  return <AreaPagina area={areaDeProyecto(proyecto, "finanzas")!} />;
}
