# Puesta en marcha (cambios del 29/10/2026)

El código nuevo (cola de pendientes, web para revisar y subir, bot de Telegram, tres carpetas con subcarpetas por mes, columnas de la planilla real) ya está en `main` y Vercel lo despliega solo. **Hasta hacer estos pasos, la app no puede recibir comprobantes:** le faltan la planilla de la cola, el script de Apps Script en versión 2 y las pestañas de la planilla.

Nada de esto toca la planilla real del cliente: se trabaja sobre una copia.

## Qué hay que hacer

| # | Dónde | Qué | Quién |
|---|---|---|---|
| 1 | Drive de mindlindevelopers.ia@gmail.com | Crear "Facturas Mindlin" con cuatro carpetas adentro: Pendientes, Facturas de Compras, Facturas de Honorarios de Administración, Facturas de Ventas | Prompt de abajo |
| 2 | Apps Script, misma cuenta | Pasar el script "Guardar facturas Mindlin" a la versión 2 y cargar las cuatro carpetas | Prompt de abajo |
| 3 | Sheets, misma cuenta | Guardar como Hojas de cálculo de Google una copia de la "Copia para IA de Administración Contable": es la planilla de prueba con la estructura real | Prompt de abajo |
| 4 | Sheets, misma cuenta | Crear una planilla vacía "Facturas Mindlin - cola de la app" | Prompt de abajo |
| 5 | Las dos planillas | Compartirlas con `facturas-app@mindlin-developers.iam.gserviceaccount.com` como Editor | Prompt de abajo |
| 6 | Vercel, Production | `SHEET_ID` (la copia del paso 3), `SHEET_TAB_EGRESOS`, `SHEET_TAB_INGRESOS`, `COLA_SHEET_ID` (la del paso 4). `TELEGRAM_API_KEY` ya está. Después, redeploy | Prompt de abajo |
| 7 | La app, en https://mindlin-developers.vercel.app | Pestaña "Subir": "Activar bot". Cada persona: "Conectar mi Telegram" | Cada usuario |
| 8 | La app | Probar de punta a punta (abajo) | Responsable del proyecto |

## Prompt para computer use

Hace los pasos 1 a 6. Reemplazá `<URL DE LA COPIA PARA IA>` por el link de la "Copia para IA de Administración Contable" que pasó el cliente.

````
Necesito dejar lista la configuración de la app "Facturas Mindlin" (https://mindlin-developers.vercel.app). Trabajá en Chrome con la cuenta de Google mindlindevelopers.ia@gmail.com. Si no está abierta, frená y preguntame.

Reglas: no copies valores secretos (claves, tokens) en el informe. No borres nada. Si algo pide pagar o permisos de administrador, frená y preguntame. No toques la planilla original del cliente: solo una copia.

1. Carpetas. En drive.google.com creá una carpeta "Facturas Mindlin" y adentro cuatro carpetas: "Pendientes", "Facturas de Compras", "Facturas de Honorarios de Administración" y "Facturas de Ventas". Anotá el ID de las cuatro (lo que está después de /folders/ en la URL).

2. Script. Entrá a https://script.google.com y abrí el proyecto "Guardar facturas Mindlin" (ID 1gCnlM-tgv2n45WKKe4LEpq8jcI0TH7yakOJYd9Xkjj-3zP3wYuOHL2FJ).
   a. Reemplazá todo el contenido de Código.gs por el archivo apps-script/guardar-factura.gs del repositorio mindlindevelopersia/factura (rama main). Tiene que empezar con "Guarda y ordena en Drive los comprobantes que manda la app (versión 2)". Guardá.
   b. En "Configuración del proyecto > Propiedades del script", agregá CARPETA_PENDIENTES, CARPETA_COMPRAS, CARPETA_HONORARIOS y CARPETA_VENTAS con los ID del paso 1. No borres CARPETA_ID ni SECRET.
   c. Volvé al editor, elegí la función "probar" y tocá "Ejecutar". Si pide permisos nuevos, aceptalos con mindlindevelopers.ia@gmail.com ("Configuración avanzada > Ir a Guardar facturas Mindlin"). En el registro tienen que aparecer cuatro "OK".
   d. "Implementar > Administrar implementaciones", editá la implementación activa (el lápiz), en "Versión" elegí "Versión nueva" y tocá "Implementar". Confirmá que la URL de la aplicación web sigue siendo la misma que antes.

3. Planilla de prueba. Abrí <URL DE LA COPIA PARA IA>. Si mindlindevelopers.ia@gmail.com no tiene acceso, frená y avisame. Si se abre como .xlsx, usá "Archivo > Guardar como Hojas de cálculo de Google"; si ya es de Google, "Archivo > Hacer una copia". Que la copia quede en "Mi unidad" de mindlindevelopers.ia@gmail.com con el nombre "[PRUEBA] Administración Contable - copia para la app". Anotá su ID (lo que está entre /d/ y /edit) y el nombre exacto, letra por letra, de las pestañas de facturación de compras y de ventas (empiezan con "Facturación de Egresos" y "Facturación de Ingresos").

4. Planilla de la cola. Creá una hoja de cálculo nueva y vacía llamada "Facturas Mindlin - cola de la app". Anotá su ID. No le agregues nada: la app crea sus pestañas.

5. Compartí las dos planillas (pasos 3 y 4) con facturas-app@mindlin-developers.iam.gserviceaccount.com como Editor, sin notificar.

6. En vercel.com, en el proyecto de la app, "Settings > Environment Variables", para Production:
   - SHEET_ID: el ID del paso 3 (reemplaza el valor actual).
   - SHEET_TAB_EGRESOS y SHEET_TAB_INGRESOS: los nombres exactos de las pestañas del paso 3.
   - COLA_SHEET_ID: el ID del paso 4.
   Confirmá que TELEGRAM_API_KEY, APPS_SCRIPT_URL y APPS_SCRIPT_SECRET existen (sin mostrar sus valores). Después andá a "Deployments" y hacé "Redeploy" del último deploy de producción.

INFORME FINAL (sin secretos)
- ID de las cuatro carpetas.
- Resultado de "probar" y confirmación de que la URL del script no cambió.
- ID de la planilla de prueba y nombres exactos de las dos pestañas.
- ID de la planilla de la cola y confirmación de que las dos planillas están compartidas con la cuenta de servicio.
- Variables cargadas en Vercel y si el redeploy terminó bien.
- Cualquier paso que no se pudo hacer, y por qué.
````

Después, actualizar [configuracion.md](configuracion.md) con los ID del informe.

## Probar de punta a punta

La copia de la planilla ya tiene cargado octubre, así que sirve para probar contra el output real:

1. Entrar a la app, pestaña "Subir": tocar "Activar bot" y "Conectar mi Telegram" (abre el bot; tocar "Iniciar"). El bot contesta "Listo, este Telegram quedó conectado a ...".
2. Mandarle al bot uno de los PDF de octubre (por ejemplo FC 25853 de Costa Materiales). El bot contesta "Recibida", y al rato "Leída: ... Ojo: parece que ya está cargada en la planilla" con el link. En la web aparece en "Para revisar" con el aviso de duplicada y la fila (214).
3. En la copia, borrar las filas de octubre de la pestaña de compras (214 a 229) y de ventas (7 y 8). Volver a la web y recargar: el aviso de duplicada ya no está.
4. Revisar y aprobar. La fila tiene que quedar igual a la que estaba (salvo la fecha de registro, el concepto si el equipo lo abrevia, y las columnas que completa el equipo: forma de pago, banco, retención, "Pago?"), con "Monto a Transferir" como fórmula y el link como "Link". El PDF tiene que estar en "Facturas de Compras / Facturas Compras Octubre 2026" con el nombre estándar, y el bot avisa "Cargada en la planilla".
5. Subir por la web el PDF de la venta (30718811550_001_00002_00000006.pdf): tiene que proponer cliente "MARTÍN MIRANDA", tipo de pago "Amortización" y depto "1 A", e ir a la pestaña de ventas y a "Facturas de Ventas".
6. Descartar uno: el archivo va a la papelera de Drive y queda en "Historial".
7. Mandar al bot una factura con un texto en la foto ("es de la oficina") y después un audio: los dos aparecen en la ficha como comentarios. Volver a mandar el mismo PDF: el bot contesta que ya lo tiene y no aparece dos veces.

## Si algo falla

La web muestra sola el **estado de la configuración** cuando falta algo (también en "Subir > Revisar la configuración"): cada pieza con ✓ o ✗ y qué hacer. Por ejemplo, si la clave de Anthropic funciona, qué pestañas tiene la planilla, si el script es la versión 2 y qué carpetas le faltan.

| Mensaje | Qué falta |
|---|---|
| "Falta configurar en el servidor: COLA_SHEET_ID" | Paso 6 |
| "El script de Apps Script es de una versión anterior" | Paso 2d (versión nueva de la implementación) |
| "Apps Script: El archivo no está en las carpetas de la app" | Paso 2b: falta alguna carpeta en las propiedades |
| "Falta configurar la pestaña de ventas (SHEET_TAB_INGRESOS)" | Paso 6 |
| "La planilla no tiene una pestaña ..." | El nombre en `SHEET_TAB_EGRESOS` o `SHEET_TAB_INGRESOS` no coincide letra por letra |
| Error 403 de Google al listar | Paso 5: la planilla no está compartida con la cuenta de servicio |
| El bot no contesta | Paso 7: "Activar bot" desde la dirección de producción. En la pestaña "Subir" se ve el último error de Telegram |
| El bot dice "Todavía no conectaste tu Telegram" | "Conectar mi Telegram" en la web, con un mail que esté en `ALLOWED_EMAILS` |
