# Cash flow

En **Finanzas → Cash flow** de cada proyecto. Cuatro vistas:

- **Proyectado**: la pestaña "Cash Flow" del Excel madre (en dólares, con IVA). Ingresos: anticipos, arqueo, refuerzos en blanco y en negro, cuotas. Egresos por grupo: terreno, obra (hard costs), equipamiento y ascensores, honorarios y gestiones (soft costs), otros, y el IVA (débito − crédito) e ingresos brutos. Se controla que ingresos − egresos dé igual que "RESULTADO por Período" de la planilla (si no, avisa).
- **Real**: lo cobrado (cada pago de "Pagos por Inversor": cuotas, refuerzos en blanco o negro según formal, anticipos y aportes iniciales, certificaciones y otros) y lo pagado (los egresos de las cajas con "Corresponde" del proyecto), agrupado en los mismos grupos del Excel madre. Los rubros de la caja van así: terreno → Terreno; constructora, hormigón, hierro, materiales, electricidad → Obra; derechos y honorarios → Honorarios y gestiones; impuestos, seguros, bancarios, sueldos, administración, servicios → Otros; devoluciones, préstamos y sin clasificar, aparte.
- **Real + proyectado**: real hasta el mes pasado y proyectado desde este mes: con qué caja se termina la obra (y el mes más bajo).
- **Proyectado vs real**: por mes (hasta hoy), proyectado, real y la diferencia (verde si es a favor).

**Resumido** (ingresos, egresos, flujo neto, caja acumulada) o **desglosado** (cada grupo se abre en sus partidas; en lo real, tocando un número se ven los movimientos). **US$ o $**: lo real al **MEP del día de cada pago** (serie histórica de ArgentinaDatos); lo proyectado al MEP de cada mes y los meses que vienen al de hoy. Filtro por año y **Exportar a Excel**: cada partida con sus valores (en azul) y, con fórmulas simples, los grupos y totales (SUMA), el flujo neto (ingresos − egresos) y la caja acumulada (la del mes anterior + el flujo del mes, arrancando con la caja al inicio si se exporta un año); en "Proyectado vs real", las dos listas y la diferencia. Con lo real, una hoja "Movimientos" con cada pago. Verificado recalculándolo: da lo mismo que el hub.

**Notas**: cada fila y cada celda puede llevar notas con @ y respuestas (ver docs/comentarios.md).

Código: `lib/finanzas/cashflow.ts` (puro, con tests), `lib/finanzas/cashflowFuente.ts`, `grillaCashFlow` e `historicoMep` en `lib/finanzas/fuente.ts`, `app/api/proyectos/[proyecto]/cash-flow/route.ts` y `components/finanzas/CashFlow.tsx`.
