import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { SCRIPT_PRIVADO } from "@/components/Privado";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: { default: "Mindlin Developers", template: "%s · Mindlin" },
  description: "Hub de las áreas de Mindlin Developers.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // El modo privado se aplica antes de pintar (ver components/Privado.tsx): por eso el aviso de hidratación.
    <html lang="es" className={sora.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_PRIVADO }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
