# Configuración que falta (para hacer con computer use)

Lo que queda por configurar para que la app reciba facturas, armado para que lo haga un agente con computer use (ChatGPT u otro). **Copiá todo el bloque de "Prompt" y pegalo en el agente.** Cuando termine, pasale el informe final a Claude para seguir.

La app ya está desplegada con el código nuevo (cola de pendientes, web para revisar y subir, bot de Telegram, carpetas por categoría y por mes). Mientras falte esta configuración, la web muestra "Estado de la configuración" con lo que falta.

## Ya está hecho (no hay que tocarlo)

- `ANTHROPIC_API_KEY` y `TELEGRAM_API_KEY` cargadas en Vercel (Production).
- Login con Google, `ALLOWED_EMAILS`, cuenta de servicio y su clave en Vercel.
- El script de Apps Script "Guardar facturas Mindlin", publicado en mindlindevelopers.ia@gmail.com (versión 1). Su URL y su secreto ya están en Vercel y **no cambian**.

## Qué hace el agente

| # | Dónde | Qué |
|---|---|---|
| 1 | Drive de mindlindevelopers.ia@gmail.com | Carpeta "Facturas Mindlin" con cuatro subcarpetas |
| 2 | Apps Script, misma cuenta | Pasar el script a la versión 3 (código incluido en el prompt), cargar las carpetas y publicar una versión nueva |
| 3 | Sheets, misma cuenta | Copia en Google Sheets de la "Copia para IA de Administración Contable" (planilla de prueba con la estructura real) |
| 4 | Sheets, misma cuenta | Planilla vacía para la cola de la app |
| 5 | Las dos planillas y la carpeta | Compartir las planillas con la cuenta de servicio como Editor y dejar el acceso general en "Restringido" |
| 6 | Vercel | `SHEET_ID`, `SHEET_TAB_EGRESOS`, `SHEET_TAB_INGRESOS`, `COLA_SHEET_ID` y redeploy |
| 7 | La app | Revisar el estado de la configuración y activar el bot de Telegram |

Después, cada persona conecta su Telegram desde la web (ver "Después del agente").

## Prompt

````
Necesito terminar de configurar una app que ya está en producción: "Facturas Mindlin", en https://mindlin-developers.vercel.app. Lee facturas con IA; las facturas se guardan en Google Drive y se cargan en Google Sheets.

Datos:
- Cuenta de Google dueña de todo: mindlindevelopers.ia@gmail.com
- Cuenta de servicio de la app (no es una persona; se usa solo para compartir planillas): facturas-app@mindlin-developers.iam.gserviceaccount.com
- Proyecto de Apps Script: "Guardar facturas Mindlin", ID 1gCnlM-tgv2n45WKKe4LEpq8jcI0TH7yakOJYd9Xkjj-3zP3wYuOHL2FJ
- URL actual del script (no tiene que cambiar): https://script.google.com/macros/s/AKfycbzsCnZuxRzSt-FqtdK8_ycfCDdjPBP_vNkB5GqLgrkwYbQyVZ-CIe3Q1MixdIMN5RMl/exec
- Planilla del cliente de la que hay que hacer una copia: https://docs.google.com/spreadsheets/d/1y60VAg8yW10ce6sFcJssSVH_s7cv5T4d/edit
- Proyecto de Vercel: el que tiene el dominio mindlin-developers.vercel.app (repo mindlindevelopersia/factura)

Reglas:
- Trabajá en Chrome. Para Drive, Sheets y Apps Script usá la cuenta mindlindevelopers.ia@gmail.com. Si no está abierta o no sabés cuál es, frená y preguntame.
- No escribas valores secretos (claves, tokens, secretos) en el informe ni en ningún lado que no sea el campo donde van.
- No borres nada: ni carpetas, ni archivos, ni variables, ni propiedades.
- No modifiques la planilla original del cliente: solo hacé una copia.
- Si algo pide pagar, permisos de administrador o datos que no tenés, frená y preguntame.
- Anotá cada ID que te pida: los vas a necesitar en pasos siguientes y en el informe.

PASO 1. Carpetas en Drive
1. En drive.google.com, en "Mi unidad", creá una carpeta llamada "Facturas Mindlin". (Si ya existe una "Facturas Mindlin (prueba)", dejala como está y creá esta nueva igual.)
2. Adentro de "Facturas Mindlin", creá cuatro carpetas: "Pendientes", "Facturas de Compras", "Facturas de Honorarios de Administración" y "Facturas de Ventas".
3. Anotá el ID de las cuatro: es lo que está después de /folders/ en la URL cuando abrís cada carpeta.

PASO 2. Script de Apps Script a la versión 3
1. Entrá a https://script.google.com/home y abrí el proyecto "Guardar facturas Mindlin" (ID 1gCnlM-tgv2n45WKKe4LEpq8jcI0TH7yakOJYd9Xkjj-3zP3wYuOHL2FJ).
2. Abrí el archivo Código.gs, seleccioná todo su contenido, borralo y pegá exactamente este código (desde "/**" hasta la última "}"):

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

3. Guardá (Ctrl+S o el ícono del disquete). Si marca un error de sintaxis, revisá que se haya pegado completo y frená si no se resuelve.
4. Andá a "Configuración del proyecto" (el engranaje de la izquierda). En "Propiedades del script", tocá "Editar propiedades del script" y agregá estas cuatro, con los ID del paso 1:
   - CARPETA_PENDIENTES = ID de "Pendientes"
   - CARPETA_COMPRAS = ID de "Facturas de Compras"
   - CARPETA_HONORARIOS = ID de "Facturas de Honorarios de Administración"
   - CARPETA_VENTAS = ID de "Facturas de Ventas"
   No borres ni cambies las propiedades que ya están (SECRET y CARPETA_ID). Guardá.
5. Volvé al editor (el ícono "<>" de la izquierda). Arriba, en el selector de funciones, elegí "probar" y tocá "Ejecutar".
   - Si pide autorización: elegí mindlindevelopers.ia@gmail.com. Si aparece "Google no verificó esta app", tocá "Configuración avanzada" y después "Ir a Guardar facturas Mindlin (no seguro)". Es un script propio de esta cuenta. Aceptá los permisos.
   - En el registro de ejecución tienen que aparecer líneas "CARPETA_PENDIENTES OK", "CARPETA_COMPRAS OK", "CARPETA_HONORARIOS OK" y "CARPETA_VENTAS OK" (y una de CARPETA_ID). Anotá el resultado.
6. Publicá la versión nueva SIN crear una implementación nueva: tocá "Implementar" > "Administrar implementaciones". Seleccioná la implementación activa (la aplicación web), tocá el lápiz (editar), en "Versión" elegí "Nueva versión", poné la descripción "v3" y tocá "Implementar".
7. Verificá que la URL de la aplicación web sea exactamente la de arriba (https://script.google.com/macros/s/AKfycbzsCnZuxRzSt-FqtdK8_ycfCDdjPBP_vNkB5GqLgrkwYbQyVZ-CIe3Q1MixdIMN5RMl/exec). Si cambió, frená y avisame: no la cambies en Vercel por tu cuenta.

PASO 3. Copia de la planilla del cliente en Google Sheets
1. Abrí https://docs.google.com/spreadsheets/d/1y60VAg8yW10ce6sFcJssSVH_s7cv5T4d/edit con mindlindevelopers.ia@gmail.com. Si dice que no hay acceso, frená y avisame (hay que pedirle al dueño que la comparta).
2. Es un archivo .xlsx. Usá "Archivo" > "Guardar como Hojas de cálculo de Google". Eso crea una copia nueva; el original no se toca.
3. En la copia nueva, cambiale el nombre a "[PRUEBA] Administración Contable - copia para la app". Si quedó en otra carpeta, movela a "Mi unidad" de mindlindevelopers.ia@gmail.com.
4. Anotá el ID de la copia: lo que está entre /d/ y /edit en la URL.
5. Anotá, letra por letra (con espacios y paréntesis tal cual), el nombre de dos pestañas de abajo: la que empieza con "Facturación de Egresos" y la que empieza con "Facturación de Ingresos". Ojo: pueden estar cortadas, por ejemplo "Facturación de Egresos (Compras" sin el paréntesis final. Copiá el nombre exacto que se ve; si podés, hacé doble clic en la pestaña para ver el nombre completo y copialo de ahí sin cambiarlo.

PASO 4. Planilla para la cola de la app
1. En sheets.google.com creá una hoja de cálculo en blanco.
2. Llamala "Facturas Mindlin - cola de la app". No le agregues nada: la app crea sus pestañas sola.
3. Anotá su ID (lo que está entre /d/ y /edit).

PASO 5. Compartir las dos planillas con la cuenta de servicio
Para la planilla del paso 3 y para la del paso 4:
1. Tocá "Compartir".
2. Agregá facturas-app@mindlin-developers.iam.gserviceaccount.com con rol "Editor".
3. Destildá "Notificar a las personas" y tocá "Compartir" (o "Enviar"). Si avisa que la dirección no es de una cuenta de Google o que está fuera de la organización, confirmá igual: es normal para una cuenta de servicio.
4. En la misma ventana de "Compartir", mirá "Acceso general": tiene que decir "Restringido". Si dice "Cualquier persona con el vínculo", cambialo a "Restringido" y guardá. Hacé lo mismo con la carpeta "Facturas Mindlin" del paso 1 (clic derecho > Compartir > Acceso general). No agregues ni quites personas: solo el acceso general.

PASO 6. Variables en Vercel
1. Entrá a vercel.com y abrí el proyecto de la app (el que tiene el dominio mindlin-developers.vercel.app).
2. Andá a "Settings" > "Environment Variables". Trabajá solo en el entorno "Production".
3. Editá SHEET_ID: reemplazá su valor por el ID de la copia del paso 3.
4. Agregá estas variables nuevas (entorno Production):
   - SHEET_TAB_EGRESOS = el nombre exacto de la pestaña "Facturación de Egresos..." del paso 3
   - SHEET_TAB_INGRESOS = el nombre exacto de la pestaña "Facturación de Ingresos..." del paso 3
   - COLA_SHEET_ID = el ID de la planilla del paso 4
5. Sin mostrar ni copiar sus valores, confirmá que existen en Production: ANTHROPIC_API_KEY, TELEGRAM_API_KEY, APPS_SCRIPT_URL, APPS_SCRIPT_SECRET, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, AUTH_SECRET, ALLOWED_EMAILS. No toques las demás variables.
6. Andá a "Deployments", buscá el último deploy de Production, abrí el menú "..." y elegí "Redeploy". Esperá a que quede "Ready".

PASO 7. Verificar en la app y activar el bot
1. Abrí https://mindlin-developers.vercel.app. Si pide iniciar sesión con Google y no hay una sesión de un mail habilitado, frená y pedime que inicie sesión yo.
2. Andá a la pestaña "Subir" y tocá "Revisar la configuración" (si la app ya muestra el recuadro "Estado de la configuración", usá ese). Anotá cada línea con su ✓ o ✗ y el texto que la acompaña.
3. Si la línea "Bot de Telegram" dice que falta activarlo, en la misma pestaña "Subir", dentro de "Por Telegram", tocá "Activar bot". Volvé a revisar la configuración y anotá cómo quedó.
4. Andá a la pestaña "Inicio". Arriba hay botones de acceso directo (Planilla y Drive). Anotá cuáles están negros (activos) y cuáles grisados, con el texto que muestran al pasar el mouse. Tocá cada uno activo y anotá si abre la planilla o la carpeta correcta.
5. Si alguna otra línea tiene ✗, no intentes arreglarla por tu cuenta salvo que el texto diga exactamente qué falta y sea uno de los pasos de arriba (por ejemplo, un nombre de pestaña mal copiado: corregilo en Vercel y hacé Redeploy otra vez). Si no, anotalo para el informe.

INFORME FINAL (sin valores secretos)
- Paso 1: ID de las cuatro carpetas.
- Paso 2: resultado de "probar" (las líneas OK) y confirmación de que la URL del script no cambió.
- Paso 3: ID de la copia y nombre exacto de las dos pestañas de facturación.
- Paso 4: ID de la planilla de la cola.
- Paso 5: confirmación de que las dos planillas están compartidas con la cuenta de servicio como Editor, y el "Acceso general" de las dos planillas y de la carpeta (antes y después).
- Paso 6: variables cargadas o editadas, confirmación de que existen las demás, y si el redeploy quedó "Ready".
- Paso 7: cada línea del estado de la configuración con ✓ o ✗ y su texto, antes y después de activar el bot, y qué abre cada acceso directo del Inicio.
- Cualquier paso que no se pudo hacer, y por qué.
````

## Después del agente

Lo hace cada persona, con su cuenta, porque es su Telegram:

1. Entrar a https://mindlin-developers.vercel.app con su mail (tiene que estar en `ALLOWED_EMAILS`).
2. Pestaña "Subir" > "Conectar mi Telegram". Se abre el bot de facturas en Telegram: tocar "Iniciar". El bot contesta "Listo, este Telegram quedó conectado a ...".

Y la prueba de punta a punta, con las facturas de octubre: [puesta-en-marcha.md](puesta-en-marcha.md#probar-de-punta-a-punta).

Con el informe del agente, actualizar [configuracion.md](configuracion.md) con los ID nuevos.
