# Propuesta comercial

Comercial → Propuesta comercial (también "Armar propuesta" desde la ficha del CRM o desde una unidad libre en Unidades). Arma la propuesta de una unidad como la que se le hizo a Virginia (2C) y la deja lista para guardar en PDF (A4).

## El cálculo (`lib/proyectos/propuesta.ts`)

- Valor en dólares (por defecto, el de la lista vigente; para reventas, el precio de reventa) → pesos al **dólar MEP del día** (editable).
- Partes **A** (boleto, formal; 70% por defecto) y **B** (compromiso, informal), cada una con un **anticipo en dólares** a la firma (por defecto US$ 1.000 y US$ 10.000).
- Saldo de A: **refuerzos** (porcentaje del total en pesos; por defecto 20% en diciembre y 20% el diciembre siguiente) y el resto en **cuotas mensuales** hasta la entrega (abril 2028 en Lerma).
- Saldo de B: **refuerzos** en partes iguales (por defecto uno en diciembre).
- Lo que está en pesos se ajusta por CAC desde el **mes base** (por defecto, el mes anterior).
- Con los datos de Virginia da exactamente su ficha de Ventas (`lib/proyectos/propuesta.test.ts`).

## El documento

Franja negra con el logo de Mindlin y "LERMA 439" escrito, render de portada, para quién es, fecha y vigencia (7 días), la unidad con sus superficies y su **plano**, el aporte estimado en dólares y pesos, y "Cómo se paga" como en la planilla de Virginia: la tabla Valor estimado / Aporte A / Aporte B (US$, $ y %), un recuadro por parte (A · Boleto certificado: anticipo, saldo, cuotas con cantidad, monto y meses, y cada refuerzo con su mes, % y monto; B · Compromiso de deuda: anticipo, saldo y refuerzos) y, como detalle, la tabla mes a mes con cada pago en su renglón (cuota y refuerzo por separado, con su parte) y el total del mes. Si no se muestra B, un solo recuadro con todo junto. Después, las notas (al costo, CAC, pesos, plazos, vigencia).

"Copiar link" guarda los parámetros en el link. "Registrar en el CRM" la deja en el historial del contacto, lo pasa a Propuesta enviada y agenda el seguimiento a 2 días.

## Planos e imágenes (`privado/proyectos/lerma-439/`, `lib/proyectos/planos.ts`)

Sacados de "Propuestas comerciales" del Excel madre: 2 ambientes frente (A) y contrafrente (C), monoambiente frente (B) y contrafrente (D), 3 ambientes frente (A+B) y contrafrente (C+D), PB, planta tipo y renders. No están en `public/`: los sirve `/api/proyectos/<id>/imagenes/<archivo>` solo con sesión. Pisos 8 y 9: sin plano propio (va la planta tipo).
