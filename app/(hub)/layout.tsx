import { AppHeader } from "@/components/AppHeader";
import { Navegacion } from "@/components/Navegacion";
import { requireUser } from "@/lib/auth/session";

/** El marco del hub: encabezado arriba, menú de áreas a la izquierda y la página a la derecha. */
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <>
      <AppHeader email={user.email} />
      <div className="hub">
        <Navegacion />
        <div className="hub__contenido">{children}</div>
      </div>
    </>
  );
}
