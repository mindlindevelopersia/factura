import { AppHeader } from "@/components/AppHeader";
import { Bandeja } from "@/components/Bandeja";
import { requireUser } from "@/lib/auth/session";

export default async function Home({ searchParams }: { searchParams: Promise<{ revisar?: string }> }) {
  const user = await requireUser();
  const { revisar } = await searchParams;

  return (
    <>
      <AppHeader email={user.email} />
      <main className="app-main">
        <h1>Facturas</h1>
        <p className="app-main__intro">
          Las facturas llegan por Telegram o se suben acá. La IA las lee, las clasifica en compras, honorarios o ventas
          y propone los datos. Revisá los campos en amarillo, corregí lo que haga falta y aprobá: se cargan en la
          planilla y el archivo va a la carpeta del mes en Drive.
        </p>
        <Bandeja revisar={revisar} />
      </main>
    </>
  );
}
