# Inversores · Cobranzas

Qué tiene vencido cada inversor, cuánto es al día de hoy (actualizado por CAC), qué vence este mes y el próximo, el aviso por WhatsApp y el seguimiento. Usa lo mismo que [Cuentas corrientes](inversores-cuentas.md) (Flujo de fondos y "Pagos por Inversor") y el [Índice CAC](indicadores-cac.md).

## Reglas (acordadas el 31/10/2026)

- **Vencimiento:** la cuota (o el refuerzo) de un mes vence el día **10** de ese mes. Las de Marcelo Martín, el **20** (`VENCIMIENTOS_ESPECIALES` en `lib/inversores/cobranzas.ts`).
- **Vencido:** pendiente en el Flujo (rosa, amarillo o sin color) y con la fecha de vencimiento pasada.
- **Actualización por CAC (solo pesos):**
  - Cuotas: el Flujo las tiene a valores de su mes, con el índice del mes anterior. Vencidas, se llevan a hoy: monto × CAC del mes anterior a hoy ÷ CAC del mes anterior a la cuota. Si el CAC que haría falta no salió, se usa el monto del Flujo y se aclara.
  - Refuerzos: el Flujo los tiene a valores del "Mes Base CAC". Se ajustan desde ahí: monto × CAC del mes anterior al de pago (o a hoy, si está vencido) ÷ CAC del mes anterior al base.
  - Si se acumulan varias, cada una se actualiza desde su mes y se suman.
  - La cuenta de cada ajuste se ve en pantalla para verificarla.
- **Mensaje:** solo lo formal, firmado "Tadeo – Administración Mindlin Developers". Si hay vencidos formales, es un reclamo con el detalle y el total actualizado; si no, un recordatorio de lo que vence este mes. Si solo hay informal, no hay mensaje (avisar por otra vía).
- **WhatsApp:** el botón abre WhatsApp con el teléfono de la cuenta y el mensaje escrito. No se manda solo.
- **Verificar antes de avisar** (el botón queda bloqueado hasta marcar "Ya lo verifiqué"):
  - Por tipo (cuota o refuerzo) y formal/informal: si desde el primer vencido hay más pagos registrados en "Pagos por Inversor" que meses cobrados (en verde) en el Flujo, algún vencido puede estar pago y faltar pintarlo.
  - Montos en amarillo en el Flujo.
  - Montos que no se pudieron actualizar.

## Registro y seguimiento

Cada aviso se anota en la pestaña **"Cobranzas"** de la planilla de la cola (`COLA_SHEET_ID`), no en la contable: fecha, quién (el mail de la sesión), cuenta, inversor, unidad, canal, estado ("Avisado", "Prometió pagar", "Dice que ya pagó", "Sin respuesta", "Pagó", "Otro"), monto avisado y nota. La pestaña se crea sola. Solo se agregan filas.

- Al tocar "Avisar por WhatsApp" se anota "Avisado" automáticamente.
- "Anotar respuesta o aviso" registra lo que contestó o un aviso por otra vía.
- Cada tarjeta muestra el último aviso; la vista "Seguimiento" tiene el historial.
- Si `COLA_SHEET_ID` no está configurado, el módulo funciona igual y avisa que no queda anotado.

## Verificación con la copia de prueba (31/10/2026)

15 cuentas con vencidos, $622,4 M vencido actualizado (incluye los informales y los $378,9 M de la unidad 8A, con la fila amarilla). 11 cuentas para verificar: en varias, la cuota de octubre está registrada en "Pagos por Inversor" y sigue en rosa en el Flujo.

## Dónde está el código

- `lib/inversores/cobranzas.ts`: vencimientos, ajuste por CAC, controles y mensaje. Sin red; con tests en `cobranzas.test.ts`.
- `lib/inversores/avisos.ts`: el registro de avisos; tests en `avisos.test.ts`.
- `lib/finanzas/fuente.ts` (`cobranzas`, `registroAvisos`).
- `GET /api/inversores/cobranzas`, `GET` y `POST /api/inversores/cobranzas/avisos`, y la pantalla `/inversores/cobranzas`.
- Variable opcional: `COBRANZAS_TAB` (por defecto, "Cobranzas").
