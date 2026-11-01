import type { Metadata } from "next";
import { Perfil } from "@/components/Perfil";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function PaginaPerfil() {
  await requireUser();
  return (
    <main className="app-main" id="contenido">
      <div className="pagina-encabezado">
        <div>
          <span className="eyebrow">Mindlin Developers</span>
          <h1>Mi perfil</h1>
          <p>Tus datos, tu @usuario para que te mencionen, lo que podés ver y tus notificaciones.</p>
        </div>
      </div>
      <Perfil />
    </main>
  );
}
