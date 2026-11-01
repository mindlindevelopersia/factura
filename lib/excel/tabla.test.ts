import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { exportarTablas } from "./tabla";

describe("exportar a Excel", () => {
  it("una hoja con títulos, datos y el total como SUMA a la vista", async () => {
    const blob = await exportarTablas([
      {
        nombre: "Egresos/2026",
        titulo: "Egresos de prueba",
        columnas: [{ titulo: "Fecha", formato: "fecha" }, { titulo: "Detalle" }, { titulo: "Monto en $", formato: "pesos", total: true }],
        filas: [
          ["2026-03-14", "Hormigón inventado", 1000],
          ["2026-03-20", "Hierro inventado", 2500.5],
        ],
      },
    ]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.worksheets[0];
    expect(ws.name).toBe("Egresos 2026");
    expect(ws.getRow(4).values).toEqual([undefined, "Fecha", "Detalle", "Monto en $"]);
    expect(ws.getCell("A5").value).toBeInstanceOf(Date);
    expect(ws.getCell("C6").value).toBe(2500.5);
    expect(ws.getCell("A7").value).toBe("Total");
    expect(ws.getCell("C7").value).toMatchObject({ formula: "SUM(C5:C6)" });
  });
});
