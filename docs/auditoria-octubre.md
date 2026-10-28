# Auditoría con los datos de octubre de 2026

Fecha: 29/10/2026. Datos: la "Copia para IA de Administración Contable" y las 9 facturas de octubre que pasó el cliente (8 compras y 1 venta). Los scripts y las lecturas de referencia quedaron fuera del repo, porque tienen datos del cliente.

## Qué hoja es el output

Se buscó cada factura de octubre (por número e importe) en las 19 pestañas:

| Pestaña | Qué tiene | ¿La replica la app? |
|---|---|---|
| **Facturación de Egresos (Compras)** | Las 8 compras, una fila por factura | **Sí**, columnas A a Y |
| **Facturación de Ingresos (Ventas)** | La venta | **Sí**, columnas A a O |
| Pagos por Inversor | La venta también aparece en el estado de cuenta del inversor (Martín Miranda), con tipo de cambio y equivalente en dólares | No: es el estado de cuenta de cada inversor, con cotización del día. Ver pendientes |
| Caja Flujos en Pesos | El pago de cada compra cuando se transfiere ("Transferencia Costa Material", "Pago EPCIR" por el monto neto de retención) | No: es el paso del pago, no el de la factura |
| Las otras 15 | Flujos, análisis, inversores, caja chica. Varias sin movimiento desde 2025 ("Gestión de Pagos", "Análisis Miranda") | No |

Ninguna otra pestaña tiene las facturas de octubre.

## Las 9 facturas, celda por celda

Para cada factura se armó la lectura que debería dar la IA, transcrita del PDF. Se pasó por toda la app (categoría, historial con las filas que estaban cargadas arriba en la planilla, fila final, duplicados, carpeta y nombre del archivo) y se comparó contra la fila que cargó el equipo. Se dejaron afuera las columnas que completa el equipo (forma de pago, banco, retención, comprobante de retención, "Pago?").

**169 de 175 celdas iguales (96,6%).** Las 6 diferencias:

| Factura | Columna | Planilla | App | Por qué |
|---|---|---|---|---|
| Costa Materiales 25853 | Concepto | Cemento | Cemento y pinceleta | La factura trae cemento y una pinceleta; el equipo abrevió |
| JH 94 Constructora 74 | Concepto | 2da certificación Septiembre | Trabajos realizados obra Lerma | El PDF no dice el número de certificación |
| JH 94 Constructora 77 | Concepto | Certificación 16 | 1ra certificación Octubre | Ídem |
| Desarrolladora Adrian 162 | Concepto | Certificación 16 | Trabajos realizados | Ídem |
| Venta 00002-00000006 | Importe | 15.169.108,89 | 15.169.108,98 | **Error de carga en la planilla**: la factura dice ,98 |
| Venta 00002-00000006 | Importe Total | 16.761.865,32 | 16.761.865,42 | Ídem |

Todo lo demás coincide: categoría, tipo, número, razón social, rubro, CUIT, "corresponde a", moneda, importes y total, el cliente "MARTÍN MIRANDA", tipo de pago "Amortización" y depto "1 A" de la venta. El "Monto a Transferir" con la fórmula `=T-U` da lo mismo que la planilla. Ninguna factura aparece como duplicada antes de cargarse, y todas aparecen como duplicadas (con su fila) contra la planilla completa.

En las dos de Costa Materiales, la lectura de referencia decía "HQ" en "corresponde a" a propósito (la factura tiene como lugar de entrega la oficina): el historial lo corrigió a "Lerma 439", como lo carga el equipo.

**La auditoría encontró un error y se corrigió:** la regla de "concepto repetido" le habría puesto "2da certificación Septiembre" a la certificación de octubre de JH 94, porque las dos cargas anteriores lo repetían. Ahora no se aplica a conceptos de un período (certificaciones, cuotas, meses).

## Backtest del historial (218 filas)

Para cada fila de egresos con CUIT, lo que habría propuesto la app con lo que estaba cargado arriba:

| Dato | Aciertos |
|---|---|
| Hay carga anterior del mismo CUIT | 168 de 218 (77%) |
| Rubro | 163 de 168 (97%) |
| Corresponde a | 165 de 168 (98%) |
| Razón social, escrita igual | 161 de 168 (96%) |
| Concepto, cuando se toma del historial | 53 de 56 (95%) |

Los desaciertos son, sobre todo, cambios del propio equipo (un mismo proveedor con dos rubros distintos en distintos meses).

Con la regla anterior (dos cargas iguales, también para materiales) el concepto acertaba 75 de 88 (85%): Costa Materiales vende cosas distintas cada vez. Se cambió a tres cargas iguales y no para proveedores de materiales.

**Duplicados:** con número sin total, la app habría bloqueado una liquidación de Banco Nación legítima, que repite el número 00005-00165220 en agosto con otro importe. Ahora es duplicada solo si coincide también el total (±$1); si coincide solo el número, avisa y deja cargar. En toda la planilla quedaría bloqueada una sola fila: una factura de honorarios cargada dos veces.

## Lo que falta medir

La lectura de la IA. Lo de arriba usa una lectura de referencia transcrita de los PDF; para medir cuánto se parece la de Claude hay que correr `npm run eval` con `ANTHROPIC_API_KEY` (ver `scripts/eval/README.md`, "Octubre de 2026"). Lo que más hay que mirar ahí: el concepto (el equipo usa etiquetas propias) y "corresponde a" de proveedores nuevos.
