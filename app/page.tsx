import { AppHeader } from "@/components/AppHeader";
import { Bandeja } from "@/components/Bandeja";
import { requireUser } from "@/lib/auth/session";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ revisar?: string }>;
}) {
  const user = await requireUser();
  const { revisar } = await searchParams;

  return (
    <>
      <AppHeader email={user.email} />
      <main className="app-main" id="contenido">
        <div className="pagina-encabezado">
          <div>
            <span className="eyebrow">Administración</span>
            <h1>Facturas y comprobantes</h1>
            <p>Revisá lo que llega. Aprobá con los datos a la vista.</p>
          </div>
          <div className="pagina-encabezado__ayuda">
            <span className="punto-estado" />
            Registro con aprobación manual
          </div>
        </div>
        <Bandeja revisar={revisar} inicial="inicio" />
      </main>
    </>
  );
}
