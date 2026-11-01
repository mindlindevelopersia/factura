# Marketing (HQ)

Módulo en construcción. Hoy cada submódulo muestra su **tarjeta de idea**: para qué es, qué va a
tener por etapas (de menos a más), el agente si tiene, con qué se conecta, qué hay que decidir y
el primer paso concreto. El contenido está en `lib/marketing/ideas.ts`; cuando un submódulo se
construye, su tarjeta pasa a ser su documentación.

| Submódulo | Ruta | Primer paso |
| --- | --- | --- |
| SEO y keywords | `/marketing/seo` | Dar acceso a Search Console a la cuenta de servicio y traer las búsquedas. |
| Blog | `/marketing/blog` | Leer el sitemap del blog y cargar los artículos publicados en el tablero. |
| Pauta | `/marketing/pauta` | App de Meta con `ads_read` y traer campañas, gasto y leads de 6 meses. |
| Contenido para redes | `/marketing/contenido` | Calendario editorial en el hub + propuestas semanales del agente. |
| Analítica | `/marketing/analitica` | Auditar GA4 en el sitio y definir conversiones y UTMs. |

## Principios

- Medir primero (Analítica): sin GA4 y Search Console bien configurados no se puede evaluar nada.
- Todo vinculado: keyword → artículo → visita → lead del CRM; campaña → lead → venta.
- Los agentes proponen y una persona decide: nada se publica ni se cambia en una campaña solo.
- Sin inventar: los agentes trabajan con datos reales y lo marcan cuando falta uno.

## Permisos

Las claves salen solas de `lib/modulos.ts` (`/marketing/seo`, …). Administradores y developers
las tienen por defecto; al resto se las da el super admin en Ajustes → Roles.

## Pendiente de confirmar

- Si Unicorn Platform tiene API (plan B: sitemap/RSS para leer, copiar y pegar para publicar).
- Qué sistema de atención al cliente reciben los leads de la pauta y si tiene API.
- Accesos: Search Console, GA4, cuenta publicitaria de Meta.
