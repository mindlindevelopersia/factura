# Notas en los números (como las de Excel)

Al pasar el mouse por un número aparece un globito: ahí se deja una nota ("esto lo hice así por tal cosa"). Si el número ya tiene notas, el globito queda a la vista, en amarillo y con cuántas tiene (como el triangulito de Excel).

- Cada nota arma un **hilo**: los demás **responden** abajo.
- Con **@** se menciona a alguien (le llega a la campanita). A quienes ya participan del hilo les llega un aviso cuando alguien responde.
- Quien no puede ver la página no ve sus notas (se controla con el permiso de la página).

Dónde están por ahora:

- **Prefactibilidad**: el terreno, el FOS permitido, lo construible (según GCBA, con descubiertas, total, lo que permite el FOT), lo vendible (teórico y real), comunes, % vendible y cada paso de la plusvalía. Son las mismas desde HQ y desde el proyecto.
- **Cash flow**: cada fila (Ingresos, Egresos, cada grupo y cada partida) y cada celda (fila × mes, en cada vista: una nota en "Real" no aparece en "Proyectado").

Se guardan en la planilla del CRM, pestaña **"Comentarios en datos"** (dato, a qué responde, fecha, quién, texto, página y qué es). Código: `lib/comentarios/` (modelo con tests), `app/api/comentarios/route.ts` y `components/Notas.tsx` (`<NotasProvider>` en la página y `<Nota clave etiqueta />` al lado de cada número). Para sumarlas en otra pantalla, alcanza con esas dos piezas.
