import Image from "next/image";
import { signOut } from "@/auth";

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="app-header">
      <a className="saltar-contenido" href="#contenido">
        Saltar al contenido
      </a>
      <div className="app-header__inner">
        <div className="app-header__marca">
          <Image
            className="app-header__logo"
            src="/brand/mindlin-logo.png"
            alt="Mindlin Developers"
            width={631}
            height={219}
            priority
          />
          <span className="app-header__producto">Gestión de facturas</span>
        </div>
        <div className="app-header__user">
          <span>{email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="btn btn--borde-claro btn--chico">
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
