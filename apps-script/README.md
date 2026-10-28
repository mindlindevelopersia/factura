# Guardar los PDF en Drive con Apps Script

La cuenta de servicio no puede guardar archivos en un Drive de Gmail. Por eso la app los manda a este script, que se publica como web app en la cuenta dueña de la carpeta y guarda los archivos a nombre de esa cuenta. La app lo usa cuando están cargadas `APPS_SCRIPT_URL` y `APPS_SCRIPT_SECRET`. Si no están, carga las facturas en la planilla con el link vacío.

La cuenta elegida para este proyecto es **mindlindevelopers.ia@gmail.com**. La carpeta, la planilla y el script deben pertenecer a esa cuenta. Los identificadores y el estado verificado están en [la configuración actual](../docs/configuracion.md).

El código es [`guardar-factura.gs`](guardar-factura.gs). Si se cambia, hay que pegarlo de nuevo en el editor de Apps Script y publicar una versión nueva (Implementar > Administrar implementaciones > editar > Versión nueva). La URL se mantiene.

## Prompt para computer use

Antes de pegarlo, reemplazá `<CUENTA>` por la cuenta de Google dueña de las facturas.

````
Necesito publicar un script de Google Apps Script que guarda en Drive los PDF de facturas que le manda una app (Facturas Mindlin, en https://mindlin-developers.vercel.app). Trabajá en Chrome con la cuenta de Google <CUENTA>. Si no está abierta, o no sabés cuál es, frená y preguntame.

Reglas: no escribas la clave secreta en el informe final ni en ningún otro lado que no sean los dos campos indicados. Si algo pide pagar o permisos de administrador, frená y preguntame.

1. En drive.google.com, con <CUENTA>, creá una carpeta "Facturas Mindlin". Para este proyecto usá mindlindevelopers.ia@gmail.com y la carpeta "Facturas Mindlin (prueba)" indicada en docs/configuracion.md; no uses el script anterior de Axel. Anotá el ID de la carpeta: lo que está después de /folders/ en la URL.

2. Abrí una terminal y generá una clave con: openssl rand -hex 24
   Es la clave secreta: la vas a pegar en los pasos 5 y 8.

3. Entrá a https://script.google.com, tocá "Nuevo proyecto" y ponele el nombre "Guardar facturas Mindlin".

4. Borrá todo el contenido de Código.gs y pegá este código:

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

function probar() {
  var carpeta = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('CARPETA_ID'));
  var archivo = carpeta.createFile('prueba.txt', 'prueba');
  Logger.log('OK: ' + archivo.getUrl());
  archivo.setTrashed(true);
}

   Guardá con Ctrl+S.

5. Andá a "Configuración del proyecto" (el engranaje). En "Propiedades del script", agregá dos:
   - CARPETA_ID: el ID del paso 1.
   - SECRET: la clave del paso 2.
   Guardá.

6. Volvé al editor, elegí la función "probar" en el menú de arriba y tocá "Ejecutar".
   - Google va a pedir autorización. Elegí <CUENTA>. Si aparece "Google no verificó esta app", tocá "Configuración avanzada" y después "Ir a Guardar facturas Mindlin (no seguro)". Es un script propio de esta cuenta, así que es normal. Aceptá los permisos.
   - En el registro de ejecución tiene que aparecer "OK: https://drive.google.com/...". Si da error, anotalo.

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
- Cuenta usada, y nombre e ID de la carpeta.
- Resultado de "probar" (paso 6).
- URL de la aplicación web (paso 7).
- Si se cargaron las dos variables en Vercel y si el redeploy terminó bien.
- Cualquier paso que no se pudo hacer, y por qué.
````

## Verificar

Con la URL del script se puede verificar que esté publicado sin conocer la clave: un pedido con una clave equivocada tiene que responder `{"ok":false,"error":"No autorizado"}`.

```bash
curl -sL -X POST -H 'Content-Type: application/json' -d '{"secret":"x"}' '<URL del script>'
```
