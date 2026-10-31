import type { Metadata } from "next";
import { AreaPagina } from "@/components/AreaPagina";

export const metadata: Metadata = { title: "Administración" };

export default function Administracion() {
  return <AreaPagina href="/administracion" />;
}
