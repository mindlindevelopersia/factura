import type { Metadata } from "next";
import { AreaPagina } from "@/components/AreaPagina";

export const metadata: Metadata = { title: "Inversores" };

export default function Inversores() {
  return <AreaPagina href="/inversores" />;
}
