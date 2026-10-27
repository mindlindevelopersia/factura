import { AppHeader } from "@/components/AppHeader";
import { requireUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await requireUser();

  return (
    <>
      <AppHeader email={user.email} />
      <main className="app-main">
        <h1>Facturas de compra</h1>
        <div className="card">
          <p>En construcción. Todavía no hay carga de archivos.</p>
        </div>
      </main>
    </>
  );
}
