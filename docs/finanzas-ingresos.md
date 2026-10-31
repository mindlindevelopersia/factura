# Finanzas · Ingresos: cómo está armada la planilla

Relevamiento del 31/10/2026 sobre "[PRUEBA] Administración Contable - copia para la app" (`SHEET_ID`), pestaña **"Flujo de fondos LERMA"**. Es la base del módulo Ingresos del área Finanzas. Acá se describe la estructura; los montos y los nombres de los inversores no se copian al repo.

El módulo **solo lee** esta pestaña. Nunca escribe, modifica ni borra.

## Forma de la tabla

Una fila por cada combinación de **inversor × tipo de pago × blanco/negro × moneda**, y una columna por mes.

| Columna | Encabezado | Qué tiene |
|---|---|---|
| A | Inversores | Nombre del inversor. "Falta vender" = unidad sin vender |
| B | Mes Base CAC | Mes desde el que se ajusta por CAC (fecha). Vacío en algunas filas |
| C | Desarrollo | "MIND Lerma 439" en los datos; "Lerma 439" en los totales |
| D | Unidad Funcional | 1A, PB, 3C… |
| E | CUIT | Del inversor, cuando está |
| F | TIPO DE PAGO | `ANTICIPO`, `CUOTA MENSUAL`, `REFUERZO 1` a `REFUERZO 6` |
| G | B o N? | `Blanco` o `Negro` |
| H | MONEDA? | `USD` (solo anticipos) o `ARS` (cuotas y refuerzos) |
| I | ANTICIPO USD | Monto del anticipo. Sin fecha ni columna de mes |
| J | CUOTA BASE | Cuota a valores del mes base |
| K | REFUERZOS | Monto del refuerzo |
| L | Totales | Total de la fila |
| M a BF | Marzo 2025 … Diciembre 2028 | Lo que se cobra (o se cobró) ese mes, en la moneda de la fila |

- **Filas 2 a 103:** los datos (23 nombres distintos, contando "Falta vender").
- **Filas 105 a 111:** totales de la propia planilla (anticipos USD negro y blanco, subtotal de cuotas, refuerzos negro, blanco y totales, total general). Sirven de control.
- **Filas 154 a 156:** tres números sueltos en la columna BA, fuera de la tabla. Se ignoran.

## Cobrado y a cobrar: por el color

No hay una columna de estado. Lo marca el **color de fondo** de cada celda de mes:

| Color | Significado | Celdas |
|---|---|---|
| Verde (`#B6D7A8`) | Cobrado | 190 |
| Rosa (`#F4CCCC`) | A cobrar | 262 |
| Amarillo (`#FFFF00`) | Sin definir: una fila de refuerzo repartida en meses (mar–oct 2026) | 8 |
| Celeste (`#CFE2F3`) | Sin definir | 1 |

El patrón es coherente con el calendario: verde hasta septiembre de 2026 y rosa desde noviembre de 2026. Las excepciones son rosas en meses pasados (posibles **atrasados**) y un verde en abril de 2027 (posible **pago adelantado**).

Para el módulo, la API de Sheets tiene que pedir el formato de las celdas (`spreadsheets.get` con `includeGridData` y `effectiveFormat.backgroundColor`), no solo los valores.

## CAC

- Las cuotas en pesos se ajustan mes a mes con una fórmula: `mes anterior × (1 + variación CAC)`.
- La variación sale de **otra planilla** por `IMPORTRANGE`, pestaña "Índice CAC", columna D: una fila distinta por mes, también para los meses futuros. Los meses futuros ya vienen calculados con la proyección de esa planilla.
- El módulo usa los valores ya calculados de cada celda. No recalcula el CAC.

## Anticipos en USD

- Tienen monto (columna I) pero **no fecha ni color**: no se puede saber de la tabla en qué mes se cobraron ni si están cobrados.
- La pestaña "Proyectado Anticipos en Blanco" tiene la fecha de contrato de los anticipos en blanco, con algunas fechas mal cargadas. Para los de negro no hay fecha.

## Controles hechos (31/10/2026)

- La suma de los anticipos USD, blanco y negro, coincide exactamente con las filas 105 y 106.
- La suma de todas las celdas de meses en pesos coincide exactamente con la suma de la fila 111 de marzo de 2025 a diciembre de 2028.
- **Diferencia en la planilla:** el total general (`L111 = SUM(M111:BB111)`) llega hasta agosto de 2028 y deja afuera septiembre a diciembre de 2028. El subtotal de cuotas (`L107`) llega hasta septiembre de 2028. Por eso el total de la planilla es menor que la suma de todos los meses.

## Reglas que usa el módulo (acordadas el 31/10/2026)

| Caso | Cómo se cuenta | ¿Va a "Para revisar"? |
|---|---|---|
| Verde | Cobrado, aunque sea de un mes futuro (pago adelantado) | No |
| Rosa de este mes en adelante | A cobrar | No |
| Rosa de un mes pasado | A cobrar, marcado como **vencido** | Sí: verificar si se cobró y que el monto esté actualizado por CAC a hoy |
| Amarillo | A cobrar (es un monto que hay que actualizar) | Sí |
| Celeste | No se cuenta (unidad sin vender) | Sí, si tiene monto |
| Inversor "Falta vender" | No se cuenta | Sí, si tiene montos |
| Sin color | A cobrar | Sí |
| Texto en vez de número | No se cuenta | Sí |
| Anticipo | En dólares y **cobrado**, en el mes siguiente al "Mes Base CAC" (base febrero → cobrado en marzo) | Solo si no tiene mes base, o si la columna MONEDA no dice USD (se cuenta en dólares igual) |
| Fila sin blanco/negro o con tipo desconocido | No se cuenta | Sí |
| Fila de totales cuyo total no da la suma de los meses | El módulo usa la suma de los meses | Sí |

Pesos y dólares nunca se suman entre sí.

## Dónde está el código

- `lib/finanzas/ingresos.ts`: lectura de la tabla, reglas, filtros y totales. Sin red; con tests en `ingresos.test.ts`.
- `lib/finanzas/fuente.ts`: lee la pestaña con la cuenta de servicio (valores y colores) y guarda la lectura 5 minutos.
- `GET /api/finanzas/ingresos` (`?fresco=1` vuelve a leer) y la pantalla `/finanzas/ingresos` (`components/finanzas/Ingresos.tsx`).
- Variables opcionales: `FINANZAS_SHEET_ID` (por defecto, `SHEET_ID`) y `FINANZAS_TAB_FLUJO` (por defecto, "Flujo de fondos LERMA").

## Verificación con la copia de prueba (31/10/2026)

Con la planilla bajada ese día, el módulo da exactamente lo mismo que la planilla: en pesos, la suma de la fila de totales mes por mes; en dólares, los anticipos de las filas 105 y 106. Aparecen 17 cosas para revisar (pagos vencidos, anticipos sin mes base, un anticipo con "ARS" en la columna MONEDA, la fila amarilla y el total general que no incluye los últimos meses).
