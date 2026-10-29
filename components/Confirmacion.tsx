"use client";

import { useEffect, useId, useRef } from "react";
import { Icono } from "./Icono";

export function Confirmacion({
  titulo,
  children,
  confirmar,
  peligro,
  onCancelar,
  onConfirmar,
}: {
  titulo: string;
  children: React.ReactNode;
  confirmar: string;
  peligro?: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = dialogo.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={dialogo}
      className="confirmacion"
      aria-labelledby={`${id}-titulo`}
      aria-describedby={`${id}-descripcion`}
      onCancel={(e) => {
        e.preventDefault();
        onCancelar();
      }}
    >
      <div className="confirmacion__icono">
        <Icono nombre={peligro ? "papelera" : "recargar"} size={26} />
      </div>
      <h2 id={`${id}-titulo`}>{titulo}</h2>
      <div id={`${id}-descripcion`}>{children}</div>
      <div className="confirmacion__acciones">
        <button
          type="button"
          className="btn btn--borde"
          autoFocus
          onClick={onCancelar}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={`btn ${peligro ? "btn--peligro" : "btn--primario"}`}
          onClick={onConfirmar}
        >
          {confirmar}
        </button>
      </div>
    </dialog>
  );
}
