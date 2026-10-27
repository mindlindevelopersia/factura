import { signOut } from "@/auth";
import { requireUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await requireUser();

  return (
    <main>
      <header style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <span>{user.email}</span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit">Salir</button>
        </form>
      </header>
      <h1>Lector de facturas de compra</h1>
      <p>En construcción. Todavía no hay carga de archivos.</p>
    </main>
  );
}
