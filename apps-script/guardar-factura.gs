/**
 * Guarda en Drive los archivos de facturas que manda la app.
 *
 * Se publica como web app en la cuenta de Google dueña de las carpetas:
 *   Ejecutar como: Yo. Quién tiene acceso: Cualquier usuario.
 * Propiedades del script (Configuración del proyecto > Propiedades del script):
 *   CARPETA_COMPRAS, CARPETA_HONORARIOS, CARPETA_VENTAS: ID de la carpeta de Drive de cada
 *     categoría. Si falta alguna, se usa CARPETA_ID.
 *   CARPETA_ID: carpeta por defecto (la única que usaba la versión anterior del script).
 *   SECRET: la misma clave que APPS_SCRIPT_SECRET en Vercel.
 * Pasos completos en apps-script/README.md.
 */
var CARPETAS = { compra: 'CARPETA_COMPRAS', honorarios: 'CARPETA_HONORARIOS', venta: 'CARPETA_VENTAS' };

function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  try {
    var body = JSON.parse(e.postData.contents);
    if (!props.getProperty('SECRET') || body.secret !== props.getProperty('SECRET')) {
      return responder({ ok: false, error: 'No autorizado' });
    }
    var carpetaId = (CARPETAS[body.carpeta] && props.getProperty(CARPETAS[body.carpeta])) || props.getProperty('CARPETA_ID');
    if (!carpetaId) return responder({ ok: false, error: 'No hay carpeta configurada para "' + body.carpeta + '"' });
    var carpeta = DriveApp.getFolderById(carpetaId);
    var blob = Utilities.newBlob(Utilities.base64Decode(body.base64), body.mimeType, body.nombre);
    var archivo = carpeta.createFile(blob);
    return responder({ ok: true, id: archivo.getId(), url: archivo.getUrl() });
  } catch (err) {
    return responder({ ok: false, error: String(err) });
  }
}

function responder(datos) {
  return ContentService.createTextOutput(JSON.stringify(datos)).setMimeType(ContentService.MimeType.JSON);
}

/** Para probar desde el editor: crea y borra un archivo en cada carpeta configurada. */
function probar() {
  var props = PropertiesService.getScriptProperties();
  ['CARPETA_COMPRAS', 'CARPETA_HONORARIOS', 'CARPETA_VENTAS', 'CARPETA_ID'].forEach(function (nombre) {
    var id = props.getProperty(nombre);
    if (!id) return Logger.log(nombre + ': sin configurar');
    var archivo = DriveApp.getFolderById(id).createFile('prueba.txt', 'prueba');
    Logger.log(nombre + ' OK: ' + archivo.getUrl());
    archivo.setTrashed(true);
  });
}
