import { AppHeader } from "@/components/AppHeader";
import { Hub } from "@/components/Hub";
import { requireUser } from "@/lib/auth/session";

/** El marco del hub: encabezado arriba, menú de áreas a la izquierda (se puede esconder) y la página a la derecha. */
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <>
      <AppHeader email={user.email} />
      <Hub>{children}</Hub>
    </>
  );
}
