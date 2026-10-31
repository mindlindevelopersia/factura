# Finanzas · Egresos: de dónde salen y cómo se clasifican

Relevamiento del 31/10/2026 sobre "[PRUEBA] Administración Contable - copia para la app" (`SHEET_ID`). Es la base del módulo Egresos del área Finanzas. Acá se describen la estructura y las reglas; los montos y los nombres no se copian al repo.

El módulo **solo lee** la planilla. Nunca escribe, modifica ni borra.

## Fuentes

Las pestañas de caja, que registran lo que realmente se pagó:

| Pestaña | Moneda | Egresos (31/10/2026) | Signo de los egresos |
|---|---|---|---|
| **Caja Flujos en Pesos** | ARS | 855 filas | Negativo |
| **Caja Flujos en Dólares Global** | USD | 136 filas | Positivo |

Columnas que usa (fila 1): Fecha, Tipo de Operación (solo "Egreso"), Rubro/Descripción (en dólares, "Nota"), Conciliación (la categoría general: Impuestos, Caja, Materiales…), Corresponde (proyecto: Lerma 439, HQ, Güemes), Forma de Pago/Cobro, Legalidad (Blanco o Negro), Banco e Importe Total.

"Facturación de Egresos (Compras)" no se usa acá: tiene solo las facturas (todo en blanco) y no los pagos.

## Rubros

La columna "Rubro/Descripción" es texto libre (236 textos distintos) y la categoría es demasiado gruesa. El rubro sale de reglas sobre la descripción (`RUBROS` en `lib/finanzas/egresos.ts`), en orden; si ninguna aplica, de la categoría:

| Rubro | Se reconoce por |
|---|---|
| Terreno | "Compra lote", comisión inmobiliaria |
| Constructora (JH / Miranda) | "JH", "Miranda" |
| Hormigón | "Hormig…" |
| Hierro | "Herpaco", "hierro" |
| Derechos y tasas de obra | Plusvalía, derechos de construcción, inicio de obra |
| Electricidad | "Electric…", cámara transformadora |
| Materiales varios | Costa Materiales, corralón, ferretería, Mercado Libre; categoría Materiales |
| Devoluciones | "Devolución" |
| Sueldos y autónomos | Sueldo, autónomos; categoría Sueldos |
| Seguros | Seguro, Federación Patronal, Mercantil Andina, Rivadavia; categoría Seguros |
| Honorarios profesionales | Honorarios, contador, escribano, abogado, gestora, Empalizada, EPCIR, Assad, Busca, seguridad e higiene; categoría Honorarios |
| Impuestos | VEP, IIBB, sellos, ABL, ARCA, débitos y créditos; categoría Impuestos |
| Gastos bancarios | Comisiones, caja de seguridad; categoría Gastos bancarios |
| Gastos administrativos | Categoría Gastos Administrativos |
| Otros servicios de terceros | Categoría Servicios de terceros |
| Sin clasificar | Lo demás. Va a "Para revisar", agrupado por descripción |

Decisiones del 31/10/2026: Herpaco es hierro; JH 94 y Miranda son la misma constructora; el terreno cuenta como egreso (rubro propio, se puede filtrar).

## Lo que no se cuenta como egreso

- **Movimientos internos** (se ven aparte, sin sumar): compra y venta de dólares, FIMA (suscripciones, rescates y "Valores a Depositar"), transferencias entre cuentas propias (Interbank, a Mercado Pago, Galicia, Nación) y extracciones o caja chica.
- **Egresos con el signo al revés** (positivos en pesos o negativos en dólares): suelen ser plata que entró cargada como egreso, como las cuotas de inversores que figuraban así. Van a "Para revisar" y no se cuentan hasta corregirlos.
- **Importes que no son números.**

## Lo que se cuenta pero va a revisar

- Egresos sin fecha (los "arqueos"): suman en los totales, pero no se ubican en un mes.
- Egresos sin blanco o negro: se cuentan como "sin dato".
- Egresos sin rubro.

## Lo que falta

- **Presupuesto:** cuando exista la hoja de presupuestos, cada rubro va a mostrar presupuestado, gastado y lo que queda.
- La pestaña "Gestión de Pagos" (pagos pendientes) no se usa todavía: tiene pocas filas y sin movimiento reciente.

## Dónde está el código

- `lib/finanzas/egresos.ts`: lectura de las cajas, rubros, movimientos internos, avisos, filtros y totales. Sin red; con tests en `egresos.test.ts`.
- `lib/finanzas/fuente.ts`: lee las pestañas con la cuenta de servicio y guarda la lectura 5 minutos.
- `GET /api/finanzas/egresos` (`?fresco=1` vuelve a leer) y la pantalla `/finanzas/egresos` (`components/finanzas/Egresos.tsx`).
- Variables opcionales: `FINANZAS_TAB_CAJA_ARS` y `FINANZAS_TAB_CAJA_USD` (por defecto, los nombres de arriba).

## Verificación con la copia de prueba (31/10/2026)

Con la planilla bajada ese día: en pesos, $443,8 M gastados en 771 pagos (sin $317 M de movimientos internos); en dólares, US$ 734.712 en 114 pagos, de los que US$ 462.500 son el terreno. Quedan sin rubro $1,4 M y US$ 137.300 (sobre todo "Egresos Borok" y "Tranf a Borok 1"), listados en "Para revisar".
