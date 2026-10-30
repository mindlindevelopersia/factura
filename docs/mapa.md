# Mapa del sistema

Qué hay en Google Drive, qué toca la app en las planillas y qué falta. Si es la primera vez que mirás el proyecto, empezá por acá.

## En una frase

Las facturas llegan por Telegram o por la web, la IA las lee y quedan en la **bandeja** para revisar. Recién cuando una persona aprueba, la app **agrega una fila en la planilla contable** y **mueve el PDF a la carpeta de su mes** en Drive. Antes de aprobar no escribe nada en la planilla contable.

## Qué hay en el Drive de mindlindevelopers.ia@gmail.com

| Archivo | Qué es | ¿Lo usa la app? | ¿Lo abre el equipo? |
|---|---|---|---|
| **Facturas Mindlin** (carpeta) | Los PDF y fotos. Adentro: "Pendientes" (lo que espera revisión), "Facturas de Compras", "Facturas de Honorarios de Administración" y "Facturas de Ventas", cada una con subcarpetas por mes ("Facturas Compras Octubre 2026") | Sí | Sí, para buscar un comprobante |
| **[PRUEBA] Administración Contable - copia para la app** | Copia de la planilla contable del cliente. Es donde la app carga las facturas aprobadas mientras se prueba. Cuando se pase a la real, se reemplaza por "Administración Contable" | Sí (lee y escribe) | Sí: es "la planilla" |
| **Facturas Mindlin - cola de la app** | Planilla interna de la app: la bandeja, las cuentas de Telegram conectadas y los candados contra duplicados | Sí | No hace falta. No editarla a mano |
| **Guardar facturas Mindlin** (script) | El programa que guarda, mueve y descarta los PDF en Drive a nombre de esta cuenta. Hace falta porque la app no tiene espacio propio en un Drive de Gmail | Sí | No. Solo se toca para actualizarlo |
| **Facturas Mindlin (prueba)** (carpeta) | La carpeta de la primera prueba (28/10), antes de las tres categorías | No | No. Archivada |
| **[PRUEBA] Facturación de Egresos - Mindlin** | La planilla de la primera prueba, con columnas inventadas, antes de tener la del cliente | No: `SHEET_ID` apunta a la copia nueva (ahí escribió la última aprobación de prueba) | No. Archivada |

Los íconos de "compartido" (dos personas) de las planillas y del script son normales: las planillas están compartidas con la cuenta de servicio de la app, que es como la app las lee y escribe.

En el Drive de axellaban@gmail.com quedan los respaldos de las pruebas del 27 y 28/10 ("Facturas (prueba)", "[PRUEBA] Facturación de Egresos" y otro "Guardar facturas Mindlin" con la implementación archivada). La app ya no los usa; Axel los puede borrar cuando quiera.

### Cómo queda ordenado

Mover un archivo en Drive no cambia su ID, así que la app sigue funcionando igual. Quedó así el 30/10 (IDs en [configuracion.md](configuracion.md)):

```
Mi unidad
└── App de facturas
    ├── Facturas Mindlin                 ← los PDF, por categoría y mes
    ├── [PRUEBA] Administración Contable - copia para la app   ← la planilla
    ├── Sistema (no tocar)
    │   ├── Facturas Mindlin - cola de la app
    │   └── Guardar facturas Mindlin
    └── Archivo - pruebas del 28-10
        ├── Facturas Mindlin (prueba)
        └── [PRUEBA] Facturación de Egresos - Mindlin
```

## Qué toca la app en las planillas

### La planilla contable (`SHEET_ID`)

Hoy es "[PRUEBA] Administración Contable - copia para la app"; cuando se pase a la real, "Administración Contable". De sus pestañas, la app usa **solo dos**:

| Pestaña | Escribe | Lee |
|---|---|---|
| **Facturación de Egresos (Compras)** | Una fila por cada **compra** u **honorario de un socio** aprobado, columnas A a Y | Lo ya cargado (también a mano) para no duplicar, para proponer rubro, razón social y "corresponde a" de cada proveedor, y para el panel |
| **Facturación de Ingresos (Ventas)** | Una fila por cada **venta** aprobada, columnas A a O | Lo mismo, para ventas |

Cómo escribe:

- Solo al aprobar, en la **primera fila vacía**, con el formato de la fila de arriba, como cuando se carga a mano.
- **Nunca modifica ni borra filas existentes.**
- Completa fechas, tipo y número, razón social o cliente, rubro, CUIT, concepto, "corresponde a", moneda, importes, total y el link al PDF (como "Link").
- En egresos escribe la fórmula de "Monto a Transferir" (`=T-U`).
- Deja vacío lo que completa el equipo después: forma de pago, banco, retención, comprobante de retención y "Pago?".
- Las otras 17 pestañas (Caja Flujos en Pesos, Pagos por Inversor, etc.) **no las lee ni las toca**. Si en el futuro hace falta anotar una venta también en "Pagos por Inversor" o el pago en "Caja", está en las preguntas para el cliente de [pendientes](pendientes.md).

### La planilla de la cola (`COLA_SHEET_ID`)

"Facturas Mindlin - cola de la app". Es de uso interno y la app crea sus pestañas sola:

| Pestaña | Para qué |
|---|---|
| **Cola** | Una fila por comprobante recibido: quién lo mandó, cuándo, en qué estado está (leyendo, para revisar, aprobado, descartado) y lo que leyó la IA |
| **Telegram** | Qué cuenta de Telegram corresponde a qué mail |
| **Candados** | Registro corto que impide que dos personas carguen la misma factura a la vez. Aparece la primera vez que se usa |

## Estado al 30/10/2026

La evaluación y la limpieza ya se completaron. El detalle verificable está en [cierre-2026-10-30.md](cierre-2026-10-30.md).

- **Evaluación:** 17 PDF reales de octubre, 17 lecturas correctas, sin fallback, errores de extracción ni controles de CUIT o suma fallidos. Coincidencia contra la planilla: 289/298 campos (97%). Las nueve diferencias se revisaron contra los PDF: tres errores de la planilla y seis diferencias de concepto. No se modificó el prompt para inventar números de certificación que el documento no trae.
- **Pruebas:** se descartaron las cuatro copias de facturas reales del 28/10. Se eliminó únicamente la fila ficticia 230 de la copia contable; su registro de cola se conservó como descartado, con nota de auditoría y sin enlace a esa fila reutilizable. No se borró nada definitivamente de Drive.
- **Bandeja:** quedó sin pendientes tras probar nuevamente la recepción, detección de duplicado y descarte. La aprobación de Costa 25853 fue bloqueada por la fila 214 existente; la planilla no cambió durante la prueba.
- **Google:** axellaban@gmail.com, mindlindevelopers.ia@gmail.com y matimindlin111@gmail.com están como usuarios de prueba. Google Auth Platform permanece en estado "Prueba".
- **Vercel:** se agregó el correo de Mindlin a `ALLOWED_EMAILS` de Production y se conservaron los otros dos. Ninguna otra variable se cambió.
- **Drive:** script versión 2, cuatro destinos configurados; los botones usan los IDs de `config/drive.json`. No hace falta publicar la versión 3 para esos accesos.
- **Telegram:** bot `@mindlindevelopers_facturas_bot`, webhook activo, sin errores reportados. La cuenta de Axel ya estaba vinculada.

## Qué queda para la entrega definitiva

1. **Decidir el paso a la planilla real.** La app sigue en la copia de prueba por indicación del responsable. Compartir la definitiva con la cuenta de servicio como Editor y cambiar `SHEET_ID` y los nombres exactos de sus dos pestañas recién cuando se elija esa planilla.
2. **Acceso directo a Google del equipo.** Estar habilitado en la app no concede permisos en Drive o Sheets. Verificar con la cuenta de cada integrante los accesos directos; mantener restringidos los archivos internos del sistema.
3. **Criterios de negocio del cliente.** Siguen las preguntas de [pendientes.md](pendientes.md): pagos, retenciones, "Pagos por Inversor" y convenciones de concepto.
4. **Muestras fuera de octubre.** La evaluación actual no cubre fotos borrosas, moneda extranjera ni percepciones; conservar la revisión humana antes de aprobar.

El panel señala la fecha futura de egresos, fila 164. Es un dato de la planilla de origen y no se corrigió sin decisión del cliente.
