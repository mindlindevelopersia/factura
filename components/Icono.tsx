import type { CSSProperties } from "react";

const trazos = {
  inicio: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  bandeja: "M4 4h16v16H4z M4 14h5l1 3h4l1-3h5",
  subir: "M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6",
  historial: "M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l3 2",
  buscar: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  flecha: "M5 12h14 M14 7l5 5-5 5",
  desplegar: "M9 6l6 6-6 6",
  "menu-cerrar": "M11 17l-5-5 5-5 M18 17l-5-5 5-5",
  "menu-abrir": "M13 17l5-5-5-5 M6 17l5-5-5-5",
  volver: "M19 12H5 M10 7l-5 5 5 5",
  check: "M5 12l4 4L19 6",
  alerta: "M12 3L2 21h20L12 3z M12 9v5 M12 17v.1",
  cerrar: "M6 6l12 12 M18 6L6 18",
  archivo: "M14 2H4v20h16V8l-6-6z M14 2v6h6 M8 13h8 M8 17h6",
  externo: "M14 3h7v7 M21 3l-11 11 M10 3H3v18h18v-7",
  recargar: "M20 7a9 9 0 1 0 1 8 M20 2v6h-6",
  reloj: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2",
  papelera: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  ayuda:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17v.1",
  telegram: "M22 3L2 11l7 3 3 7 10-18z M9 14l13-11",
  ensayo: "M9 3h6 M10 3v14a2 2 0 0 0 4 0V3 M10 12h4",
  inversores: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2 M16 3.5a4 4 0 0 1 0 7 M22 21v-2a5 5 0 0 0-3.5-4.8",
  imprimir: "M6 9V3h12v6 M6 18H4v-7h16v7h-2 M6 14h12v7H6z",
  indicadores: "M3 3v18h18 M7 15l4-5 4 3 5-7",
  mensaje: "M21 12a9 9 0 0 1-13.4 7.9L3 21l1.2-4.4A9 9 0 1 1 21 12z",
  comercial: "M3 9l9-6 9 6v12H3z M9 21v-6h6v6 M3 9h18",
  management: "M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z",
  proyecto: "M4 21V5l8-3 8 3v16 M9 21v-4h6v4 M8 8h2 M14 8h2 M8 12h2 M14 12h2 M2 21h20",
  hub: "M3 3h8v8H3z M13 3h8v8h-8z M3 13h8v8H3z M13 13h8v8h-8z",
  administracion: "M3 7h18v13H3z M8 7V4h8v3 M3 12h18",
  calendario: "M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4 M7 14h2 M11 14h2 M15 14h2 M7 17h2 M11 17h2",
  tareas: "M4 4h16v16H4z M8 9l2 2 4-4 M8 15h8",
  ojo: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  "ojo-tachado": "M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.4 3.3 M6.6 6.6C3.8 8.3 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6 M9.9 9.9a3 3 0 0 0 4.2 4.2 M3 3l18 18",
  campana: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0",
  ajustes: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  producto: "M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z",
  prefactibilidad: "M3 21h18 M5 21V9l7-5 7 5v12 M9 21v-6h6v6 M3 9h18",
  marketing: "M3 11l14-6v14L3 13z M7 13v5a2 2 0 0 0 4 0v-4 M21 9v4",
  finanzas: "M3 20h18 M6 16v-4 M11 16V8 M16 16v-6 M20 4l-6 5-4-3-6 5",
} as const;

export function Icono({
  nombre,
  size = 20,
  className,
  style,
}: {
  nombre: keyof typeof trazos;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path d={trazos[nombre]} />
    </svg>
  );
}
