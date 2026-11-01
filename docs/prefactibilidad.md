# Prefactibilidad

En **HQ → Prefactibilidad** está la lista de lotes (En análisis, En proyectos, Descartadas) y la ficha de cada uno. En cada proyecto, **Prefactibilidad** muestra la suya: **es la misma** (asignar a un proyecto no copia; se edita desde los dos lados).

**La ficha:**

- **Carpeta de Drive**: el link a la carpeta con la volumetría, el anteproyecto, los PDF y el CAD (editable desde la ficha; solo links de Google). "Abrir carpeta" la abre para ver o subir archivos (Drive no tiene límite de tamaño).
- **Lote y normativa**: dirección, distrito, tipología, zonificación, basamento, FOT, FOS, densidad, cochera obligatoria, premio, altura y pisos máximos, retiros, LFI, protección histórica, link al código, FOS del proyecto; y los terrenos (frente × fondo).
- **Superficies construibles** por piso: cubierta, semicubierta y **cada descubierta con su % a mano** (lo que computa). Tres totales: **según GCBA** (cubierta + semicubierta de los pisos marcados "GCBA"; el subsuelo o la sala de máquinas no), **con las descubiertas a su %** y **totales** (todo al 100%). También lo que permite el FOT.
- **Superficies vendibles** por unidad: **teórico** (cubierta + semicubierta + cada descubierta a su %) y **real** (si se vende menos, por ejemplo un balcón gigante; vacío = teórico), con una nota. Comunes = construible con descubiertas − vendible teórico, y el % vendible.
- **Avisos**: falta el FOS, FOS excedido, más plantas que las del código, más vendible real que teórico, construible GCBA por encima del FOT.
- **Versiones**: "Guardar versión" (ej.: "Con PB de cocheras"); al asignarla a un proyecto se guarda una sola. "Comparar" muestra la versión contra lo actual; "Volver a esta" guarda antes cómo está ahora.
- Los cambios se guardan con "Guardar cambios" (avisa si hay algo sin guardar).

**Del Excel madre**: en un proyecto sin prefactibilidad, "Cargar del Excel madre" la arma con la pestaña **Superficies** (pisos, terreno, normativa) y las unidades de la **lista de precios**, ya asignada. Las descubiertas arrancan al 50% en lo construible (PB al 0%) y al 33% en lo vendible (PB al 20%), como en el Excel; después se ajusta cada una. Para Lerma da los mismos totales que la pestaña (GCBA 1.661,97 m², con descubiertas 1.727,68 m², total 1.793,2 m²).

La ficha tiene tres pestañas: **Superficies** (lo de arriba), **Plusvalía** y **Estado de resultados** (pendiente).

**Ver la cuenta ("fx")**: cada total tiene un botón **fx** que muestra de dónde sale, con los valores (como la barra de fórmulas del Excel). El total de cada piso y lo teórico de cada unidad también.

**Plusvalía** (Ley 6062), paso a paso y con la cuenta de cada paso:

- A1 = superficie que computa el Gobierno × 0,8. La superficie es la del plano o el permiso (en Lerma, 1.538 m²); vacía, se usa la construible según GCBA.
- A2 = superficie de la parcela (vacía: la del terreno) × FOT (vacío: el de la normativa). A = A1 − A2 (si da negativo, 0).
- B = incidencia del suelo (UVA/m²) × alícuota de la zona (de Ciudad 3D). Base imponible = A × B (en UVA).
- Plusvalía = base × **UVA del día** (ArgentinaDatos o BCRA, automático), de contado con el descuento (15%) y **en dólares al MEP de hoy**. Se puede probar con otro UVA (no se guarda).
- **Verificación**: con el pago registrado (fecha y monto), sale el UVA que se usó y se compara con el oficial de ese día. Para Lerma: pagado $ 80.266.777,67 el 15/01/2026 → plusvalía sin descuento $ 94.431.503 → UVA 1.721,73 (el Excel usaba 1.718,71).
- "Traer del Excel madre (EE.RR) y el pago de la caja" completa los datos de la pestaña EE.RR y el pago ("plusvalía" en la caja en pesos del proyecto), para revisar y guardar.

**Exportar a Excel**: un .xlsx con Lote, Construibles, Descubiertas, Vendibles, Resumen y Plusvalía. Todo lo calculado son fórmulas simples (sumas, multiplicaciones y SUMAR.SI) que apuntan a celdas a la vista; los datos van en azul. Verificado recalculándolo: da lo mismo que el hub.

Se guarda en la planilla del CRM, pestañas **"Prefactibilidades"** (los datos en JSON) y **"Prefactibilidad Versiones"**. Permiso: la clave `prefactibilidad` (HQ y proyectos); de entrada la tienen administradores, dueños, arquitectura y analistas.

Código: `lib/prefactibilidad/modelo.ts` (cálculos, lectura del Excel; puro, con tests), `lib/prefactibilidad/fuente.ts`, `app/api/prefactibilidad/` y `components/prefactibilidad/Prefactibilidad.tsx`.
