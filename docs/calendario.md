# Calendario del proyecto

En cada proyecto, **Calendario** (primera entrada del menú del proyecto) junta todo lo que tiene fecha, por día:

| Qué | De dónde | Cuándo |
| --- | --- | --- |
| **Cobros** | Lo que falta cobrar de cada inversor (Flujo de fondos, como en Cuentas corrientes) | El día que vence: el 10 de cada mes (o el día especial de la cuenta, como en Cobranzas). Lo pasado sin cobrar queda en rojo. |
| **Pagos** | Los egresos de las cajas cuyo "Corresponde" es el proyecto | El día del pago. |
| **Leads** | El próximo paso de cada contacto abierto del CRM; "volver a contactar" de los perdidos y dormidos | La fecha del próximo paso (atrasado en rojo). "Ver" abre su ficha. |
| **Propuestas** | Las propuestas comerciales guardadas | El día que vencen. |
| **Tareas** | Las tareas abiertas con fecha (del proyecto y las generales) | El día que vencen (atrasadas en rojo). "Ver" abre la tarea. |
| **Agenda** | Lo que se carga a mano ("+ Agregar a la agenda"): un pago a un proveedor, una reunión, una firma | El día elegido. Se guarda en la pestaña "Calendario" de la planilla del CRM y se puede borrar. |

Arriba se filtra por tipo (con cuántos hay en el mes). Tocando un día se ve el detalle con los montos y los totales por moneda, y abajo lo atrasado. Si una fuente no se puede leer, el resto sale igual y se avisa cuál faltó.

Código: `lib/calendario/eventos.ts` (puro, con tests), `lib/calendario/fuente.ts`, `app/api/proyectos/[proyecto]/calendario/` y `components/proyectos/Calendario.tsx`.

Pendiente: suscribirse desde el Calendario de la Mac o del celular (un link .ics). Hace falta decidir qué datos salen del hub (ver la charla).
