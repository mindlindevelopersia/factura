# Guardar los PDF en Drive con Apps Script

La cuenta de servicio no puede guardar archivos en un Drive de Gmail. Por eso la app usa este script, que se publica como web app en la cuenta dueña de las carpetas y trabaja a nombre de esa cuenta. Desde la versión 2 hace cuatro cosas: guarda cada comprobante en la carpeta de pendientes al llegar, lo lee para la vista previa de la web, al aprobarlo lo mueve a la carpeta de su categoría (compras, honorarios de administración o ventas) dentro de la subcarpeta del mes, y al descartarlo lo manda a la papelera. La app lo usa cuando están cargadas `APPS_SCRIPT_URL` y `APPS_SCRIPT_SECRET`. Si no están, carga las facturas en la planilla con el link vacío.

La cuenta elegida para este proyecto es **mindlindevelopers.ia@gmail.com**. Las carpetas, la planilla y el script deben pertenecer a esa cuenta. Los identificadores y el estado verificado están en [la configuración actual](../docs/configuracion.md).

El código es [`guardar-factura.gs`](guardar-factura.gs). Si se cambia, hay que pegarlo de nuevo en el editor de Apps Script y publicar una versión nueva (Implementar > Administrar implementaciones > editar > Versión nueva). La URL se mantiene.

## Prompt para computer use

Antes de pegarlo, reemplazá `<CUENTA>` por la cuenta de Google dueña de las facturas.

````
Necesito publicar un script de Google Apps Script que guarda en Drive los PDF de facturas que le manda una app (Facturas Mindlin, en https://mindlin-developers.vercel.app). Trabajá en Chrome con la cuenta de Google <CUENTA>. Si no está abierta, o no sabés cuál es, frená y preguntame.

Reglas: no escribas la clave secreta en el informe final ni en ningún otro lado que no sean los dos campos indicados. Si algo pide pagar o permisos de administrador, frená y preguntame.

1. En drive.google.com, con <CUENTA>, creá una carpeta "Facturas Mindlin" y adentro cuatro: "Pendientes", "Facturas de Compras", "Facturas de Honorarios de Administración" y "Facturas de Ventas". Anotá el ID de las cuatro: lo que está después de /folders/ en la URL.

2. Abrí una terminal y generá una clave con: openssl rand -hex 24
   Es la clave secreta: la vas a pegar en los pasos 5 y 8.

3. Entrá a https://script.google.com, tocá "Nuevo proyecto" y ponele el nombre "Guardar facturas Mindlin".

4. Borrá todo el contenido de Código.gs y pegá este código:

/**
 * Guarda y ordena en Drive los comprobantes que manda la app (versión 2).
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
 *   version   {} -> { carpetas: { pendientes, compra, honorarios, venta } }  (qué carpetas están configuradas)
 * Solo toca archivos que estén en las carpetas configuradas o en sus subcarpetas.
 */
var VERSION = 2;
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
      Object.keys(CARPETAS).forEach(function (k) {
        carpetas[k] = !!(props.getProperty(CARPETAS[k]) || props.getProperty('CARPETA_ID'));
      });
      return responder({ ok: true, carpetas: carpetas });
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

   Guardá con Ctrl+S.

5. Andá a "Configuración del proyecto" (el engranaje). En "Propiedades del script", agregá cinco:
   - CARPETA_PENDIENTES, CARPETA_COMPRAS, CARPETA_HONORARIOS y CARPETA_VENTAS: los ID del paso 1.
   - SECRET: la clave del paso 2.
   Guardá.

6. Volvé al editor, elegí la función "probar" en el menú de arriba y tocá "Ejecutar".
   - Google va a pedir autorización. Elegí <CUENTA>. Si aparece "Google no verificó esta app", tocá "Configuración avanzada" y después "Ir a Guardar facturas Mindlin (no seguro)". Es un script propio de esta cuenta, así que es normal. Aceptá los permisos.
   - En el registro de ejecución tiene que aparecer "OK: https://drive.google.com/..." para cada una de las cuatro carpetas. Si da error, anotalo.

7. Tocá "Implementar > Nueva implementación". En el engranaje de "Seleccionar tipo", elegí "Aplicación web".
   - Descripción: "v1".
   - Ejecutar como: "Yo (<CUENTA>)".
   - Quién tiene acceso: "Cualquier usuario". No hace falta que tenga cuenta de Google: la app no inicia sesión, y la clave secreta protege el script.
   - Tocá "Implementar" y copiá la "URL de la aplicación web" (termina en /exec).

8. En vercel.com, en el proyecto de la app, andá a "Settings > Environment Variables" y agregá para Production:
   - APPS_SCRIPT_URL: la URL del paso 7.
   - APPS_SCRIPT_SECRET: la clave del paso 2.
   Después andá a "Deployments" y hacé "Redeploy" del último deploy de producción.

9. Cerrá la terminal sin guardar la clave en ningún archivo.

INFORME FINAL (sin la clave secreta)
- Cuenta usada, y nombre e ID de cada carpeta.
- Resultado de "probar" (paso 6).
- URL de la aplicación web (paso 7).
- Si se cargaron las dos variables en Vercel y si el redeploy terminó bien.
- Cualquier paso que no se pudo hacer, y por qué.
````

## Actualizar el script publicado a la versión 2

El script publicado el 28/10/2026 es la versión 1: guarda todo en una sola carpeta (`CARPETA_ID`) y no sabe leer, mover ni descartar. La app nueva lo necesita en versión 2; con la 1, al subir un comprobante avisa "El script de Apps Script es de una versión anterior". Para actualizarlo, en la cuenta dueña del script (los pasos completos, con prompt para computer use, están en [la puesta en marcha](../docs/puesta-en-marcha.md)):

1. Crear las carpetas del paso 1 de arriba y anotar sus ID.
2. En script.google.com, abrir el proyecto del script, reemplazar Código.gs por [`guardar-factura.gs`](guardar-factura.gs) y guardar.
3. En "Configuración del proyecto > Propiedades del script", agregar `CARPETA_PENDIENTES`, `CARPETA_COMPRAS`, `CARPETA_HONORARIOS` y `CARPETA_VENTAS`. `CARPETA_ID` puede quedar: se usa para la que falte.
4. Ejecutar `probar` y aceptar los permisos nuevos si los pide: tiene que dar OK en cada carpeta.
5. "Implementar > Administrar implementaciones", editar la implementación activa y elegir "Versión nueva". La URL no cambia, así que no hay que tocar Vercel.

## Verificar

Con la URL del script se puede verificar que esté publicado sin conocer la clave: un pedido con una clave equivocada tiene que responder `{"ok":false,"error":"No autorizado"}`.

```bash
curl -sL -X POST -H 'Content-Type: application/json' -d '{"secret":"x"}' '<URL del script>'
```
