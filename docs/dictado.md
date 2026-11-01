# Dictado por voz

Hablás y se escribe. Hay un micrófono en:

- **Todos los campos que admiten @menciones** (`CampoMenciones`): descripción y comentarios de
  tareas y features, ideas, notas en los números de Prefactibilidad y Cash flow, y el resto de los
  comentarios.
- Los mensajes de **WhatsApp y mail** de la ficha del CRM.
- El chat de **Oliver**.
- El título de las tareas y de las ideas.

Se toca, se habla, y lo dicho se suma a lo que ya estaba escrito (con mayúscula si arranca una
frase). Se toca de nuevo, o se hace silencio un rato, para terminar. Mientras escucha, el botón se
pone rojo y arriba se ve lo que va entendiendo.

## Dictar una tarea

En Tareas (y en Features) está **Dictar tarea**:

1. Se abre y empieza a escuchar.
2. Se dice la tarea entera ("mañana llamar a la constructora por el hormigón, que lo haga Eliana,
   es urgente") y se puede corregir el texto.
3. **Armar la tarea** abre la ficha de una tarea nueva ya completa: título, responsable (de la
   lista del equipo), fecha (las relativas como "mañana" o "el jueves" se calculan desde hoy),
   hora, prioridad, tipo, con quién tiene que ver y subtareas.
4. Se revisa y se toca **Crear tarea**.

**Cómo funciona el armado:**

- `POST /api/tareas/dictado` (`lib/tareas/dictado.ts`) le pasa el dictado a Claude
  (`claude-opus-5-5`, esfuerzo bajo) con salida estructurada.
- El responsable solo puede ser alguien del equipo.
- La respuesta pasa por las mismas reglas que una tarea cargada a mano (`validarCambios`).
- No guarda nada.
- Sin `ANTHROPIC_API_KEY`, o si Claude no responde bien, la primera frase va al título y todo el
  dictado a la descripción.

## Navegadores

- Usa el reconocimiento de voz del navegador (`SpeechRecognition`, en `es-AR`), sin instalar nada:
  Chrome y Edge en la compu y en Android, y Safari en la Mac y el iPhone.
- La primera vez el navegador pide permiso para el micrófono.
- En Firefox no existe y el micrófono no aparece; Dictar tarea igual deja escribir el texto para
  que se ordene solo.
- El audio lo procesa el servicio del navegador (Google en Chrome, Apple en Safari); el hub no lo
  guarda.
