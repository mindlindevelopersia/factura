# Documentación firmada de los inversores

En la cuenta corriente de cada inversor (y en la ficha del CRM de los leads vendidos) aparece
**Documentación firmada**: los PDF escaneados de su carpeta de Drive, con el tipo (boleto,
compromiso de deuda, mutuo, adenda…) y un botón para abrirlos.

## De dónde sale

- **La carpeta del proyecto** se configura en `lib/modulos.ts` (`carpetaDocumentacion`). Lerma 439:
  `1N3tredjzqd6AR0ebfFdODp0sVzXVEvG2`.
- **Adentro, una carpeta por inversor.** Valen los PDF (o imágenes) sueltos de esa carpeta; las
  subcarpetas, como "editables", se ignoran.
- **El tipo sale del nombre del archivo:** compromiso, boleto, mutuo, adenda, cesión, recibo o
  reserva; si no, "Documento".
- **Cada carpeta se asigna sola a su cuenta corriente** (`lib/inversores/documentos.ts`):
  - La unidad en el nombre ("2C", "UF 2C") suma 3, y cada palabra del nombre del inversor suma 1.
  - Se asigna si queda clara: dos coincidencias, o una palabra que no tiene otro inversor.
  - Si el inversor tiene dos unidades, la carpeta va a las dos.
- **Las dudosas** aparecen en Cuentas corrientes → **Documentación sin asignar**. Se elige el
  inversor una vez y queda guardado en la pestaña "Documentación inversores" de la planilla del CRM.
- **Lo nuevo aparece solo:** Drive se lee con la cuenta de servicio (solo lectura) y se guarda 10
  minutos, así que un archivo nuevo se ve a los pocos minutos.

## Acceso

- **Los archivos se abren a través del hub** (`/api/inversores/documentos/<id>`), no con el link
  de Drive. Nadie más necesita acceso al Drive.
- **Solo los ve quien tiene permiso de Cuentas corrientes.**
- **Solo se sirven archivos de esa carpeta,** no cualquier archivo de Drive.

## Puesta en marcha

1. Compartir la carpeta como **Lector** con la cuenta de servicio (`GOOGLE_SERVICE_ACCOUNT_EMAIL`).
2. Si es la primera vez que la cuenta de servicio usa Drive, activar la **Google Drive API** en su
   proyecto de Google Cloud. El hub avisa con ese mensaje si falta.
