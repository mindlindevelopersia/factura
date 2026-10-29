# Auditoría de UX/UI — 28/10/2026

## Objetivo y criterio de diseño

El cliente necesita identificar qué comprobantes requieren atención, contrastar los datos con el original y confirmar que cada registro terminó en su destino. La versión anterior mostraba todos los formularios y PDF abiertos, con más de veinte campos por archivo. Esa estructura dificultaba priorizar, multiplicaba las vistas previas y exigía desplazarse entre comprobantes.

El cambio organiza el trabajo en **recibir → revisar → aprobar → consultar**. Mantiene el logo, Sora y el lima de Mindlin, con superficies claras, encabezado compacto y un uso específico del color: lima para acciones, ámbar para revisar y rojo para errores. La guía UI/UX Pro Max se aplicó a jerarquía, foco, contraste, interacción táctil y adaptación de pantallas; su script de búsqueda no estaba incluido en la instalación local, por lo que el sistema se definió a partir de la marca existente y del recorrido real.

## Hallazgos resueltos

| Problema | Cambio y efecto |
|---|---|
| Todos los comprobantes abrían su formulario y su PDF a la vez. | Lista compacta y un único detalle activo. Solo se monta la vista previa del comprobante abierto. |
| Faltaba una forma rápida de encontrar o separar casos. | Búsqueda tolerante a tildes, filtros por estado y categoría, cantidades y vacíos con acción para limpiar filtros. |
| Cambiar de sección desmontaba las subidas en curso y su resultado. | El cargador sigue montado. Se conserva el progreso y se informa que debe mantenerse abierta la pestaña. |
| Subir varios lotes permitía superar el límite de dos solicitudes simultáneas. | Cola de trabajo compartida por todos los lotes de la sesión, con máximo global de dos. |
| Se podían enviar archivos vacíos o arrastrar formatos incompatibles para recién recibir un error del servidor. | Validación previa de formato, archivos vacíos y tamaño de PDF; se conserva la compresión de fotos grandes. |
| Cambiar de comprobante o de sección perdía los cambios de revisión. | Las fichas conservan su estado mientras permanezcan en la bandeja. Se avisa antes de cerrar con cambios sin aprobar. |
| Era posible intentar aprobar un duplicado ya detectado. | Se deshabilita esa acción mientras coincidan identidad y total con el duplicado conocido; si se corrigen los datos se vuelve a evaluar. El servidor conserva el control final. |
| La revisión exponía todos los impuestos aunque fueran cero y mezclaba datos fiscales, clasificación e importes. | Grupos de campos, datos fiscales secundarios desplegables y contexto de IA separado. Los impuestos adicionales se abren si tienen importes o alertas. |
| Había un mensaje genérico de campos inválidos sin ubicación ni explicación. | Campos identificados, ayuda por campo, atributos accesibles y errores que nombran qué corregir. |
| Se podían aprobar fechas vacías o imposibles, o números fuera de rango. Un total borrado se convertía en cero. | Esquema de guardado compartido entre formulario y API para fecha y rangos; el formulario no confunde un total vacío con cero. La lectura incompleta sigue editable. |
| El tipo de cambio no era editable. | Campo visible para moneda extranjera, que conserva el valor original y permite corregirlo. |
| Se podía volver a leer sobre ediciones sin advertencia. | Confirmación explícita que explica que se reemplazarán los cambios. |
| Una lectura tardía podía sobrescribir un comprobante ya aprobado o descartado. | El servicio vuelve a consultar su estado y conserva la resolución. La bandeja interpreta el estado final, incluso si llegó como respuesta de una relectura. |
| Una relectura fallida podía anunciarse como lectura exitosa. | Mensajes y color de confirmación dependen del resultado, con estado de error cuando corresponde. |
| El historial carecía de búsqueda y presentaba notas de crédito con total positivo. | Historial filtrable, registro y responsable legibles; las notas de crédito muestran el signo contable negativo. |
| La pantalla y el título de acceso decían solo «Facturas de compra». | Alcance coherente de compras, honorarios y ventas en el acceso y metadatos. |

## Pantallas y detalle de interacción

- **Bandeja:** resumen de pendientes sin duplicados, posibles duplicados y aprobados del historial reciente. Lista en orden de recepción, búsqueda, filtros y acción de actualizar. No se muestra un historial vacío mientras todavía se están cargando los datos.
- **Revisión:** documento junto al formulario en escritorio, campos agrupados y pie con total y acciones. En celular, lista y detalle separados, regreso a la lista con foco conservado y documento desplegable para no empujar los campos fuera de pantalla.
- **Carga:** límites visibles, contexto opcional, estado de cada archivo, reintento cuando corresponde y acceso al comprobante exacto si falló su lectura. No se promete procesamiento con la pestaña cerrada.
- **Historial:** búsqueda por contraparte, archivo, número o CUIT; filtro por aprobación o descarte; fila contable, responsable y enlace. Los descartes se distinguen como archivo en papelera y sin nuevo registro contable.
- **Acciones:** botones ocupados y protección ante doble ejecución en revisión, confirmaciones con foco inicial en Cancelar, retorno de foco al cerrar, ayudas por campo y respeto de movimiento reducido. La configuración técnica queda en un desplegable secundario.

Los colores de texto principales conservan contraste sobre las superficies claras. Los controles compactos tienen objetivos de interacción de 44 px; los campos móviles usan 16 px para evitar zoom accidental. Esto no sustituye una certificación completa de accesibilidad con lectores de pantalla reales.

## Verificación

- **123 tests** en 13 archivos, incluidos recorridos de React con DOM, más los tests previos del negocio y las dos regresiones de lecturas tardías.
- `npm run typecheck`, `npm run build` y `git diff --check` pasan.
- Pruebas con computer use sobre los componentes reales en un servidor local con datos ficticios: navegación entre comprobantes conservando ediciones, protección antes de releer, número inválido bloqueado, cambio de moneda, bloqueo de duplicados, aprobación y paso al historial.
- Se inspeccionaron **375, 768, 1024 y 1440 px**, sin desbordamiento horizontal del documento. En celular se comprobó la navegación entre lista y detalle.
- Las pruebas del rediseño usan servicios simulados locales. No modifican las facturas ni la copia contable de Google. No equivalen a repetir extracción con Anthropic, autenticación Google o conexión de Telegram en producción.

Las capturas se conservan fuera del repositorio, en `../evidencia/ux-ui-2026-10-28/`.

## Alcance pendiente

Antes de dar por cerrado el uso autónomo del cliente siguen pendientes la evaluación completa de sus comprobantes y la prueba de su Telegram personal, registradas en la documentación operativa. El control de duplicados entre aprobaciones simultáneas en distintas instancias de Vercel sigue sin ser una transacción distribuida; este cambio no afirma resolver ese caso.

La auditoría cubre el recorrido y los fallos descritos, no una garantía de ausencia de cualquier otro bug. La publicación del rediseño se identifica por el PR y su despliegue, por separado de la verificación local.
