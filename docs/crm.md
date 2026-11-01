# CRM (Comercial)

El CRM de ventas: una base de contactos de toda la empresa; cada contacto puede estar en uno o varios proyectos (se marcan en su ficha). En el CRM de un proyecto se ven los de ese proyecto y los que no tienen ninguno; en Base de datos, "Toda la empresa" muestra todos. Tres vistas dentro de Comercial → CRM:

- **Dashboard**: "Hablale a…" (las alarmas, de la más urgente a la menos), lo que vence esta semana, los números (para hablar hoy, abiertos por temperatura, nuevos, pronóstico), por etapa, de dónde vienen y por qué se pierden.
- **Embudo**: "+ Nuevo lead" (con la etapa en la que entra) y una columna por etapa; se arrastra una tarjeta para cambiarla de etapa (a Vendido o Perdido se pasa desde la ficha, con el motivo).
- **Base de datos**: todos los contactos con búsqueda y filtros, y el alta de uno nuevo.

Cada contacto abre una **ficha**: escribirle (WhatsApp con el mensaje armado; mail: se abre Zoho Mail y el mail queda copiado para pegar; llamar), el mensaje sugerido por etapa o pedido a Oliver (IA, con su historial), registrar qué pasó con el próximo paso, sus datos, las unidades que le sirven y el historial.

## Reglas

- **Ningún contacto abierto queda sin próximo paso con fecha** (al registrar, el hub lo pide).
- Etapas: Nuevo → Contactado → Interesado → Evaluando (tiene propuesta; vence a los 7 días) → Negociando → Vendido; aparte, Perdido (con motivo y fecha para volver a contactar) y Dormido (novedades cada tanto). Sin "Visitó" ni "Reservado": Lerma es de pozo y no se suele reservar.
- Plazos para la alarma de "estancado": Contactado 7 días, Interesado 14, Negociando 14.
- **Temperatura** (no es etapa): hot si está evaluando o negociando (o decide en menos de 2 meses) y hablamos en la última semana; frío si hace más de 14 días que no hablamos, decide en más de 6 meses o el presupuesto no alcanza (menos del 90% de la unidad más barata); tibio el resto. Se puede poner a mano y manda la manual. Cadencia: hot cada 2 días, tibio 7, frío 30.
- Alarmas: nuevo sin contactar en 2 h; seguimiento vencido o de hoy; sin próximo paso; hot sin hablar hace más de 3 días; propuesta por vencer (día 5) o vencida (día 7); estancado; perdido para recontactar; dormido sin novedades hace 45 días; y la cadencia de su temperatura.
- Pronóstico: presupuesto de cada abierto × probabilidad de su etapa (Contactado 5%, Interesado 10%, Evaluando 40%, Negociando 60%).

## Cuando se vende

- En el CRM, al pasar un contacto a **Vendido** hay que decir **qué unidad compró y a cuánto**. La ficha muestra lo que hay que cargar en las planillas (Lista de precios, Ventas, Pagos por Inversor, Flujo).
- El hub **lee** las planillas, no las escribe. Cuando la "Lista de precios" dice Vendido, se actualiza solo en todo el hub: Unidades, Lista de precios, Tablero, Management, las unidades que el CRM sugiere y Oliver. Cuando están el bloque en "Pagos por Inversor" y la fila en el Flujo, aparece en Cuentas corrientes, Cobranzas e Ingresos.
- Cruces con alarma: vendida en el CRM pero libre en la Lista de precios ("Actualizá la planilla…"); y a quien le interesaba una unidad que se vendió ("La 5B se vendió: ofrecele otra a…"). Las unidades en reventa se siguen ofreciendo.

## Dónde se guarda

En dos pestañas que el hub crea solo: "CRM Contactos" (una fila por contacto, se reescribe al cambiar) y "CRM Actividad" (una fila por llamada, mensaje, nota o cambio de etapa; solo se agregan). Van en la planilla de `CRM_SHEET_ID` o, si no está, en la de la cola (`COLA_SHEET_ID`), que la cuenta de servicio ya puede editar. Se pueden ver y editar en Sheets.

La primera vez, el CRM ofrece **importar la pestaña "CRM" del Excel madre** (174 contactos): Sold → Vendido, Churn → Perdido (motivo "Sin dato"), Follow up → Interesado, Contactado → Contactado, Hot → Interesado hot (si se habló en el último mes), Cold y sin etapa → Dormido; los seguimientos abiertos sin contacto hace más de 4 meses entran como Dormido. Source: "Mati Mindlin" → Base propia; LinkedIn, Pauta; otro nombre → Referido por esa persona.

## Código

- `lib/crm/modelo.ts` (etapas, columnas, validación), `lib/crm/alarmas.ts` (temperatura, alarmas, tablero, unidades que le sirven), `lib/crm/mensajes.ts` (plantillas, WhatsApp), `lib/crm/importar.ts`: puros, con pruebas en `lib/crm/crm.test.ts`.
- `lib/crm/fuente.ts`: lee y escribe las pestañas. Rutas en `app/api/proyectos/[proyecto]/crm/` (GET y alta, cambio por id, importar, mensaje con IA).
- Pantallas en `components/crm/` y `app/(hub)/proyectos/[proyecto]/comercial/crm/`.
- Oliver en el CRM ve los contactos, las alarmas y el tablero ("¿a quién llamo hoy?").
