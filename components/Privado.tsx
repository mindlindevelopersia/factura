"use client";

import { useEffect, useState } from "react";
import { CLAVE_PRIVADO, tramosSensibles } from "@/lib/privado";
import { Icono } from "./Icono";

const ATRIBUTO = "data-privado";
const NO_MIRAR = "script,style,textarea,noscript,[data-privado-no]";

/** Desenfoca los números, mails y teléfonos de la pantalla (sin tocar el contenido: con un "resaltado" de CSS). */
function marcar() {
  const h = new Highlight();
  const caminante = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest(NO_MIRAR) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = caminante.nextNode() as Text | null; n; n = caminante.nextNode() as Text | null) {
    for (const [a, b] of tramosSensibles(n.data)) {
      const r = new Range();
      r.setStart(n, a);
      r.setEnd(n, b);
      h.add(r);
    }
  }
  CSS.highlights.set("privado", h);
}

/**
 * El ojito de arriba (al lado de la campanita): oculta montos, m², porcentajes, mails, teléfonos y
 * los nombres de inversores y leads, para grabar o mostrar la pantalla. Queda guardado en este
 * navegador hasta que lo vuelvas a tocar. Al imprimir o exportar se ve todo normal.
 */
export function BotonPrivado() {
  const [privado, setPrivado] = useState(false);

  useEffect(() => {
    setPrivado(document.documentElement.hasAttribute(ATRIBUTO));
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (!privado) {
      html.removeAttribute(ATRIBUTO);
      if (typeof CSS !== "undefined" && "highlights" in CSS) CSS.highlights.delete("privado");
      return;
    }
    html.setAttribute(ATRIBUTO, "");
    // Sin el resaltado de CSS (navegadores viejos), el CSS desenfoca las tablas enteras.
    if (typeof CSS === "undefined" || !("highlights" in CSS)) {
      html.setAttribute("data-privado-simple", "");
      return () => html.removeAttribute("data-privado-simple");
    }
    marcar();
    // Lo que se carga o cambia después: se vuelve a marcar antes de pintar (el observador corre antes).
    const obs = new MutationObserver(marcar);
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => obs.disconnect();
  }, [privado]);

  const cambiar = () => {
    const nuevo = !privado;
    setPrivado(nuevo);
    try {
      if (nuevo) localStorage.setItem(CLAVE_PRIVADO, "1");
      else localStorage.removeItem(CLAVE_PRIVADO);
    } catch {
      /* sin almacenamiento: vale solo para esta pestaña */
    }
  };

  return (
    <button
      type="button"
      className={`campanita__boton privado__boton${privado ? " privado__boton--activo" : ""}`}
      onClick={cambiar}
      aria-pressed={privado}
      aria-label={privado ? "Mostrar los datos" : "Ocultar los datos sensibles"}
      title={privado ? "Modo privado: los números y nombres están ocultos. Tocá para mostrarlos." : "Ocultar números y nombres (para grabar o mostrar la pantalla)"}
      data-privado-no=""
    >
      <Icono nombre={privado ? "ojo-tachado" : "ojo"} size={20} />
    </button>
  );
}

/** Para el <head>: aplica el modo privado antes de pintar, así no se ve nada al cargar. */
export const SCRIPT_PRIVADO = `try{if(localStorage.getItem(${JSON.stringify(CLAVE_PRIVADO)})==="1")document.documentElement.setAttribute(${JSON.stringify(ATRIBUTO)},"")}catch(e){}`;
