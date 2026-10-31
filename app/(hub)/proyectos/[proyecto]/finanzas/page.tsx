import type { Metadata } from "next";
import { AreaPagina } from "@/components/AreaPagina";
import { areaDeProyecto } from "@/lib/modulos";

export const metadata: Metadata = { title: "Finanzas" };

export default async function Finanzas({ params }: { params: Promise<{ proyecto: string }> }) {
  const { proyecto } = await params;
  return <AreaPagina area={areaDeProyecto(proyecto, "finanzas")!} />;
}
