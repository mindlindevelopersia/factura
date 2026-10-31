import type { Metadata } from "next";
import { AreaPagina } from "@/components/AreaPagina";
import { areaDeProyecto } from "@/lib/modulos";

export const metadata: Metadata = { title: "Comercial" };

export default async function Comercial({ params }: { params: Promise<{ proyecto: string }> }) {
  const { proyecto } = await params;
  return <AreaPagina area={areaDeProyecto(proyecto, "comercial")!} />;
}
