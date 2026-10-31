# Indicadores · Índice CAC

El indicador de la Cámara Argentina de la Construcción: variación del costo de un edificio tipo en Capital Federal, base 100 = diciembre 2014, con tres series (Costo de Construcción, Materiales y Mano de Obra). Es el índice con que se ajustan las cuotas y los refuerzos de los inversores.

El módulo **solo lee**. Nunca escribe en la planilla.

## Fuente

Pestaña **"Índice CAC"** de la planilla **"Indicadores - REAL ESTATE"** (`1k0I2O86bJJzbXmPP8v197-VU1OlAtAbIIQV32FOp_HU`, propietaria mindlindevops@gmail.com). Es la misma que usan las fórmulas del Flujo de fondos (`IMPORTRANGE`). Para que la app la lea, tiene que estar compartida como Lector con la cuenta de servicio.

Cada mes son tres filas seguidas: "Costo de Construcción", "Materiales" y "Mano de Obra". La fecha está en una de las tres (en las viejas, como texto "ene-15"; en las nuevas, como fecha). Columnas: A período, B denominación, C índice, D variación mensual, E acumulado anual.

## Reglas

- **Variaciones:** se calculan de los índices (mensual contra el mes anterior, acumulado anual contra diciembre del año anterior, interanual contra el mismo mes del año anterior). Las de la planilla solo se usan para controlar.
- **Meses sin publicar:** se descartan los que no tienen las tres series o que repiten exactamente el mes anterior (la planilla deja copias, ceros, -1 y #DIV/0! en los meses futuros).
- **Provisorios:** los últimos tres meses publicados se marcan con (*), como la Cámara, porque pueden corregirse.
- **Calculadora:** monto × índice del mes final ÷ índice del mes inicial. Si el mes final no se publicó, usa el último publicado y lo dice. Las cuotas del Flujo usan el índice del mes anterior al de la cuota.
- **Controles:** meses que faltan en el medio de la serie y variaciones escritas en la planilla que no coinciden con los índices.

## Diferencia encontrada (31/10/2026)

La planilla tiene junio 2026 con el dato preliminar: Costo de Construcción 21.641,1 y Mano de Obra 18.327,3. La Cámara lo corrigió a 21.734,5 y 18.557,6 (Materiales sin cambios). Con el dato viejo, la variación de julio da 1,9% en vez de 1,5%. Por eso la carga automática, cuando exista, tiene que revisar también los meses provisorios ya cargados.

## Próximo paso: carga automática

Del 20 al 28 de cada mes, la app entra a la página de la Cámara (usuario y clave en Vercel, `CAC_USUARIO` y `CAC_CLAVE`), propone el dato nuevo (y las correcciones de los provisorios) y, con la aprobación de una persona, lo escribe en la planilla. Para eso la cuenta de servicio necesita permiso de Editor.

## Dónde está el código

- `lib/indicadores/cac.ts`: lectura, variaciones, controles y calculadora. Sin red; con tests en `cac.test.ts`.
- `lib/finanzas/fuente.ts` (`serieCac`): lee la pestaña con la cuenta de servicio y guarda la lectura 5 minutos.
- `GET /api/indicadores/cac` (`?fresco=1` vuelve a leer) y la pantalla `/indicadores/cac` (`components/indicadores/IndiceCac.tsx`).
- Variables opcionales: `INDICADORES_SHEET_ID` e `INDICADORES_TAB_CAC`.
