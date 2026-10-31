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
- **Desarrolladores (a confirmar):** 15% de los m² de venta sin amenities + 15% del 85% de los amenities (los amenities de los desarrolladores no se cuentan). En m²; el valor se elige a mano. Reparto 50% Matías Mindlin, 25% Michelle Mindlin, 25% Micaela Druck (igual en todos los proyectos; la parte de los desarrolladores puede cambiar por proyecto).
- **HQ:** los egresos de la caja marcados como HQ son de Mindlin Developers, no del edificio. Por ahora quedan en Lerma, con un aviso para separarlos y devolverlos.

## Origen de los datos y supuestos

Cada número importante tiene "¿De dónde sale?" con la planilla, la pestaña y la columna. Lo que no está confirmado se marca "Supuesto, a confirmar". La sección "Supuestos y datos a revisar" junta, como tarjetas:

- **Confirmado:** lo que ya se acordó.
- **A confirmar:** lo que se supuso y cómo se calcula mientras tanto.
- **No coincide:** diferencias entre planillas (por ejemplo, una unidad libre en la lista y vendida en el machete, o vendida sin cuenta corriente).

## Verificación con el Excel madre (31/10/2026)

28 unidades y 2 cocheras; 20 vendidas, 8 libres. 1.404,62 m² vendibles (1.110,42 vendidos, 294,2 libres). Precio promedio de venta US$ 2.217/m²; falta vender US$ 792.735 a lista. Desarrolladores: 204,25 m² con la regla (EE.RR dice 243,18). Conflictos: 1A (libre, canje Miranda con cuenta), 2C (vendida a "Vir Alegre", sin cuenta: la venta que no se firmó), 5D (libre en la lista, vendida en el machete), 9A (vendida a Sartori, sin cuenta). HQ: 669 egresos ($52,9 M y US$ 55.628).

## Dónde está el código

- `lib/modulos.ts`: proyectos, áreas y socios.
- `lib/proyectos/comercial.ts` y `management.ts`: lectura y cálculos, sin red; tests en `comercial.test.ts`.
- `lib/finanzas/fuente.ts` (`datosComercial`) y `GET /api/proyectos/<proyecto>/comercial`.
- Pantallas en `components/proyectos/`: Tablero (portada del proyecto), Unidades, ListaPrecios, Desarrolladores, y los componentes Origen y Supuestos.
