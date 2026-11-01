# Tareas

En cada proyecto, **Tareas** es un tablero tipo Trello para lo puntual: llamar a un inversor, pedirle algo a un proveedor, una entrega, un seguimiento de un lead o algo interno.

- **Columnas**: Por hacer, En curso, Bloqueada y Hecha. Se arrastra una tarjeta para cambiarla de columna. "Bloqueada" no es un estado: una tarea abierta va ahí mientras la bloquee otra tarea abierta o tenga un motivo escrito, y vuelve sola a su columna cuando se destraba. Las canceladas no se ven en el tablero.
- **Cada tarea**: título, tipo (Llamada, Seguimiento, Visita, Entrega, Documentación, Pago, Otro), estado, prioridad (Normal, Alta, Urgente), responsable (Mati, Tade), proyecto (o "General"), vence (fecha y hora opcional), con qué tiene que ver (algo interno, un inversor, un lead del CRM con link a su ficha, un proveedor o una unidad), descripción, **subtareas** (checklist), **qué la bloquea** (otras tareas o un motivo de afuera; no deja armar círculos) y **comentarios** (cualquiera del equipo, con quién y cuándo).
- **Filtros**: buscar, por responsable ("Mías") y "Toda la empresa" (por defecto se ven las del proyecto y las generales).
- Las abiertas con fecha aparecen en el **Calendario** (las atrasadas en rojo) y "Ver" abre la tarea.

Se guardan en la planilla del CRM, pestañas **"Tareas"** y **"Tareas Comentarios"** (se crean solas). Las subtareas quedan en una celda, una por renglón, con "[x]" las hechas.

Código: `lib/tareas/modelo.ts` (puro, con tests), `lib/tareas/fuente.ts`, `app/api/proyectos/[proyecto]/tareas/` y `components/tareas/Tareas.tsx`.
