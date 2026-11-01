# Exportar a Excel

Cada pantalla con números tiene **Exportar a Excel** (arriba, al lado de "Actualizar", o en su tabla). El archivo trae lo que se ve en la pantalla (con los filtros aplicados), con los títulos en negrita, los datos en azul, filtros en los títulos, la primera fila y columna fijas y, abajo, los **totales como fórmulas SUMA** a la vista. Nada de fórmulas raras: para revisar y seguir trabajando en el Excel.

| Pantalla | Qué trae |
| --- | --- |
| Prefactibilidad | Lote, construibles y descubiertas, vendibles, resumen y plusvalía, con las cuentas como fórmulas (ver docs/prefactibilidad.md) |
| Cash flow | La vista elegida (proyectado, real, real + proyectado o la comparación) en dólares o pesos, con grupos, flujo neto y caja acumulada como fórmulas, y los movimientos (ver docs/cash-flow.md) |
| Lista de precios | Las unidades libres con superficies, coeficiente y precio de lista (y el simulado, si se está simulando) |
| Unidades | Todas las unidades con su estado, inversor, superficies y precios |
| Cuentas corrientes | Una hoja por cuenta (precio, pagado, saldo, avance, último pago, vencidos, pendiente del Flujo) y otra con todos los pagos |
| Cobranzas | Lo vencido, lo de este mes y lo del próximo, con el monto del Flujo y el actualizado por CAC (con su cuenta) |
| Ingresos | Los pagos del Flujo con los filtros de la pantalla (en $ y en US$ por separado, para que sumen) |
| Egresos | Los egresos con los filtros de la pantalla, con su rubro y la pestaña y fila de la caja |
| CRM → Base de datos | Los contactos con los filtros de la pantalla |

Código: `lib/excel/tabla.ts` (el exportador común, con test), `components/ExportarExcel.tsx` (el botón; exceljs se carga recién al tocarlo) y, para formas especiales, `lib/prefactibilidad/excel.ts` y `lib/finanzas/cashflowExcel.ts`.
