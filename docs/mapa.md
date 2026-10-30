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

## Qué falta, por prioridad

1. **Evaluar la IA con octubre.** Medir cuánto acierta con las 10 facturas reales antes de usarla en la planilla real. Necesita una clave de Anthropic en el entorno donde se corre (`ANTHROPIC_API_KEY`) y las facturas y la planilla de octubre en `muestras/2026-10/` ([scripts/eval/README.md](../scripts/eval/README.md)).
   - 30/10: no se pudo correr. En la sesión no estaba `ANTHROPIC_API_KEY` ni llegaron los archivos. La carpeta del cliente con los PDF no está compartida con mindlindevelopers.ia@gmail.com: solo la planilla .xlsx.
2. **Limpiar las pruebas.**
   - Hecho el 29/10: a la papelera las pruebas viejas de la cuenta de Axel ("Facturas (prueba)", "[PRUEBA] Facturación de Egresos" y el script viejo).
   - Hecho el 30/10, en la cuenta de Mindlin: Drive ordenado como arriba, las dos pruebas del 28/10 archivadas y a la papelera los 5 archivos de prueba de "Facturas Mindlin" (4 en "Pendientes" y 1 en "Facturas Compras Octubre 2026"). Las subcarpetas de mes no se tocan: el script podría reusar una carpeta que esté en la papelera.
   - Falta: las 5 filas de prueba de la cola (del 28/10, de axellaban@gmail.com). Las 4 "Para revisar" son copias de facturas reales de octubre (Costa Materiales 5-25853, JH 94 NC 1-5, Matías Mindlin C 1-114 y la venta 2-6) y, mientras no se descarten, la app avisa que esas facturas ya están: hay que tocar **Descartar** en cada una desde la web. La aprobada (Proveedor Ejemplo, ficticia) quedó como fila 230 de egresos en la copia de la planilla: borrarla a mano.
3. **Botones de Drive del Inicio.** Hecho el 30/10: los IDs de compras, honorarios y ventas están en `config/drive.json`. Ya no hace falta publicar la versión 3 del script.
4. **Acceso "Restringido"** en la carpeta y las dos planillas. Revisado el 30/10: todo restringido. Solo tienen acceso la dueña y, en las dos planillas, la cuenta de servicio como Editor.
5. **Pasar a la planilla real**, si la evaluación da bien: compartir "Administración Contable" con la cuenta de servicio como Editor y cambiar `SHEET_ID`, `SHEET_TAB_EGRESOS` y `SHEET_TAB_INGRESOS` en Vercel. El panel pasa a mostrar los números reales solo.
6. **Alta del equipo:** cada mail en `ALLOWED_EMAILS` (Vercel) y como usuario de prueba en la pantalla de consentimiento de Google. Después, cada uno conecta su Telegram con el QR del Inicio.
7. **Prueba final con una factura real**, por Telegram y por la web: fila en la planilla, PDF en la carpeta del mes, panel actualizado.

El panel se probó con números simulados. Si alguna fila de la planilla tiene la fecha vacía o imposible (la auditoría de octubre encontró una con 03/08/2062), ahora lo avisa solo, con link a la fila.

## Prompt para computer use (lo que falta, 30/10)

Para un agente con computer use en una compu con Chrome, con las sesiones abiertas de **axellaban@gmail.com** (Drive, Vercel, Google Cloud y claude.ai) y de **mindlindevelopers.ia@gmail.com** (Drive). Antes de pegarlo, completar `<MAILS DEL EQUIPO>`.

````
Vas a terminar de poner en marcha la app de facturas de Mindlin (https://mindlin-developers.vercel.app). Reglas: no borres nada definitivamente (solo papelera), no copies ni muestres claves o secretos, no cambies variables de Vercel salvo las que digo, y si algo pide pagar o no coincide con lo que espero, frená y avisame.

PASO 1. Evaluación de la IA (se corre en Claude Code, no la corrés vos)
1. En Chrome, con la cuenta axellaban@gmail.com en Drive, descargá (clic derecho > "Descargar"):
   - Carpeta "Facturas Compras Octubre": https://drive.google.com/drive/folders/1fta_Ws68vunGHjFCxqU8nfl3fb-S3C11
   - Carpeta "Facturas Ventas Octubre": https://drive.google.com/drive/folders/1krYdsyfl2J_21aBJWFNYilH65LdqL0oQ
   - Archivo "Copia para IA de Administración Contable - Mindlin Developers - LERMA 439.xlsx": https://drive.google.com/file/d/1y60VAg8yW10ce6sFcJssSVH_s7cv5T4d/view
   Descomprimí los dos .zip. Tienen que ser 10 PDF (9 + 1) y 1 .xlsx.
2. Abrí https://claude.ai/code y empezá una sesión nueva sobre el repo mindlindevelopersia/factura, en el mismo entorno de siempre (el que tiene la clave de Anthropic).
3. Adjuntá los 10 PDF y el .xlsx (arrastrándolos a la caja de texto) y mandá este mensaje:
   "Corré la evaluación de octubre (scripts/eval/README.md, 'Octubre de 2026') con estos archivos. Ponelos en muestras/2026-10/ (compras y ventas), nunca en git. Honorarios: 'Copia de HONORARIOS 10-26.pdf' y 'Copia de 27374235643_011_00001_00000045.pdf'. Resumime en pocas líneas el acierto por campo, separando errores de la IA de errores de carga de la planilla. Si hay errores de la IA que se corrijan en el prompt, corregilos, volvé a correr, mergeá a main y actualizá docs/mapa.md."
4. Esperá a que termine (puede tardar 10 minutos) y copiá su resumen para el informe. Si pide algo, contestá solo si la respuesta está en estas instrucciones; si no, anotalo.

PASO 2. Sacar las pruebas de la app
1. Abrí https://mindlin-developers.vercel.app (si pide iniciar sesión, entrá con Google como axellaban@gmail.com).
2. En "Bandeja" hay 4 comprobantes de prueba enviados el 28/10 por axellaban@gmail.com: Costa Materiales 5-25853, JH 94 (nota de crédito 1-5), Matías Mindlin (factura C 1-114) y la venta 2-6. Si coinciden, en cada uno tocá "Descartar" y confirmá. Si hay otros comprobantes, no los toques: anotalos.
3. En Drive con mindlindevelopers.ia@gmail.com abrí la planilla "[PRUEBA] Administración Contable - copia para la app" (https://docs.google.com/spreadsheets/d/1xCCxb2TRpjal_yydlZV7DqRG04MpgWESXG__pYLx_54/edit), pestaña "Facturación de Egresos (Compras)", fila 230. Si la razón social es "Proveedor Ejemplo", clic derecho en el número de fila > "Borrar fila". Si es otra cosa, no borres nada y avisame.

PASO 3. Alta del equipo
Mails a habilitar: <MAILS DEL EQUIPO>
1. Vercel (vercel.com, proyecto de mindlin-developers.vercel.app) > Settings > Environment Variables > Production > ALLOWED_EMAILS: agregá los mails que falten, separados por coma, sin sacar los que ya están. Guardá. Después Deployments > último de Production > "..." > "Redeploy" y esperá "Ready".
2. Google Cloud (console.cloud.google.com, proyecto "mindlin-developers", cuenta axellaban@gmail.com) > APIs y servicios > Pantalla de consentimiento de OAuth (o "Público") > Usuarios de prueba: agregá los mismos mails. No publiques la app.

PASO 4. Telegram
1. En la web, pestaña "Inicio", recuadro de Telegram. Si dice que el bot no está recibiendo mensajes, tocá "Activar bot".
2. Si en esta compu hay Telegram (app o https://web.telegram.org con sesión iniciada), tocá "¿Tenés Telegram en esta compu? Abrilo acá" y después "Iniciar" en el chat del bot. La web tiene que avisar "quedó conectado". Si no hay Telegram en la compu, saltealo y anotalo.

PASO 5. Prueba final
1. En la web, pestaña "Subir facturas", subí "Copia de FC 25853 MINDLIN.pdf" (de las de octubre). Esa factura ya está cargada en la planilla: la app tiene que leerla y avisar "Posible duplicado" sin dejar aprobarla. Anotá lo que muestra y después tocá "Descartar".
2. Si conectaste Telegram en el paso 4, mandale al bot "Copia de JH LERMA FACT 1OCT.pdf" como archivo. Anotá las señales: la respuesta "Recibida", la reacción 👀 sobre tu mensaje, "escribiendo…" y el mensaje "Leída" con un link. Abrí el link, verificá que muestre la factura y tocá "Descartar". La reacción tiene que desaparecer.
3. En "Inicio", tocá cada botón de arriba (Planilla y Drive) y anotá qué abre.

INFORME FINAL (sin secretos)
- Paso 1: el resumen de la evaluación que dio Claude Code, y si mergeó cambios.
- Paso 2: qué se descartó y si se borró la fila 230.
- Paso 3: mails agregados en Vercel y en Google Cloud, y si el redeploy quedó "Ready".
- Paso 4 y 5: lo que se vio en cada prueba, y cualquier error con su texto exacto.
- Lo que no se pudo hacer, y por qué.
````

Lo único que queda después es una decisión: **pasar a la planilla real** (punto 5 de la lista de arriba), con el resultado de la evaluación en la mano.
