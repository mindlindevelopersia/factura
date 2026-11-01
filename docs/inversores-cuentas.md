# Inversores · Cuentas corrientes

Relevamiento del 31/10/2026 sobre "[PRUEBA] Administración Contable - copia para la app" (`SHEET_ID`). Acá se describen la estructura y las reglas; los montos y los datos de los inversores no se copian al repo.

El módulo **solo lee** la planilla. Nunca escribe, modifica ni borra.

## Fuentes

**"Pagos por Inversor"**: un bloque por inversor, uno al lado del otro (22 bloques el 31/10/2026). Cada bloque empieza en la fila 2 con "Estado de cuenta al…" y tiene:

- Ficha (fila 4 títulos, fila 5 datos): Inversor, Emprendimiento, Departamento, CUIT, Número Teléfono, Mes Base CAC.
- Costo estimado (filas 9 a 11): "Costo Estimado Departamento", "Monto Total Formal" (o "en Blanco") y "Monto Total Informal" (o "en Negro"), en dólares y en pesos.
- Pagos (desde la fila 22): Operación (fecha), Monto, Moneda, Legalidad (o "Tipo"), Monto en Pesos, Tipo de Cambio, Monto en Dólares, Número de Concepto, Concepto.
- Notas para el inversor ("NOTAS") y comentarios internos ("Comentarios:").

El módulo encuentra cada dato por su título, no por posición fija. Algunos bloques tienen al lado una plantilla vacía con los mismos títulos (6D, 7B): vale la primera.

**"Flujo de fondos LERMA"** (ver [finanzas-ingresos.md](finanzas-ingresos.md)): lo que falta pagar (rosa y amarillo) y lo cobrado (verde), por mes.

## Reglas (acordadas el 31/10/2026)

- **Precio:** el "Costo Estimado Departamento" en dólares. El avance se mide en dólares: cada pago al tipo de cambio de su día ("Monto en Dólares"; si falta, monto ÷ tipo de cambio).
- **Formal e informal:** "Formal"/"Blanco" y "Informal"/"Negro". Cada uno contra su monto total.
- **Bloques que se ignoran:** unidad "NINGUNO" o con error (#REF!). Así quedan afuera Nicolás Arcuschin (se retiró) y el bloque duplicado de Vicente Atela.
- **Unidad compartida:** cada titular es una cuenta aparte (4D: Sergio, Alon e Ioni Druck).
- **Unión con el Flujo:** por unidad y nombre parecido (tolera una letra distinta: "Iony"/"Ioni"); si en la unidad hay una sola cuenta y nadie del Flujo se llama como ella, se le asigna (2A: "Emporio" en el Flujo, Jorge Bisignano en la cuenta); si no, por nombre en otra unidad (Tomas Echecopar: su cuenta es 8B y el Flujo también lo tiene en 8C). Lo que no se puede unir arma una cuenta solo con el Flujo (2D, Valentín Italiano).
- **Estado de cuenta para el inversor:** "Imprimir o PDF" desde la ficha. Lleva membrete, datos, avance, pagos con acumulado, pagos que faltan y las notas del bloque; no lleva los comentarios internos ni los avisos. "Incluir informal" decide si entra lo informal (sin él, la base es el monto total formal).

## Para revisar

- Fechas de pago imposibles, futuras o mal escritas (31/06/2026, 2062, días y meses invertidos): se cuentan, pero no se ubican en el tiempo.
- Pagos sin equivalente en dólares o sin formal/informal.
- Cuentas que pagaron más del 100% (diferencias de tipo de cambio o un pago mal cargado).
- Cuentas que solo están en el Flujo.

No se compara lo pagado en pesos con lo marcado en verde en el Flujo: algunos inversores pagan en dólares cuotas que el Flujo anota en pesos, y la comparación daba falsas alarmas.

## Dónde está el código

- `lib/inversores/cuentas.ts`: lectura de los bloques, unión con el Flujo, resumen y avisos. Sin red; con tests en `cuentas.test.ts`.
- `lib/finanzas/fuente.ts` (`cuentasCorrientes`): lee las pestañas con la cuenta de servicio y guarda la lectura 5 minutos.
- `GET /api/inversores/cuentas` (`?fresco=1` vuelve a leer), el listado `/inversores/cuentas-corrientes` y la ficha `/inversores/cuentas-corrientes/<unidad>-<inversor>`.
- Variable opcional: `INVERSORES_TAB_PAGOS` (por defecto, "Pagos por Inversor").

## Verificación con la copia de prueba (31/10/2026)

21 cuentas (20 con bloque y 2D solo del Flujo). Vendido US$ 2.296.485, pagado US$ 1.317.813 (57%). Los totales pagados de cada bloque coinciden con la suma de su columna "Monto en Dólares". Avisos: fechas en 1A ("31/06/2026"), 3A (dos fechas futuras) y PB (2062).

## Bloques con el encabezado roto

Si un bloque de "Pagos por Inversor" tiene la unidad rota (#REF!, NINGUNO o vacía), no se descarta enseguida: si al menos 3 de sus pagos coinciden (mismo monto y moneda) con los cobros del Flujo de alguien que no tiene bloque, el bloque es de esa persona. Se usan sus pagos, pero no su encabezado (nombre, unidad, CUIT, teléfono, costo): está copiado de otra cuenta. La cuenta queda sin precio, con el aviso "Encabezado copiado de otra cuenta", y no suma al saldo ni al avance del total hasta que se corrija. Caso real: 2D (Valentín Italiano), bloque de la columna AP con el encabezado de otra cuenta.

## En pesos ajustados por CAC

La ficha de cada inversor muestra, además de los dólares, la cuenta en pesos llevados al último CAC publicado (el del mes anterior a hoy, o el último que haya). Es la misma regla que las cuotas: el índice de un mes es el del mes anterior.

- Costo de hoy = costo en pesos del contrato × CAC(último) ÷ CAC(mes anterior al mes base).
- Cada pago en pesos = monto × CAC(último) ÷ CAC(mes anterior al del pago).
- Los pagos en dólares (anticipos) van al tipo de cambio del contrato (costo en pesos ÷ costo en dólares) y se ajustan desde el mes base, como el costo: un dólar pagado vale lo mismo que un dólar del precio.
- Avance = pagado de hoy ÷ costo de hoy. Saldo = costo de hoy − pagado de hoy.

La tabla de pagos suma la columna "En pesos de hoy" con el factor CAC de cada uno. Sin mes base CAC (por ejemplo, las de precio cerrado en dólares) no hay costo de hoy. Lógica en `lib/inversores/pesos.ts`; el CAC llega con las cuentas (`cac` en la respuesta de `/api/inversores/cuentas`).

## Cruce con Ventas y el Flujo

Las cuentas se cruzan con el machete de "Ventas" del Excel madre y con el Flujo de fondos (`lib/inversores/cruce.ts`):

- **Completa** lo que falta en "Pagos por Inversor": el costo estimado de Ventas (si ninguna cuenta de la unidad lo tiene) y el mes base CAC del Flujo. Queda un aviso "completado" diciendo de dónde salió.
- **Avisa** lo que no coincide: costo estimado (sumando las cuentas de la unidad, como la 4D), nombre, anticipo al boleto contra los anticipos cargados, mes base CAC, y en Ventas, blanco + negro contra el monto al boleto.
- Lo que ya explica una corrección del proyecto (`ajustes` en `lib/modulos.ts`, por ejemplo el mutuo de la 4C) no se avisa.
- Si el Excel madre no se puede leer, las cuentas salen igual, sin el cruce.
