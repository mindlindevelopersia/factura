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
| **Facturas Mindlin (prueba)** (carpeta) | La carpeta de la primera prueba (28/10), antes de las tres categorías | No | No. Archivar |
| **[PRUEBA] Facturación de Egresos - Mindlin** | La planilla de la primera prueba, con columnas inventadas, antes de tener la del cliente | No, si `SHEET_ID` en Vercel ya apunta a la copia nueva | No. Archivar |

Los íconos de "compartido" (dos personas) de las planillas y del script son normales: las planillas están compartidas con la cuenta de servicio de la app, que es como la app las lee y escribe.

En el Drive de axellaban@gmail.com quedan los respaldos de las pruebas del 27 y 28/10 ("Facturas (prueba)", "[PRUEBA] Facturación de Egresos" y otro "Guardar facturas Mindlin" con la implementación archivada). La app ya no los usa; Axel los puede borrar cuando quiera.

### Cómo queda ordenado

Mover un archivo en Drive no cambia su ID, así que la app sigue funcionando igual. El prompt de abajo lo deja así:

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

## Qué falta

1. **Actualizar el script de Drive** (lo que en el código se llama "versión 3"). El script publicado es la versión 2: guarda y mueve los PDF bien, pero no le dice a la app dónde están las carpetas. Por eso los botones "Drive · Compras", "Drive · Honorarios" y "Drive · Ventas" del Inicio aparecen grisados. La versión 3 solo agrega eso; se pega el código nuevo y se publica, sin cambiar la URL. Va en el prompt de abajo.
2. **Ordenar el Drive y dejar todo en acceso "Restringido"**, también en el prompt de abajo. La app esconde los links de Google detrás del login, pero quién puede abrir un archivo lo decide Google: con acceso "Restringido", solo las cuentas invitadas.
3. **Revisar el Inicio una vez con la planilla de verdad.** El panel se probó con números simulados, porque desde el entorno de desarrollo no hay acceso a la planilla ni al login. Si alguna fila tiene la fecha vacía o imposible (la auditoría de octubre encontró una con 03/08/2062), el panel ahora lo avisa solo, con link a la fila. Lo único para mirar a ojo es que los totales de octubre coincidan con la planilla.

## Prompt para computer use

Pegarlo en un agente con computer use que tenga abierta la sesión de **mindlindevelopers.ia@gmail.com** en Chrome y acceso a Vercel.

````
Vas a actualizar un script de Google Apps Script y ordenar archivos en Google Drive, en la cuenta mindlindevelopers.ia@gmail.com. No borres nada. Si algo pide pagar, permisos de administrador o datos que no tenés, frená y preguntame.

PASO 1. Ver qué planilla usa la app
1. Entrá a vercel.com, abrí el proyecto de la app (dominio mindlin-developers.vercel.app), "Settings" > "Environment Variables", entorno Production.
2. Anotá el valor de SHEET_ID (es un ID de planilla, no es secreto). No cambies nada.

PASO 2. Actualizar el script "Guardar facturas Mindlin"
1. Entrá a https://script.google.com/home y abrí "Guardar facturas Mindlin" (ID 1gCnlM-tgv2n45WKKe4LEpq8jcI0TH7yakOJYd9Xkjj-3zP3wYuOHL2FJ).
2. Abrí Código.gs, seleccioná todo, borralo y pegá exactamente este código (desde "/**" hasta la última "}"):

/**
 * Guarda y ordena en Drive los comprobantes que manda la app (versión 3).
 *
 * Se publica como web app en la cuenta de Google dueña de las carpetas:
 *   Ejecutar como: Yo. Quién tiene acceso: Cualquier usuario.
 * Propiedades del script (Configuración del proyecto > Propiedades del script):
 *   CARPETA_PENDIENTES: donde esperan los comprobantes hasta que alguien los revisa.
 *   CARPETA_COMPRAS, CARPETA_HONORARIOS, CARPETA_VENTAS: una por categoría. Adentro, el
 *     script crea una subcarpeta por mes ("Facturas Compras Octubre 2026").
 *   CARPETA_ID: carpeta por defecto para la que falte (la única de la versión 1).
 *   SECRET: la misma clave que APPS_SCRIPT_SECRET en Vercel.
 * Pasos completos en apps-script/README.md.
 *
 * Acciones (campo "accion"):
 *   guardar   { carpeta, nombre, mimeType, base64 } -> { id, url }
 *   leer      { id } -> { nombre, mimeType, base64 }
 *   archivar  { id, carpeta, subcarpeta, nombre } -> { url }  (mueve y renombra)
 *   descartar { id }  (a la papelera)
 *   version   {} -> { carpetas: { pendientes, compra, honorarios, venta }, enlaces: { ... } }
 *             (qué carpetas están configuradas y sus links, para los accesos del panel; desde la versión 3)
 * Solo toca archivos que estén en las carpetas configuradas o en sus subcarpetas.
 */
var VERSION = 3;
var CARPETAS = {
  pendientes: 'CARPETA_PENDIENTES',
  compra: 'CARPETA_COMPRAS',
  honorarios: 'CARPETA_HONORARIOS',
  venta: 'CARPETA_VENTAS',
};

function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  try {
    var body = JSON.parse(e.postData.contents);
    if (!props.getProperty('SECRET') || body.secret !== props.getProperty('SECRET')) {
      return responder({ ok: false, error: 'No autorizado' });
    }
    var accion = body.accion || 'guardar';
    if (accion === 'version') {
      var carpetas = {};
      var enlaces = {};
      Object.keys(CARPETAS).forEach(function (k) {
        var id = props.getProperty(CARPETAS[k]) || props.getProperty('CARPETA_ID');
        carpetas[k] = !!id;
        if (id) enlaces[k] = 'https://drive.google.com/drive/folders/' + id;
      });
      return responder({ ok: true, carpetas: carpetas, enlaces: enlaces });
    }
    if (accion === 'guardar') {
      var blob = Utilities.newBlob(Utilities.base64Decode(body.base64), body.mimeType, body.nombre);
      var nuevo = carpetaPara(body.carpeta, body.subcarpeta).createFile(blob);
      return responder({ ok: true, id: nuevo.getId(), url: nuevo.getUrl() });
    }
    var archivo = DriveApp.getFileById(body.id);
    if (!esNuestro(archivo)) return responder({ ok: false, error: 'El archivo no está en las carpetas de la app' });
    if (accion === 'leer') {
      var contenido = archivo.getBlob();
      return responder({
        ok: true,
        nombre: archivo.getName(),
        mimeType: contenido.getContentType(),
        base64: Utilities.base64Encode(contenido.getBytes()),
      });
    }
    if (accion === 'archivar') {
      archivo.moveTo(carpetaPara(body.carpeta, body.subcarpeta));
      if (body.nombre) archivo.setName(body.nombre);
      return responder({ ok: true, url: archivo.getUrl() });
    }
    if (accion === 'descartar') {
      archivo.setTrashed(true);
      return responder({ ok: true });
    }
    return responder({ ok: false, error: 'Acción desconocida: ' + accion });
  } catch (err) {
    return responder({ ok: false, error: String(err) });
  }
}

function responder(datos) {
  datos.version = VERSION;
  return ContentService.createTextOutput(JSON.stringify(datos)).setMimeType(ContentService.MimeType.JSON);
}

/** IDs de las carpetas configuradas. */
function carpetasConfiguradas() {
  var props = PropertiesService.getScriptProperties();
  var ids = [];
  Object.keys(CARPETAS)
    .map(function (k) { return CARPETAS[k]; })
    .concat(['CARPETA_ID'])
    .forEach(function (nombre) {
      var id = props.getProperty(nombre);
      if (id) ids.push(id);
    });
  return ids;
}

/** La carpeta de una categoría y, si se pide, su subcarpeta (la crea si no existe). */
function carpetaPara(categoria, subcarpeta) {
  var props = PropertiesService.getScriptProperties();
  var id = (CARPETAS[categoria] && props.getProperty(CARPETAS[categoria])) || props.getProperty('CARPETA_ID');
  if (!id) throw new Error('No hay carpeta configurada para "' + categoria + '"');
  var base = DriveApp.getFolderById(id);
  if (!subcarpeta) return base;
  // Con el lock, dos facturas del mismo mes que llegan juntas no crean dos subcarpetas.
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var existentes = base.getFoldersByName(subcarpeta);
    return existentes.hasNext() ? existentes.next() : base.createFolder(subcarpeta);
  } finally {
    lock.releaseLock();
  }
}

/** true si el archivo está en una carpeta de la app o en una subcarpeta de ellas. */
function esNuestro(archivo) {
  var ids = carpetasConfiguradas();
  var padres = archivo.getParents();
  while (padres.hasNext()) {
    var padre = padres.next();
    if (ids.indexOf(padre.getId()) >= 0) return true;
    var abuelos = padre.getParents();
    while (abuelos.hasNext()) {
      if (ids.indexOf(abuelos.next().getId()) >= 0) return true;
    }
  }
  return false;
}

/** Para probar desde el editor: crea y borra un archivo en cada carpeta configurada. */
function probar() {
  var props = PropertiesService.getScriptProperties();
  ['CARPETA_PENDIENTES', 'CARPETA_COMPRAS', 'CARPETA_HONORARIOS', 'CARPETA_VENTAS', 'CARPETA_ID'].forEach(function (nombre) {
    var id = props.getProperty(nombre);
    if (!id) return Logger.log(nombre + ': sin configurar');
    var archivo = DriveApp.getFolderById(id).createFile('prueba.txt', 'prueba');
    Logger.log(nombre + ' OK: ' + archivo.getUrl());
    archivo.setTrashed(true);
  });
}

3. Guardá. No toques las "Propiedades del script".
4. "Implementar" > "Administrar implementaciones". Seleccioná la implementación activa (aplicación web), tocá el lápiz, en "Versión" elegí "Nueva versión", descripción "v3", y "Implementar". NO crees una implementación nueva.
5. Verificá que la URL de la aplicación web siga siendo https://script.google.com/macros/s/AKfycbzsCnZuxRzSt-FqtdK8_ycfCDdjPBP_vNkB5GqLgrkwYbQyVZ-CIe3Q1MixdIMN5RMl/exec. Si cambió, frená y avisame.

PASO 3. Ordenar el Drive
1. En drive.google.com, en "Mi unidad", creá la carpeta "App de facturas". Adentro, creá "Sistema (no tocar)" y "Archivo - pruebas del 28-10".
2. Mové (clic derecho > "Organizar" > "Mover") a "App de facturas": la carpeta "Facturas Mindlin" y la planilla "[PRUEBA] Administración Contable - copia para la app".
3. Mové a "App de facturas/Sistema (no tocar)": la planilla "Facturas Mindlin - cola de la app" y el script "Guardar facturas Mindlin".
4. Mové a "App de facturas/Archivo - pruebas del 28-10": la carpeta "Facturas Mindlin (prueba)". La planilla "[PRUEBA] Facturación de Egresos - Mindlin" movela ahí SOLO si su ID (lo que está entre /d/ y /edit en su URL) es distinto del SHEET_ID del paso 1. Si es el mismo, dejala donde está y avisame.
5. Si Drive avisa que al mover cambia quién tiene acceso, aceptá: los permisos de cada archivo se mantienen.

PASO 4. Acceso restringido
Para "App de facturas" (la carpeta), "[PRUEBA] Administración Contable - copia para la app" y "Facturas Mindlin - cola de la app": abrí "Compartir" y mirá "Acceso general". Tiene que decir "Restringido". Si dice "Cualquier persona con el vínculo", cambialo a "Restringido". No agregues ni quites personas: la cuenta facturas-app@mindlin-developers.iam.gserviceaccount.com tiene que seguir como Editor en las dos planillas.

PASO 5. Verificar en la app
1. Abrí https://mindlin-developers.vercel.app (si pide iniciar sesión y no hay una sesión de un mail habilitado, frená y pedime que inicie sesión yo).
2. En la pestaña "Inicio", arriba, los cinco botones (Planilla y Drive) tienen que estar negros. Si alguno está grisado, anotá el texto que aparece al pasar el mouse. Puede tardar hasta 10 minutos en actualizarse después del paso 2; si siguen grisados, esperá y recargá.
3. Tocá cada botón y anotá qué abre.

INFORME FINAL
- SHEET_ID del paso 1 y si coincide con "[PRUEBA] Administración Contable - copia para la app".
- Paso 2: si la URL del script quedó igual.
- Paso 3: dónde quedó cada archivo, y los ID de las carpetas "Pendientes", "Facturas de Compras", "Facturas de Honorarios de Administración" y "Facturas de Ventas" (lo que está después de /folders/ en la URL).
- Paso 4: el "Acceso general" de cada uno, antes y después.
- Paso 5: el estado de cada botón y qué abre.
````
