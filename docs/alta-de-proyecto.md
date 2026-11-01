# Dar de alta un proyecto nuevo

El checklist vive en `lib/proyectos/alta.ts` y se ve en la página de cada proyecto en preparación (por ejemplo, Güemes 4676), con lo que ya está marcado en `altaLista` del proyecto (`lib/modulos.ts`). Grupos:

1. **El proyecto**: nombre, dirección y nombre comercial; vehículo (sociedad o fideicomiso, CUIT, contabilidad y caja propias); unidades, cocheras y pisos; inicio de obra y entrega estimada; quiénes lo ven.
2. **Planillas** (compartidas con la cuenta de servicio): Excel madre (Lista de precios, Superficies, Ventas con las fichas, EE.RR, CRM), Flujo de fondos por inversor, Pagos por Inversor, cajas en pesos y en dólares, planilla contable y de facturas.
3. **Comercial**: precio vigente por m² y cómo sube; cómo se cuentan terrazas, patios y amenities; cocheras; esquema de pago de las propuestas (A/B, anticipos, cuotas, refuerzos, vigencia).
4. **Material de venta**: logos (PNG transparente, oscuro y claro), renders, planos por tipología (diciendo a qué unidades corresponden), planta tipo, textos de la propuesta.
5. **Inversores y cobranzas**: cuotas, anticipos y refuerzos (vencimientos y excepciones), ajuste por CAC (mes base y desfasaje), formal e informal y quién firma los avisos.
6. **Management**: qué cobra Mindlin (m², honorarios, fees), reparto entre socios, gastos de HQ.
7. **CRM**: base de interesados para importar (sin duplicados) y responsables.

Lo que no se sepa se carga como supuesto "a confirmar". Con todo listo, el proyecto pasa a `estado: "activo"` y se configura como Lerma (planillas, `management`, `comercial`, `ajustes`, imágenes en `privado/proyectos/<id>/` y `planoDe()`).
