# Verificación del entorno de prueba

Fecha: 28/10/2026. App: https://mindlin-developers.vercel.app.

Se usó la API real de Claude y las integraciones reales de Drive y Sheets, con comprobantes **ficticios y sin valor fiscal**. No se utilizaron facturas ni una planilla real del cliente.

El responsable del proyecto indicó continuar con la planilla y la carpeta de prueba hasta disponer de los archivos del cliente.

## Resultados

| Comprobación | Resultado |
|---|---|
| Tests del repositorio | 38 tests en 6 archivos: pasan |
| TypeScript y build de producción | Pasan |
| Extracción desde imagen | Factura A en ARS: fecha, proveedor, CUIT, punto de venta, número, proyecto, neto, IVA y total leídos correctamente |
| Aprobación de la imagen | Archivo guardado en Drive y fila 2 agregada a la planilla con estado "En revisión" |
| Duplicados | La misma factura se mostró como duplicada y el servidor rechazó un nuevo intento de aprobación; no agregó otra fila |
| Extracción desde PDF | Nota de crédito A en USD: proyecto Güemes, tipo de cambio 1000, neto 100, IVA 21 y total 121 leídos correctamente |
| Aprobación del PDF | Archivo guardado en Drive y fila 3 agregada con importes negativos, moneda USD y tipo de cambio conservado |
| Acceso al script | Una llamada con secreto incorrecto respondió `{"ok":false,"error":"No autorizado"}` |
| Permisos de los comprobantes guardados | Cuenta propietaria y cuenta de servicio; sin permiso público en los metadatos revisados |
| Clave secundaria expuesta | Borrada de Google Cloud con autorización del responsable |

## Registros de prueba conservados

Planilla: [[PRUEBA] Facturación de Egresos](https://docs.google.com/spreadsheets/d/16LLVlh-d9OsMCRf6c2XXPs1dEwyN1gRQxOnkb2_qWYo/edit).

| Fila | Comprobante ficticio | Moneda | Neto | IVA 21% | Total | Proyecto |
|---|---|---|---:|---:|---:|---|
| 2 | Factura A 00099-99990001 | ARS | 1000 | 210 | 1210 | Lerma |
| 3 | Nota de crédito A 00099-99990002 | USD | -100 | -21 | -121 | Güemes |

La nota de crédito conserva tipo de cambio 1000. Ambas tienen estado "En revisión" y el enlace al archivo guardado. La planilla tenía solo sus encabezados antes de estas pruebas.

Los archivos se conservaron en la carpeta **Facturas (prueba)** para poder inspeccionar el resultado. Si se vuelven a cargar los mismos comprobantes, deben aparecer como duplicados.

## Límites de esta verificación

- Confirma que las integraciones funcionan; no mide la precisión con facturas reales ni reemplaza la evaluación del mes de muestra.
- El QR todavía no se lee desde la imagen o el PDF; el validador existente necesita recibir su texto.
- La lista de rubros, los CUIT receptores y las convenciones de importes siguen pendientes de confirmación con el cliente.
- La implementación actual puede admitir duplicados si dos aprobaciones pasan el control al mismo tiempo. Esta prueba verificó la carga repetida secuencial.
- Preview y Development no tienen toda la configuración de Production. El circuito completo se probó en Production apuntando a los archivos de prueba.

Configuración vigente: [configuracion.md](configuracion.md). Próximos pasos: [pendientes.md](pendientes.md).
