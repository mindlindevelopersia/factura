"use client";

import { useState } from "react";
import type { Hoja } from "@/lib/excel/tabla";
import { Icono } from "./Icono";

/** "Exportar a Excel": arma las hojas recién al tocarlo (exceljs se carga en ese momento). */
export function ExportarExcel({ nombre, hojas, etiqueta = "Exportar a Excel" }: { nombre: string; hojas: () => Hoja[]; etiqueta?: string }) {
  const [armando, setArmando] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--borde btn--chico"
      disabled={armando}
      onClick={async () => {
        setArmando(true);
        try {
          const { exportarTablas, descargar } = await import("@/lib/excel/tabla");
          descargar(await exportarTablas(hojas()), nombre);
        } finally {
          setArmando(false);
        }
      }}
    >
      <Icono nombre="archivo" size={14} /> {armando ? "Armando…" : etiqueta}
    </button>
  );
}
