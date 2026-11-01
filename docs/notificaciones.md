# Notificaciones y menciones

**Campanita** (arriba a la derecha): un número con las sin leer. Al tocar una, se marca leída y te lleva a lo que es. "Marcar todas como leídas". Se actualiza al entrar, cada 2 minutos y al volver a la pestaña.

Qué llega:

- **Mención**: alguien te nombró con **@** (ej.: `@Tade`) en la descripción o un comentario de una tarea, una nota o lo registrado en un lead del CRM, o un evento de la agenda. Al escribir `@` aparece la lista de usuarios para elegir. Al editar, solo avisa a los mencionados nuevos.
- **Asignada**: te pusieron de responsable de una tarea, un lead o un evento de la agenda (si no te lo asignaste vos).
- **Comentario**: comentaron en una tarea tuya (de la que sos responsable o que creaste).
- **Vence**: tus tareas, los próximos pasos de tus leads, tu agenda y tus propuestas de hoy y mañana, y lo atrasado del último mes. Se calculan en el momento (no se guardan).

Los usuarios son los mails de `ALLOWED_EMAILS`, con su apodo de `lib/equipo.ts` (Mati, Tade); los demás, por lo que va antes de la @ del mail. Para que alguien (por ejemplo, Eliana) se pueda mencionar con su nombre, se suma su mail a `ALLOWED_EMAILS` y a `lib/equipo.ts`.

Se guardan en la planilla del CRM, pestaña **"Notificaciones"** (se crea sola); marcar leída agrega una fila "leida" con el ID. Código: `lib/notificaciones/modelo.ts` (puro, con tests), `lib/notificaciones/fuente.ts`, `app/api/notificaciones/`, `app/api/usuarios/`, `components/Campanita.tsx` y `components/Menciones.tsx`.

En la ficha del lead, si no tiene teléfono (o el cargado no sirve para WhatsApp), "WhatsApp" lo pide, lo guarda y abre el chat.
