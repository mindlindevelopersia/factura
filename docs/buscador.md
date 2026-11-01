# Buscador (⌘K)

Desde cualquier pantalla, **⌘K** (Mac) o **Ctrl+K** (Windows) abre el buscador. También se abre con la caja "Buscar…" del inicio y de cada proyecto. Busca mientras escribís, sin importar tildes ni mayúsculas, y cada resultado tiene una etiqueta de qué es:

- **Páginas**: las áreas y módulos de la empresa y de cada proyecto (por ejemplo "Materiales · Indicadores").
- **Lead**: los contactos del CRM (también por teléfono, mail u origen). Abre su ficha.
- **Propuesta**: las propuestas guardadas. Abre la propuesta.
- **Unidad** / **Cochera**: las del Excel madre, con su estado e inversor. Abre la unidad.
- **Inversor**: cada cuenta corriente. Abre la cuenta.
- **Cobro** / **Cobro vencido**: lo próximo a cobrar de cada inversor, o lo vencido. Abre Cobranzas.
- **Tarea**: las tareas. Abre la tarea.
- **Desarrollador**: los socios. Abre Desarrolladores.

Los del proyecto en el que estás salen primero. ↑ ↓ para moverse, Enter para abrir, Esc para cerrar. Los datos se leen al abrirlo y quedan 5 minutos en el navegador.

Código: `lib/buscador/indice.ts` (páginas y búsqueda), `lib/buscador/datos.ts` (los resultados de cada fuente; puros, con tests), `lib/buscador/fuente.ts`, `app/api/buscar/route.ts` y `components/Buscador.tsx`.
