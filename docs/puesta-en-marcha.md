# Puesta en marcha

El código nuevo (cola de pendientes, web para revisar y subir, bot de Telegram, tres carpetas con subcarpetas por mes, columnas de la planilla real) ya está en `main` y Vercel lo despliega solo. **Configuración completada y verificada el 28/10/2026.** La app reconoce la cola, Apps Script v2, las dos pestañas contables y el bot activo. Los IDs y resultados están en el [informe de configuración](informe-configuracion-2026-10-28.md). Los pasos de abajo se conservan como referencia; no volver a crear los recursos que ya existen.

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

Los pasos 1 a 7, listos para pegarle a un agente con computer use (ChatGPT u otro), con el código del script incluido: [configurar-con-computer-use.md](configurar-con-computer-use.md).

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
