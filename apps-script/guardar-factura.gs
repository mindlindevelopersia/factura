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
