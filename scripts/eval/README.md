# Evaluación del extractor

Procesa un mes de facturas de compra y compara, campo por campo, lo que extrae la IA contra lo que se cargó a mano en la planilla. El resultado es el porcentaje de aciertos por campo.

```bash
npm run eval -- --dir muestras/2026-09
```

Necesita `ANTHROPIC_API_KEY` en el entorno o en `.env.local`. Cada factura cuesta entre US$0,02 y 0,04.

## Entrada

Una carpeta con:

- **Las facturas**, tal como llegan: `.pdf`, `.jpg`, `.jpeg`, `.png` o `.webp`. Otros archivos se ignoran.
- **`esperado.csv`**: la planilla de ese mes exportada a CSV, una fila por factura.

`muestras/` y `eval-out/` están en `.gitignore`. Los datos del cliente no se suben al repo.

### Formato de `esperado.csv`

- Separador `;`, `,` o tabulación (se detecta solo).
- Importes con decimal coma por defecto (`1.234,56`, como exporta Excel en español). Si vienen con punto, usar `--decimal punto`.
- Fechas `DD/MM/AAAA`, `DD/MM/AA` o `AAAA-MM-DD`.
- La primera fila tiene los encabezados. Se ignoran mayúsculas, acentos, `%` y `°`, así que sirven los encabezados de la planilla P02 tal cual:

| Columna | Encabezados reconocidos | Cómo se compara |
|---|---|---|
| `archivo` | archivo | Nombre del archivo de la factura. Opcional, ver abajo. |
| `fecha_factura` | Fecha, Fecha factura | Misma fecha |
| `tipo_comprobante` | Tipo, Tipo de comprobante, Comprobante | "FC A", "Factura A", "NC B", "Nota de crédito B" son equivalentes |
| `numero` | N°, Nro, Número | `0003-00001234` o solo `1234` |
| `punto_venta` | Punto de venta, PV | Opcional si `numero` ya trae el punto de venta |
| `razon_social` | Razón social, Proveedor | Sin acentos, puntuación ni tipo societario (S.A., S.R.L.); vale si una contiene a la otra |
| `cuit` | CUIT | Solo dígitos |
| `rubro` | Rubro | Mismo texto, sin distinguir mayúsculas ni acentos |
| `proyecto` | Proyecto | Ídem |
| `concepto` | Concepto | Aproximado: acierto si al menos la mitad de las palabras esperadas aparecen |
| `moneda` | Moneda | `$`, ARS, pesos = ARS; U$S, US$, USD, dólares = USD |
| `neto_gravado`, `no_gravado`, `iva_21`, `iva_10_5`, `percepcion_iva`, `percepcion_iibb_caba`, `percepcion_iibb_pba`, `total` | Neto gravado, No gravado, IVA 21%, IVA 10,5%, Percepciones IVA, IIBB CABA, IIBB PBA, Total | Diferencia de hasta 0,01. Celda vacía = 0 |

Las demás columnas (forma de pago, banco, retención, etc.) se ignoran. Un campo de texto vacío en la planilla no se compara. Si la planilla del cliente usa otros encabezados, renombrarlos en el CSV o agregarlos a `ALIAS` en `compare.ts`.

### Cómo se empareja cada factura con su fila

1. Si el CSV tiene la columna `archivo`, por nombre de archivo.
2. Si no, por CUIT emisor + punto de venta + número extraídos por la IA. Si la IA lee mal alguno de esos tres, la factura queda en `sin_fila_esperada`.

Ejemplo:

```csv
Fecha factura;Tipo de comprobante;N°;Razón social;Rubro;CUIT;Concepto;Moneda;Neto gravado;No gravado;IVA 21%;IVA 10,5%;Percepciones IVA;IIBB CABA;IIBB PBA;Total
15/09/2026;FC A;0003-00001234;CORRALON EJEMPLO SA;Materiales;33-69345023-9;Cemento y arena;$;1.000,00;;210,00;;30,00;;25,50;1.265,50
```

## Opciones

| Opción | Por defecto | |
|---|---|---|
| `--dir` | (obligatoria) | Carpeta con las facturas |
| `--esperado` | `<dir>/esperado.csv` | CSV con la planilla cargada |
| `--salida` | `eval-out/<nombre de la carpeta>` | Dónde guardar extracciones y reporte |
| `--decimal` | `coma` | `coma` o `punto` |
| `--concurrencia` | `4` | Facturas procesadas en paralelo |
| `--rehacer` | no | Vuelve a llamar a la IA aunque ya haya una extracción guardada |

Las extracciones quedan guardadas en `<salida>/extracciones/`. Volver a correr el script no vuelve a pagar por ellas: sirve para ajustar la comparación sin costo. Usar `--rehacer` después de cambiar el prompt o el esquema.

## Salida

- En consola, la tabla de aciertos por campo y un resumen.
- `<salida>/reporte.json`: lo mismo, más los errores de extracción, las facturas sin fila, cuántas fallaron los controles de CUIT y de suma, cuántas usaron el fallback y el costo estimado.
- `<salida>/diferencias.csv`: cada campo que no coincidió, con el valor esperado y el obtenido. Es lo primero que hay que mirar para decidir si el error es de la IA, de la comparación o de la carga manual.
