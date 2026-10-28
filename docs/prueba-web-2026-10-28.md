# Prueba funcional desde la web — 28/10/2026

**Resultado: pasó el circuito web probado.** Se usó Chrome con computer use, el sitio de producción `https://mindlin-developers.vercel.app/` y la copia contable de prueba configurada en Production. Las cargas y la aprobación se hicieron con los botones de la web; las lecturas de Sheets se usaron después para verificar el resultado.

## Cuatro PDF reales

Se descargaron las muestras de las carpetas compartidas del cliente y se seleccionaron juntas en **Subir → Elegir archivos**. Los cuatro PDF quedaron leídos, con vista previa y en **Para revisar**. Se compararon contra los PDF originales y los registros de la cola.

| Muestra | Resultado observado |
|---|---|
| Costa Materiales, Factura A 00005-00025853 | Compra; fecha 01/10/2026; neto 37.306,01, IVA 21% 7.834,26, total 45.140,27. Concepto «Cemento y pinceleta». Detectó duplicado en egresos, fila 214. |
| Matías Mindlin, Factura C 00001-00000114 | Honorarios de administración, HQ; fecha 30/09/2026; no gravado 2.500.000, sin IVA, total 2.500.000. Detectó duplicado en egresos, fila 212. |
| Mindlin, Factura A 00002-00000006 | Venta; fecha 06/10/2026; neto 15.169.108,98, IVA 10,5% 1.592.756,44, total 16.761.865,42. Recuperó del historial MARTÍN MIRANDA, Amortización y depto 1 A. Detectó duplicado en ingresos, fila 7, pese a la diferencia de centavos de la carga manual. |
| JH 94 Constructora, Nota de crédito A 00001-00000005 | Compra y nota de crédito; fecha 06/10/2026; neto 33.938.895,21, IVA 10,5% 3.563.584, total 37.502.479,21. Detectó duplicado en egresos, fila 220, donde los importes ya están negativos. |

Se intentó **Aprobar y cargar** la venta duplicada. La app respondió «Esta factura ya está cargada en la planilla (fila 7)» y conservó el comprobante pendiente. No agregó otra fila.

Se volvió a seleccionar `compra.pdf` desde la web. Respondió **Ya estaba** y que el mismo archivo ya estaba en la cola. No se creó otro ítem: quedaron cinco en total, los cuatro PDF y la imagen ficticia del apartado siguiente.

## Aprobación y archivado sin duplicar movimientos reales

Como los cuatro PDF reales ya estaban registrados, se usó `comprobante-prueba.png`, rotulado **DATOS FICTICIOS — SIN VALOR FISCAL**, más un comentario explícito de prueba en copia contable. Se conservaron los números e importes de los documentos reales.

- Factura ficticia A `00099-99990001`, Proveedor Ejemplo S.A., fecha 27/10/2026, neto 1.000, IVA 210 y total 1.210 ARS.
- La IA señaló correctamente que era un comprobante de prueba, sin CAE ni receptor. Se aprobó deliberadamente solo en la copia de prueba.
- La web confirmó **Cargada en "Facturación de Egresos (Compras", fila 230**. El historial muestra **Aprobada**, origen Web, total 1.210 y enlace a Drive.
- Lectura posterior de Sheets: fechas reales con formato `dd/mm/yyyy`, número conservado como texto, importes numéricos, `Monto a Transferir` con fórmula `=T230-U230` y texto **Link** con hipervínculo al archivo.
- Drive, abierto con `mindlindevelopers.ia@gmail.com`, confirmó la ruta **Facturas Mindlin / Facturas de Compras / Facturas Compras Octubre 2026** y el archivo `2026-10-27 Proveedor Ejemplo S.A. - Factura A 00099-99990001.png`, propiedad de esa cuenta.
- La cola confirmó el estado `aprobada` y el resultado con fila 230.

La comparación antes/después confirmó sin cambios los valores de egresos A210:AF229 y de ingresos A1:AD18. Solo se agregó la fila ficticia 230 en la copia. No se editó el XLSX original ni se borraron filas o archivos.

## Estado que queda y alcance

La web queda mostrando el historial. Los cuatro PDF reales siguen pendientes para inspeccionar los avisos de duplicado; **ya estaban contabilizados y no deben aprobarse otra vez**. La única fila nueva es la prueba ficticia. Las evidencias visuales y lecturas de comprobación están fuera del repositorio, en `../evidencia/facturas-web/`.

Esto verifica carga múltiple de PDF, carga de imagen, lectura y clasificación de cuatro muestras reales, recuperación de datos del historial, detección de duplicados en planilla y por archivo, aprobación de una compra ficticia, escritura/formato/fórmula y archivado mensual en la cuenta de Mindlin.

No equivale a una evaluación completa de octubre ni a probar Telegram personal, fotos difíciles, audio, descartes, aprobación simultánea o archivado de las tres categorías. La nota de crédito generó una observación de IA innecesaria sobre un redondeo de milésimas, aunque extrajo correctamente los importes y la suma. La revisión humana sigue siendo parte del flujo.
