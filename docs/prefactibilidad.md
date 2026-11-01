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

**Plusvalía**: va en Estado de resultados (pendiente), con la superficie según GCBA de la prefactibilidad del proyecto.

Se guarda en la planilla del CRM, pestañas **"Prefactibilidades"** (los datos en JSON) y **"Prefactibilidad Versiones"**. Permiso: la clave `prefactibilidad` (HQ y proyectos); de entrada la tienen administradores, dueños, arquitectura y analistas.

Código: `lib/prefactibilidad/modelo.ts` (cálculos, lectura del Excel; puro, con tests), `lib/prefactibilidad/fuente.ts`, `app/api/prefactibilidad/` y `components/prefactibilidad/Prefactibilidad.tsx`.
