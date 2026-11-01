# Oliver, el asistente de cada sección

Una burbuja abajo a la derecha (en todas las páginas del hub) abre un chat con **Oliver**. Responde preguntas sobre la sección en la que está la persona, **solo con los datos de esa sección** y las reglas del negocio: si algo no está, lo dice. No cambia nada y no guarda las conversaciones (viven en la pestaña; se borran al cerrarla).

## Cómo funciona

- `components/Oliver.tsx`: la burbuja y la ventana (se minimiza; la conversación sigue al navegar). Manda a `/api/oliver` la página en la que se está y la conversación.
- `app/api/oliver/route.ts`: arma los datos de esa página **en el servidor** (`lib/oliver/contexto.ts`), los pone en el prompt de sistema junto con las instrucciones fijas (`lib/oliver/instrucciones.ts`) y devuelve la respuesta de a poco (streaming, texto plano).
- Modelo: `claude-haiku-5-5` (el más económico). Los datos de la sección se cachean (`cache_control`), así que las preguntas siguientes de la misma conversación cuestan menos. El uso de cada pregunta queda en los logs de Vercel (`oliver { uso }`).
- Límites: las últimas 20 preguntas y respuestas, 2.000 caracteres por mensaje.

## Qué ve en cada sección

| Página | Datos |
|---|---|
| Inicio | Dólar de hoy, proyectos y áreas |
| Indicadores | Series (CAC, IPC, dólar, materiales) y la alarma de materiales; en Índice CAC, los últimos 36 meses |
| Proyecto, Comercial | Unidades, superficies, precios, ventas, modalidades, supuestos y alarmas |
| Management | Lo comercial + desarrolladores y los egresos de HQ en duda |
| Finanzas · Ingresos | El Flujo: cobrado y a cobrar por mes, atrasados, avisos |
| Finanzas · Egresos | Totales, rubros, meses, cada egreso y los avisos |
| Cuentas corrientes | Cada cuenta (dólares y pesos de hoy, pagos, pendientes, avisos); en la ficha, el detalle de esa cuenta |
| Cobranzas | Vencidos actualizados por CAC, lo de este mes y el próximo, qué revisar |
| CRM | Contactos, alarmas, tablero, actividad reciente y unidades disponibles |
| Administración | Todavía nada (los comprobantes se revisan en pantalla) |

## Configuración

Necesita `ANTHROPIC_API_KEY` en Vercel (la misma que usa la lectura de facturas). Sin ella, Oliver avisa que falta.

Para sumar una sección: agregar su caso en `contextoDe()` y, si hace falta, sugerencias en `components/Oliver.tsx`. Las reglas del negocio que Oliver tiene que saber van en `lib/oliver/instrucciones.ts`.
