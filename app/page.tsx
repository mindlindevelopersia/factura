import { AppHeader } from "@/components/AppHeader";
import { CargaFacturas } from "@/components/CargaFacturas";
import { requireUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await requireUser();

  return (
    <>
      <AppHeader email={user.email} />
      <main className="app-main">
        <h1>Facturas de compra</h1>
        <p className="app-main__intro">
          La IA lee cada factura y propone los datos. Revisá los campos en amarillo, corregí lo que haga falta y
          aprobá: se carga en la planilla con estado &quot;En revisión&quot;.
        </p>
        <CargaFacturas />
      </main>
    </>
  );
}
