# Indicadores · Panorama y Materiales

El inicio del área Indicadores (`/indicadores`) compara índices entre sí; **Materiales** (`/indicadores/materiales`) dice si es momento de comprar cada material. Los dos solo leen.

## Series

| Serie | De dónde sale | Respaldo |
|---|---|---|
| CAC general, materiales y mano de obra | Pestaña "Índice CAC" de "Indicadores - REAL ESTATE" ([indicadores-cac.md](indicadores-cac.md)) | — |
| Inflación (IPC nacional, nivel general) | En línea: API de Series de Tiempo de datos.gob.ar (INDEC, serie `148.3_INIVELNAL_DICI_M_26`) | Pestaña "IPC" |
| Dólar blue y oficial | En línea: ArgentinaDatos (`/v1/cotizaciones/dolares/blue` y `/oficial`), último valor de venta de cada mes | Pestañas "Tipo de Cambio Blue" y "Tipo de Cambio Oficial" (tabla "mes a mes") |
| Hormigón H30 y hierro 12 mm (y los 50 materiales) | Pestaña "Precios Medios" | — |

Las fuentes en línea se consultan desde el servidor (Vercel). Si no responden, se usa la planilla; si responden, la planilla completa los meses que falten. La sección "De dónde sale cada dato" muestra la fuente y el último mes de cada serie.

**Estado de la planilla (31/10/2026):** IPC hasta julio 2025, dólar blue hasta octubre 2025, oficial hasta enero 2026, Precios Medios hasta mayo 2025. Por eso hacen falta las fuentes en línea y actualizar Precios Medios.

La pestaña "IPC" tiene los títulos de mes cargados como fechas raras ("dic-16" quedó como 16/12 del año en curso): se toma el primero y se cuentan los siguientes de a uno.

## Panorama

- **Período:** atajos (12 meses, 24 meses, 3 años, 5 años) o desde/hasta. El final por defecto es el último CAC.
- **Titulares:** CAC contra la inflación, CAC en dólares blue y dólar blue contra la inflación: (1 + variación A) ÷ (1 + variación B) − 1. Las dos series se miden en el mismo período: si una termina antes, las dos se cortan en ese mes y se aclara.
- **¿Qué subió más?:** la variación de cada serie en el período, de mayor a menor (con "hasta …" si no llega al final).
- **Comparación:** todas las series en base 100 al principio del período.
- **¿Es momento de comprar?:** las alarmas del hormigón y el hierro.

## Materiales: la alarma

Como lo armó Tadeo en "Análisis Hormigón H30" y "Análisis Hierro", pero calculado por fecha (sus fórmulas apuntan a filas fijas de la pestaña del CAC y algunas quedaron corridas):

- **Con pesos ajustados por CAC:** precio × CAC del último mes con precio ÷ CAC del mes. Si subió menos que la construcción, está relativamente barato. Es la lectura que importa si se compra con plata de cuotas que se ajustan por CAC.
- **En dólares blue:** precio ÷ dólar blue del mes. Es la lectura que importa si se compra con dólares.
- Para cada lectura, en qué parte de su historia de los últimos 6 años está el precio de hoy (percentil): **barato** si está entre el 25% más barato, **caro** si está entre el 25% más caro, **normal** si no.
- **Señal:** si las dos lecturas coinciden (o una es normal), esa; si una dice barato y la otra caro, "depende de con qué plata se compre". Con los datos de mayo 2025, el hormigón y el hierro están en su punto más barato contra el CAC y caros en dólares: depende.
- Se muestran la mediana ("lo habitual"), el mínimo y el máximo con su fecha, y la historia de las dos lecturas.
- Si el último precio tiene más de dos meses de atraso respecto del último CAC, se avisa.

Los umbrales y los años de historia están en `lib/indicadores/materiales.ts` (`UMBRAL_BARATO`, `UMBRAL_CARO`, `ANIOS_HISTORIA`).

## Dónde está el código

- `lib/indicadores/series.ts`: lectores de las pestañas y de las fuentes en línea, ranking, base 100 y comparaciones. Sin red; tests en `series.test.ts`.
- `lib/indicadores/materiales.ts`: la alarma. Sin red.
- `lib/finanzas/fuente.ts` (`datosPanorama`): lee las pestañas y las fuentes en línea y guarda la lectura 5 minutos.
- `GET /api/indicadores/panorama` y las pantallas `components/indicadores/Panorama.tsx` y `Materiales.tsx`; el gráfico de líneas común está en `GraficoLineas.tsx`.
