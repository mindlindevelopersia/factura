import type { Metadata } from "next";
import { AreaPagina } from "@/components/AreaPagina";
import { areaDeProyecto } from "@/lib/modulos";

export const metadata: Metadata = { title: "Administración" };

export default async function Administracion({ params }: { params: Promise<{ proyecto: string }> }) {
  const { proyecto } = await params;
  return <AreaPagina area={areaDeProyecto(proyecto, "administracion")!} />;
}
