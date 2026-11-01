import type { Metadata } from "next";
import { requireRuta } from "@/lib/auth/session";
import { AreaPagina } from "@/components/AreaPagina";
import { areaDeProyecto } from "@/lib/modulos";

export const metadata: Metadata = { title: "Management" };

export default async function Management({ params }: { params: Promise<{ proyecto: string }> }) {
  await requireRuta(`/proyectos/${(await params).proyecto}/management`);
  const { proyecto } = await params;
  return <AreaPagina area={areaDeProyecto(proyecto, "management")!} />;
}
