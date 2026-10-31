import type { Metadata } from "next";
import { AreaPagina } from "@/components/AreaPagina";

export const metadata: Metadata = { title: "Finanzas" };

export default function Finanzas() {
  return <AreaPagina href="/finanzas" />;
}
