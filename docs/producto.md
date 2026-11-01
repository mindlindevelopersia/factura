# HQ y Producto

El menú arranca con **HQ** (la portada: el dólar, los proyectos y lo de la empresa), que se abre con su flechita: adentro están **Indicadores** y **Producto**. Después, los proyectos y, al final, Ajustes.

## Producto

Lo que queremos sumar al hub, para ir tirando ideas con el equipo.

- **Ideas** (`/producto/ideas`): un tablero de mensajes como el de Basecamp. Cada idea con título, descripción (con @ para avisarle a alguien) y comentarios; quien la escribió recibe un aviso cuando le comentan. Se filtran por Abiertas, En features y Descartadas. **Pasar a Features** crea el feature en el kanban con el título y la descripción, y la idea queda "En features" con el link. **Volver a Ideas** (en la idea o en la ficha del feature) hace el camino inverso: la idea se reabre, el feature queda Cancelado (sale del tablero pero no se borra, conserva sus comentarios) y en la idea queda un comentario con quién la volvió. Si el feature se creó directo en Features, se arma una idea nueva con su título y descripción.
- **Features** (`/producto/features`): el mismo tablero de Tareas (Por hacer, En curso, Bloqueada, Hecha; responsable, prioridad, fecha, subtareas, bloqueos y comentarios), con sus propias tarjetas. Con el tablero vacío aparece **Cargar la lista inicial**: mejorar los módulos de administración, automatizar los procesos que se le pasaron a Axel, presupuesto base 0, módulo de compras y presupuestos, módulo de marketing, mails de notificaciones y el calendario en la Mac y el celular.

Los features son tareas con proyecto `producto` (pestaña "Tareas"); no aparecen en los tableros ni en el calendario de los proyectos. Las ideas van en las pestañas "Producto Ideas" y "Producto Comentarios" de la planilla del CRM. Permisos: las claves `producto/ideas` y `producto/features` (de entrada, los administradores y los dueños).

Código: `lib/producto/` (ideas, con tests), `app/api/producto/`, `components/producto/Ideas.tsx` y `components/tareas/Tareas.tsx` (modo "producto").
