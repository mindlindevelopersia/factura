import type { Metadata } from "next";
import { AreaPagina } from "@/components/AreaPagina";

export const metadata: Metadata = { title: "Indicadores" };

export default function Indicadores() {
  return <AreaPagina href="/indicadores" />;
}
