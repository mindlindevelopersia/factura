import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "Facturas y comprobantes · Mindlin",
  description:
    "Carga, revisión y registro de compras, honorarios y ventas de Mindlin Developers.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={sora.variable}>
      <body>{children}</body>
    </html>
  );
}
