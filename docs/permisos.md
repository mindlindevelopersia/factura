# Permisos y Ajustes

**Ajustes** (abajo en el menú; solo super administrador y administradores) tiene dos pestañas:

- **Usuarios**: los mails habilitados para entrar (`ALLOWED_EMAILS` en Vercel). En la ficha de cada uno: nombre, apellido, **@usuario** (con el que se lo menciona; el apodo de siempre, Mati o Tade, también sigue andando), celular, horario de trabajo, puesto, **rol**, **permisos a medida** (una grilla por área y módulo que reemplaza los del rol) y **proyectos** (todos o algunos).
- **Roles**: la tabla de qué ve cada rol de entrada.

| Rol | Qué ve |
| --- | --- |
| Super administrador | Todo, incluido Ajustes. Fijo por código: matimindlin111@gmail.com (no depende de la planilla) |
| Administrador | Todo, incluido Ajustes (no puede editar al super administrador) |
| Developer (dueño) | Todo menos Ajustes |
| Contador | Administración, Finanzas, Inversores, Calendario y Tareas |
| Vendedor | Comercial (Unidades, Lista de precios, Propuestas, CRM), Calendario y Tareas |
| Arquitectura | Unidades, Indicadores (CAC y materiales), Calendario y Tareas |
| Analista | Indicadores, Finanzas, Unidades y Lista de precios, Calendario y Tareas |
| Sin permisos | Solo el inicio |

Quien entra y todavía no está configurado: si es del equipo de siempre (`lib/equipo.ts`: Mati, Tade), Administrador; si no, Sin permisos hasta que se le dé un rol.

**Dónde se controla**: en el servidor. Cada página llama a `requireRuta` (si no tiene permiso, va a "Sin permiso") y cada ruta de datos a `exigir`/`preparar` (responde 403). El menú, las tarjetas, el buscador ⌘K (también sus resultados de datos) y Oliver muestran solo lo permitido. El tablero de la portada del proyecto (ventas y unidades) solo lo ve quien ve algo de Comercial.

Se guarda en la planilla del CRM, pestaña **"Usuarios"** (se crea sola). Se lee cada minuto; si la planilla falla, se usa lo último leído.

Código: `lib/permisos/modelo.ts` (claves, roles, reglas; puro, con tests), `lib/permisos/fuente.ts`, `lib/permisos/api.ts`, `requireRuta` en `lib/auth/session.ts`, `app/api/ajustes/usuarios/`, `app/(hub)/ajustes/` y `components/ajustes/Ajustes.tsx`. Las claves salen del menú (`lib/modulos.ts`): un módulo nuevo aparece solo en la grilla (y hay que sumarlo a los roles que corresponda).
