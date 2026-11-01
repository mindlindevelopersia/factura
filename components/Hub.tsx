"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icono } from "./Icono";
import { Migas } from "./Migas";
import { Navegacion } from "./Navegacion";
import { Oliver } from "./Oliver";

const CLAVE = "hub-menu-cerrado";

/**
 * El cuerpo del hub: el menú a la izquierda y la página a la derecha. El menú se puede esconder
 * (botón «) para que la página use todo el ancho, y volver a abrir (botón »). Se acuerda en el
 * navegador. En pantallas angostas el menú es una franja arriba y no se esconde.
 */
export function Hub({ children }: { children: ReactNode }) {
  const [cerrado, setCerrado] = useState(false);
  useEffect(() => {
    setCerrado(localStorage.getItem(CLAVE) === "1");
  }, []);
  const cambiar = (valor: boolean) => {
    setCerrado(valor);
    localStorage.setItem(CLAVE, valor ? "1" : "0");
  };

  return (
    <div className={`hub${cerrado ? " hub--sin-menu" : ""}`}>
      {cerrado ? (
        <div className="hub__riel">
          <button type="button" className="hub__menu-boton" onClick={() => cambiar(false)} aria-label="Mostrar el menú" title="Mostrar el menú">
            <Icono nombre="menu-abrir" size={18} />
          </button>
        </div>
      ) : (
        <Navegacion
          cerrar={
            <button type="button" className="hub__menu-boton" onClick={() => cambiar(true)} aria-label="Esconder el menú" title="Esconder el menú">
              <Icono nombre="menu-cerrar" size={18} />
            </button>
          }
        />
      )}
      <div className="hub__contenido">
        <Migas />
        {children}
      </div>
      <Oliver />
    </div>
  );
}
