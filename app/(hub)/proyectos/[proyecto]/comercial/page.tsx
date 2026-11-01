import type { Metadata } from "next";
import { requireRuta } from "@/lib/auth/session";
import { AreaPagina } from "@/components/AreaPagina";
import { areaDeProyecto } from "@/lib/modulos";

export const metadata: Metadata = { title: "Comercial" };

export default async function Comercial({ params }: { params: Promise<{ proyecto: string }> }) {
  await requireRuta(`/proyectos/${(await params).proyecto}/comercial`);
  const { proyecto } = await params;
  return <AreaPagina area={areaDeProyecto(proyecto, "comercial")!} />;
}
