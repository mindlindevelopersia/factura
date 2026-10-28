# Evaluación del extractor

Procesa un mes de comprobantes y compara, campo por campo, lo que propone la app (lo que lee la IA más lo que completa con la carga anterior de cada proveedor) contra lo que el equipo cargó a mano en la planilla. El resultado es el porcentaje de aciertos por campo.

```bash
npm run eval -- --dir muestras/2026-10 --mes 2026-10 --decimal punto
```

Necesita `ANTHROPIC_API_KEY` en el entorno o en `.env.local`. Cada factura cuesta entre US$0,02 y 0,04.

## Entrada

Una carpeta con:

- **Los comprobantes**, tal como llegan: `.pdf`, `.jpg`, `.jpeg`, `.png` o `.webp`. Pueden estar sueltos o en subcarpetas como las del Drive del equipo ("Facturas Compras Octubre", "Facturas Ventas Octubre", "Facturas de Honorarios..."). Si están en subcarpetas, también se mide si la app las clasifica en la categoría correcta.
- **La planilla en CSV**: cada pestaña exportada por separado (en Sheets, Archivo > Descargar > CSV, con la pestaña abierta). Por ejemplo `compras.csv` con "Facturación de Egresos (Compras)" y `ventas.csv` con "Facturación de Ingresos (Ventas)". Se leen todos los `.csv` de la carpeta, o los que se pasen con `--esperado`.

Con `--mes AAAA-MM`, se esperan solo las filas de ese mes, y las anteriores sirven de historial, como en producción. Sin `--mes`, se esperan todas las filas y no hay historial.

`muestras/` y `eval-out/` están en `.gitignore`. Los datos del cliente no se suben al repo.

### Octubre de 2026

Los datos están en la carpeta de Drive que pasó el cliente: 8 compras y 1 venta en PDF, y la "Copia para IA de Administración Contable". Para correrlo:

1. Bajar las dos subcarpetas a `muestras/2026-10/`, con sus nombres.
2. Abrir la copia de la planilla en Sheets y exportar a CSV las dos pestañas de facturación, como `muestras/2026-10/compras.csv` y `muestras/2026-10/ventas.csv`.
3. `npm run eval -- --dir muestras/2026-10 --mes 2026-10 --decimal punto` (la copia tiene formato en inglés: `1,234.56`).

En octubre la planilla tiene 17 comprobantes y la carpeta trae 9: las otras 8 filas aparecen en `filas_sin_archivo`.

### Formato de los CSV

- Separador `;`, `,` o tabulación (se detecta solo).
- Importes con decimal coma por defecto (`1.234,56`, como exporta Excel en español). Si vienen con punto, usar `--decimal punto`.
- Fechas `DD/MM/AAAA`, `DD/MM/AA` o `AAAA-MM-DD`.
- La primera fila tiene los encabezados. Se ignoran mayúsculas, acentos, espacios, `%`, `°` y `º`, así que sirven los encabezados de la planilla Administración Contable tal cual:

| Columna | Encabezados reconocidos | Cómo se compara |
|---|---|---|
| `archivo` | archivo | Nombre del archivo de la factura. Opcional, ver abajo. |
| `fecha_factura` | Fecha, Fecha factura, Fecha de la Factura | Misma fecha |
| `tipo_comprobante` | Tipo, Tipo de comprobante, Comprobante | "FC A", "Factura A", "NC B", "Nota de crédito B" son equivalentes. Si la planilla no tiene la letra ("Nota de Crédito "), no se compara la letra |
| `numero` | N°, Nro, Número, Nº Comprobante, Nº Comprobante / Operación | `0003-00001234` o solo `1234` |
| `punto_venta` | Punto de venta, PV | Opcional si `numero` ya trae el punto de venta |
| `razon_social` | Razón social, Proveedor | Sin acentos, puntuación ni tipo societario (S.A., S.R.L.); vale si una contiene a la otra |
| `cuit` | CUIT | Solo dígitos |
| `rubro` | Rubro, Rubro / Descripción | Mismo texto, sin distinguir mayúsculas ni acentos |
| `corresponde_a` | Corresponde a, Proyecto | Ídem |
| `cliente` | Cliente / Inversor / Razón Social | Como la razón social. Las filas con esta columna son de ventas |
| `cuit_receptor` | CUIT Receptor | Solo dígitos |
| `tipo_pago`, `depto` | Tipo de Pago, Depto adquirido | Mismo texto ("1-A" y "1 A" son iguales) |
| `concepto` | Concepto, Comentario | Aproximado: acierto si al menos la mitad de las palabras esperadas aparecen |
| `moneda` | Moneda | `$`, ARS, pesos = ARS; U$S, US$, USD, dólares = USD |
| `neto_gravado`, `no_gravado`, `iva_21`, `iva_10_5`, `percepcion_iva`, `percepcion_iibb_caba`, `percepcion_iibb_pba`, `total` | Neto gravado, No gravado, IVA 21%, IVA 10,5%, Percepciones IVA, IIBB CABA, IIBB PBA, Total, y los "Importe ..." y "Percepción IIBB Prov BSAS" de la planilla | Diferencia de hasta 0,01. Celda vacía = 0 |
| `importe_ventas` | Importe (pestaña de ventas) | Neto gravado + no gravado. Ídem |

Las demás columnas (forma de pago, banco, retención, etc.) se ignoran. Un campo de texto vacío en la planilla no se compara. Si la planilla del cliente usa otros encabezados, renombrarlos en el CSV o agregarlos a `ALIAS` en `compare.ts`.

### Cómo se empareja cada factura con su fila

1. Si el CSV tiene la columna `archivo`, por nombre de archivo.
2. Si no, con la misma clave que usa la app para los duplicados: CUIT del proveedor + tipo (factura, nota de crédito o de débito) + punto de venta + número; en ventas, sin el CUIT. Si la IA lee mal alguno de esos datos, la factura queda en `sin_fila_esperada`.

Ejemplo:

```csv
Fecha factura;Tipo de comprobante;N°;Razón social;Rubro;CUIT;Concepto;Moneda;Neto gravado;No gravado;IVA 21%;IVA 10,5%;Percepciones IVA;IIBB CABA;IIBB PBA;Total
15/09/2026;FC A;0003-00001234;CORRALON EJEMPLO SA;Materiales;33-69345023-9;Cemento y arena;$;1.000,00;;210,00;;30,00;;25,50;1.265,50
```

## Opciones

| Opción | Por defecto | |
|---|---|---|
| `--dir` | (obligatoria) | Carpeta con las facturas |
| `--esperado` | Los `.csv` de `<dir>` | CSV con una pestaña de la planilla. Se puede repetir |
| `--mes` | (todas las filas) | `AAAA-MM`: el mes que se evalúa. Las filas anteriores son el historial |
| `--salida` | `eval-out/<nombre de la carpeta>` | Dónde guardar extracciones y reporte |
| `--decimal` | `coma` | `coma` o `punto` |
| `--concurrencia` | `4` | Facturas procesadas en paralelo |
| `--rehacer` | no | Vuelve a llamar a la IA aunque ya haya una extracción guardada |

Las extracciones quedan guardadas en `<salida>/extracciones/`. Volver a correr el script no vuelve a pagar por ellas: sirve para ajustar la comparación sin costo. Usar `--rehacer` después de cambiar el prompt o el esquema.

## Salida

- En consola, la tabla de aciertos por campo y un resumen.
- `<salida>/reporte.json`: lo mismo, más los errores de extracción, las facturas sin fila, cuántas fallaron los controles de CUIT y de suma, cuántas usaron el fallback y el costo estimado.
- `<salida>/diferencias.csv`: cada campo que no coincidió, con el valor esperado y el obtenido. Es lo primero que hay que mirar para decidir si el error es de la IA, de la comparación o de la carga manual.
