/**
 * Guarda en Drive los archivos de facturas que manda la app.
 *
 * Se publica como web app en la cuenta de Google dueña de la carpeta:
 *   Ejecutar como: Yo. Quién tiene acceso: Cualquier usuario.
 * Propiedades del script (Configuración del proyecto > Propiedades del script):
 *   CARPETA_ID: ID de la carpeta de Drive donde se guardan los archivos.
 *   SECRET: la misma clave que APPS_SCRIPT_SECRET en Vercel.
 * Pasos completos en apps-script/README.md.
 */
function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  try {
    var body = JSON.parse(e.postData.contents);
    if (!props.getProperty('SECRET') || body.secret !== props.getProperty('SECRET')) {
      return responder({ ok: false, error: 'No autorizado' });
    }
    var carpeta = DriveApp.getFolderById(props.getProperty('CARPETA_ID'));
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

/** Para probar desde el editor: crea y borra un archivo en la carpeta. */
function probar() {
  var carpeta = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('CARPETA_ID'));
  var archivo = carpeta.createFile('prueba.txt', 'prueba');
  Logger.log('OK: ' + archivo.getUrl());
  archivo.setTrashed(true);
}
