# Proyectos: Comercial y Management

El hub se organiza en **Empresa → Proyectos → áreas**. Cada proyecto es su propio vehículo (Lerma 439: Mindlin Developers S.A.; Güemes 4676: un fideicomiso), con su administración, finanzas, comercial, inversores y management. Indicadores es de toda la empresa. Los proyectos y sus áreas están en `lib/modulos.ts`; las páginas, en `app/(hub)/proyectos/[proyecto]/`. Las rutas viejas (`/administracion`, `/finanzas`, `/inversores`) llevan a Lerma.

Güemes 4676 figura como beta y no se puede entrar hasta darlo de alta (ver [alta-de-proyecto.md](alta-de-proyecto.md)).

## Fuente: el "Excel madre" del proyecto

Lerma: "Lerma 439 - Villa Crespo - Flujo de fondos y viabilidad - Mindlin Developers" (`1B1cSVA9AtleBLajFwjkXdQOHnv2n0Ijv4sl3NtZP8c0`, de matimindlin111@gmail.com). Se puede cambiar con la variable `MADRE_SHEET_ID_LERMA_439`. Para que la app lo lea, compartirlo como Lector con la cuenta de servicio.

| Pestaña | Qué se usa |
|---|---|
| **Lista de precios** (manda) | Una fila por unidad: estado (Vendido/Libre), piso, letra, UF, tipología, orientación, superficies, coeficiente, amenities, valor con amenities y aumento por altura. Termina donde empiezan las notas: lo de abajo ("Opción depto 9") son variantes y no se cuentan |
| **Ventas** | El machete: precio de venta ("Costo estimado"), lo pagado al boleto en blanco y en negro, y "¿A cuánto vendimos?" |
| **Superficies** | Terreno, superficies de construcción (cubierta, semicubierta, descubierta) y vendibles/comunes |
| **EE.RR** | "M2 canjeados a Developers", para comparar |

Además se cruzan las cuentas corrientes ("Pagos por Inversor" y el Flujo) y la caja (Egresos).

## Reglas (31/10/2026)

- **El estado de cada unidad lo da la Lista de precios.** "Ventas" se usa para el detalle; si dice otra cosa, va a revisar.
- **Precio de lista** = valor con amenities + aumento por altura = (m² de venta + amenities) × precio por m² × (1 + 1,5% × pisos por encima del primero). Precio vigente: **US$ 2.600/m²** en el piso 1 (se deduce de la lista; en la planilla, EE.RR M56 y J77).
- **Lo que falta vender** = suma del precio de lista de las unidades libres (incluye lo que les tocaría a los desarrolladores).
- **Precio promedio de venta** = suma de los precios de venta ÷ suma de "Sup Total" de esas unidades.
- **Precio de las vendidas:** el de venta, no el de lista. Sale del machete de "Ventas" ("Costo estimado") y se cruza con "Pagos por Inversor" (costo estimado de la cuenta); si no coinciden, hay alarma y se usa el de "Ventas". La fila "Falta vender" de Ventas no es una venta. El precio de lista vigente es solo para las libres.
- **Correcciones (`ajustes` del proyecto en `lib/modulos.ts`):** lo que se sabe de una unidad y la planilla todavía no dice. Pueden cambiar el estado (una venta que no se firmó → libre), marcar que se pagó con un **contrato** de obra (contratistas: no tienen cuenta corriente; irán al módulo de Contratos) o que está **en reventa** (vendida, la revende el dueño a un precio: cuenta como vendida y no suma a lo que falta vender, pero aparece en la lista de precios como disponible). Cada corrección aparece en "Supuestos" como confirmada, con lo que dice la planilla. Sin nombres de inversores.
- **Desarrolladores (confirmado el 31/10/2026):** 15% de los m² vendibles sin amenities (suma de "Sup Propia VENTA"). Los amenities no se cuentan. En m²; el valor se elige a mano. Reparto 50% Matías Mindlin, 25% Michelle Mindlin, 25% Micaela Druck (igual en todos los proyectos; la parte de los desarrolladores puede cambiar por proyecto).
- **HQ:** los egresos de la caja marcados como HQ son de Mindlin Developers, no del edificio. Por ahora quedan en Lerma. En Management → Desarrolladores está la lista **"HQ para revisar con Tadeo"** (con descarga para Excel), fila por fila y agrupada por qué están en duda: parecen de obra (materiales, hormigón, constructora: van a Lerma), préstamos (por ejemplo, a Borok: se devolvieron, no son gasto), grandes en dólares (más de US$ 5.000) e impuestos y gastos del banco. Lo demás se toma como gasto de oficina. Cuando se corrigen en el Excel, el hub los toma solos.
- **Rubro "Préstamos (se devuelven)"** en Egresos: descripciones con "Borok" o "préstamo".

## Origen de los datos y supuestos

Cada número importante tiene "¿De dónde sale?" con la planilla, la pestaña y la columna. Lo que no está confirmado se marca "Supuesto, a confirmar". La sección "Supuestos y datos a revisar" junta, como tarjetas:

- **Confirmado:** lo que ya se acordó.
- **A confirmar:** lo que se supuso y cómo se calcula mientras tanto.
- **No coincide:** diferencias entre planillas (por ejemplo, una unidad libre en la lista y vendida en el machete, o vendida sin cuenta corriente).

## Verificación con el Excel madre (31/10/2026)

28 unidades y 2 cocheras; 20 vendidas (1A en reventa a US$ 105.000), 8 libres. Correcciones: 1A vendida a un contratista y en reventa, 2C libre (la venta no se firmó), 9A pagada con contrato. Precio promedio de venta US$ 2.214/m²; falta vender US$ 783.654 a lista. Desarrolladores: 15% de 1.299,16 m² = 194,87 m² (EE.RR dice 243,18). Correcciones también: 5D libre (los compradores se pasaron a PB; la venta de 5D en Ventas es la vieja). 4C: precio real US$ 80.000; en los papeles 90.000 (mutuo, en blanco por 90.000), por eso Pagos por Inversor dice 90.000. HQ: 669 egresos ($52,9 M y US$ 55.628): 587 del banco y 7 que parecen de obra, entre ellos una transferencia de US$ 50.000.

## Dónde está el código

- `lib/modulos.ts`: proyectos, áreas y socios.
- `lib/proyectos/comercial.ts` y `management.ts`: lectura y cálculos, sin red; tests en `comercial.test.ts`.
- `lib/finanzas/fuente.ts` (`datosComercial`) y `GET /api/proyectos/<proyecto>/comercial`.
- Pantallas en `components/proyectos/`: Tablero (portada del proyecto), Unidades, ListaPrecios, Desarrolladores, y los componentes Origen y Supuestos.
