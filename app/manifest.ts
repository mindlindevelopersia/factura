import type { MetadataRoute } from "next";

// Para instalar la web como app ("Agregar a la pantalla de inicio" en el celular, "Instalar" en Chrome).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mindlin Developers",
    short_name: "Mindlin",
    description: "Hub de las áreas de Mindlin Developers.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1a1a1a",
    theme_color: "#1a1a1a",
    icons: [
      { src: "/brand/app-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/app-512.png", sizes: "512x512", type: "image/png" },
      // El isologo entra en el círculo central que Android deja visible al recortar el ícono.
      { src: "/brand/app-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
