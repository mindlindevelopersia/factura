# Modo privado (el ojito)

Botón con un ojo arriba a la derecha, al lado de la campanita. Sirve para grabar videos o mostrar
la pantalla sin dejar ver datos sensibles, como el "ocultar saldo" de los bancos.

- **Qué oculta (en todo el hub):** montos (`US$`, `$`, `USD`, `ARS`, también abreviados), m²,
  porcentajes, números con separador de miles o decimales, mails, teléfonos y números largos
  (CUIT, cuentas). La regla está en `lib/privado.ts` (con tests): las fechas, años, horas,
  contadores y códigos de unidad quedan visibles.
- **Nombres:** se ocultan donde están marcados con `data-sensible`. Hoy son inversores (cuentas
  corrientes, ficha, cobranzas, unidades), leads (CRM: tarjetas, lista, ficha, referidos), clientes
  de las propuestas, cobros, leads y propuestas en el Calendario, el "con quién" de las tareas y
  los resultados del buscador de inversores, leads y propuestas. Para sumar otro lugar, agregale
  `data-sensible=""` al elemento.
- **Campos:** los campos numéricos, de teléfono y de mail se desenfocan.
- **Cómo funciona:** desenfoca con la CSS Custom Highlight API, sin tocar el contenido de la página
  (`components/Privado.tsx`). Un MutationObserver vuelve a marcar lo que se carga después, antes de
  pintar. En navegadores sin esa API se desenfocan las celdas de las tablas enteras.
- **Recordarlo:** queda guardado en el navegador (`localStorage`) y se aplica antes del primer
  pintado (script en `app/layout.tsx`).
- **Imprimir y exportar:** al imprimir (el PDF de la propuesta) y al exportar a Excel se ve todo
  normal.
