# Oliver en Telegram (el asistente del hub)

El bot de Telegram del hub, además de recibir facturas, entiende mensajes escritos: le contás lo
que va pasando y lo carga en el hub con los permisos de quien escribe. Si falta algo o hay una
duda, pregunta, con botones para contestar con un toque.

## Qué puede hacer

| Pedido | Ejemplo |
| --- | --- |
| Crear tareas | "mañana llamar a la constructora por el hormigón, que lo haga Eliana" |
| Ver pendientes | "¿qué tengo para esta semana?", "las tareas de Eliana" |
| Cambiar tareas | "la del hormigón ya está hecha", "pasala al viernes" |
| Cargar leads | "nuevo lead Juan Pérez, lo refirió Lola, le interesa la 2C" |
| Anotar seguimientos | "hablé con Juan, quiere la propuesta el lunes" |
| Unidades disponibles | "¿qué dos ambientes quedan en Lerma?" |
| Armar propuestas | "armá una propuesta de la 2C para Juan Pérez" |
| Comentar la factura | (después de mandar una factura) "es la del hormigón de octubre" |

**Las propuestas** se guardan con las condiciones de siempre al dólar MEP del día, y el bot pasa el
link para ajustarlas y bajar el PDF.

**Qué pregunta antes de hacer:**

- En una tarea: quién y para cuándo, con botones del equipo y de fechas.
- En un lead: busca antes si ya existe, y pregunta una vez cómo llegó y un teléfono o mail.
- Si hay dos resultados parecidos, pregunta cuál.
- Antes de cancelar una tarea o marcar un lead como perdido, confirma.

**Avisos:** cuando le asigna algo a otra persona, le llega a esa persona por la campanita.

`/nuevo` empieza una charla de cero. La charla se recuerda dos horas, en la pestaña "Bot Telegram"
de la planilla del CRM, **cifrada**: quien abra la planilla no puede leer lo que cada uno habló.

## Privacidad

- **Chats separados:** cada persona habla con el bot en su propio chat privado; nadie ve el chat de
  otro, y el bot no contesta en grupos.
- **Memoria por chat:** cada charla se recuerda aparte, cifrada con AES-256-GCM y una llave que sale
  de `AUTH_SECRET` (`lib/tfa/cifrado.ts`).
- **Permisos de la web:** cada herramienta usa los permisos de quien escribe, los mismos de la web.
- **Lo que se carga sí se ve:** las tareas, los leads y las propuestas quedan en el hub y las ven
  los que tienen permiso para ese módulo.

## Cómo está hecho

- **Webhook** `app/api/telegram-webhook/route.ts`:
  - Un texto va a `lib/bot/telegram.ts` (después de contestarle a Telegram), con un candado por
    mensaje para que un reintento de Telegram no lo procese dos veces.
  - Las facturas siguen igual.
  - Los audios siguen anotándose en la última factura: todavía no se transcriben.
- **Agente** `lib/bot/agente.ts`:
  - Claude (`claude-opus-5-5`, esfuerzo medio, `fallbacks: "default"`) con las herramientas de
    `lib/bot/herramientas.ts`, hasta 8 vueltas por mensaje.
  - Las herramientas tienen esquemas estrictos y cada una revisa `puedeRuta` / `veProyecto` con
    el acceso de quien escribe.
- **Memoria** `lib/bot/historial.ts` + `conversacion.ts`:
  - Solo el texto de cada turno, sin las llamadas a herramientas.
  - Lo que el bot hizo queda anotado al final de su respuesta ("[Hecho: creó la tarea t12…]"),
    para poder decir "cambiale la fecha".
- **Instrucciones** `lib/bot/instrucciones.ts`: cómo habla, cuándo pregunta y las reglas.

## Requisitos

- `ANTHROPIC_API_KEY` en Vercel. Sin la clave, el bot hace lo de antes: el texto es un comentario
  de la última factura.
- El Telegram de cada persona conectado a su mail, desde la web de facturas: "Conectar mi
  Telegram".

## Próximos pasos

- **Audios:** hace falta un servicio de transcripción (Google Speech-to-Text con la cuenta de
  servicio, o Whisper).
- **Más módulos:** egresos ("anotá un pago de…"), el calendario y cobranzas.
