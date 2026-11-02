# Presupuesto de obra (base 0)

En **Finanzas → Presupuesto** de cada proyecto. Es el presupuesto por rubro contra lo que ya se
pagó. Con eso sale el **costo final estimado** del proyecto y el **costo del m²**, que usan los
honorarios de los desarrolladores.

## Rubros

Arranca con **Cargar los rubros base** (`lib/presupuesto/rubros.ts`):

- **Terreno:** valor, comisión inmobiliaria, escritura y transferencia.
- **Costo hard (construcción física):**
  - Demolición, trabajos preliminares, movimiento de suelo, estructura, aislaciones, mampostería.
  - Contrapisos, revoques, yesería, durlock, pisos, revestimientos, pintura, zócalos.
  - Electricidad, sanitaria y gas, calefacción, ascensor, artefactos.
  - Carpinterías, vidrios, puertas, mobiliario, mármol, espejos, herrería, herrajes.
  - Aire acondicionado, amenities y paisajismo, ayuda de gremio, limpieza, varios.
- **Costo soft:** imprevistos, derechos municipales, proyecto, dirección de obra, ejecución,
  asesores, gestores, seguros.
- **Impuestos y gastos:** IVA, ingresos brutos, gastos bancarios, escribanos y contador.

**El monto inicial** sale del cash flow del Excel madre cuando hay una línea que corresponde, en
dólares y como "estimado". La plusvalía no va. Se pueden agregar, cambiar y borrar ítems.

## Por ítem

| | |
| --- | --- |
| **Presupuesto** | Del ítem completo, cargado como monto (no como porcentaje). En **dólares**, o en **pesos** con su **mes base CAC**: se ajusta por el CAC general hasta el último publicado y se pasa a dólares al MEP de hoy. |
| **Pagado** | Los pagos de la caja de egresos del proyecto ("Corresponde"), en dólares al MEP del día de cada pago. |
| **Falta** | Presupuesto − pagado. Se puede poner a mano cuando se sabe que va a costar otra cosa. |
| **Costo final** | Pagado + falta. |
| **Desvío** | Costo final − presupuesto (en rojo si se pasa). |

Cada ítem también tiene estado (estimado / cotizado / contratado / **terminado**), proveedor y
notas.

**Terminado: vale lo pagado.**

- El costo final es lo pagado según las cajas y lo que falta queda en cero.
- El presupuesto original se mantiene, para ver el desvío. Si no tenía presupuesto, lo pagado queda
  como presupuesto (en dólares).
- Se marca con **"Terminado: usar lo pagado"** en la ficha.
- Arriba aparecen los ítems que **parecen terminados** (tienen pagos y, o no tenían presupuesto, o
  ya se pagó el 95% o más), para marcarlos de a uno o todos juntos. No se sugieren los que se pagan
  todos los meses: impuestos, seguros, dirección, ejecución e imprevistos.
- Si lo de la caja no está bien asignado, el monto y lo que falta se siguen corrigiendo a mano.

**Plusvalía:** tiene su propio ítem en costo soft, y sus pagos van ahí y no a "Derechos
municipales". A los proyectos que ya cargaron la plantilla les aparece el aviso **"Hay rubros
nuevos en la plantilla"** con el botón **Agregarlos**.

## Cómo se asignan los pagos a cada ítem

Cada pago de la caja se asigna en este orden (`asignarPago`):

1. **A mano:** desde "Pagado sin ítem" o desde la ficha del ítem, con "Mover a…". Se guarda en la
   pestaña "Presupuesto pagos".
2. **Por palabras de la descripción:** "hormig" o "herpaco" van a Estructura; "albañil" a
   Mampostería, etc.
3. **Por el rubro de la caja:** hierro y hormigón a Estructura, electricidad a Electricidad,
   impuestos a Ingresos brutos.
4. **Si no coincide ninguno:** queda en **Pagado sin ítem** de su rubro. Se suma igual al costo,
   pero conviene asignarlo para comparar bien.

La constructora (JH / Miranda) tiene un contrato por rubro: sus pagos se asignan por la palabra de
la descripción ("estructura", "albañilería"…) o a mano.

## Préstamos y devoluciones

Desde el 02/11/2026 no existen para el hub: los de Borok y las devoluciones se descartan al leer
las cajas (`lib/finanzas/egresos.ts`). No aparecen en el cash flow, en la revisión de HQ, en
honorarios ni en el presupuesto.

## Código

- `lib/presupuesto/rubros.ts`: la plantilla.
- `lib/presupuesto/modelo.ts`: el cálculo (con tests).
- `lib/presupuesto/fuente.ts`: la planilla del CRM (pestañas "Presupuesto" y "Presupuesto pagos")
  y el armado con la caja, el CAC y el MEP.
- `app/api/proyectos/[proyecto]/presupuesto`: GET, POST (plantilla o ítem nuevo), `[item]`
  (PATCH / DELETE) y `asignar`.
- `components/finanzas/Presupuesto.tsx`: la pantalla, con exportación a Excel.
- `app/api/proyectos/[proyecto]/honorarios` toma el costo del presupuesto cuando hay ítems
  cargados; si no, el del cash flow.
