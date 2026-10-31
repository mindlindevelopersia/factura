import type { Metadata } from "next";
import { AreaPagina } from "@/components/AreaPagina";
import { areaDeProyecto } from "@/lib/modulos";

export const metadata: Metadata = { title: "Inversores" };

export default async function Inversores({ params }: { params: Promise<{ proyecto: string }> }) {
  const { proyecto } = await params;
  return <AreaPagina area={areaDeProyecto(proyecto, "inversores")!} />;
}
