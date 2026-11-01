import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/auth";
import { perfilDe } from "@/lib/permisos/fuente";
import { Campanita } from "./Campanita";
import { Icono } from "./Icono";
import { MenuUsuario } from "./MenuUsuario";

export async function AppHeader({ email }: { email: string }) {
  const { nombre } = await perfilDe(email);
  return (
    <header className="app-header">
      <a className="saltar-contenido" href="#contenido">
        Saltar al contenido
      </a>
      <div className="app-header__inner">
        <div className="app-header__marca">
          <Link href="/" className="app-header__inicio">
            <Image
              className="app-header__logo"
              src="/brand/mindlin-logo.png"
              alt="Mindlin Developers"
              width={631}
              height={219}
              priority
            />
          </Link>
        </div>
        <div className="app-header__user">
          <Campanita />
          <MenuUsuario
            nombre={nombre}
            email={email}
            salir={
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button type="submit" className="menu-usuario__item">
                  <Icono nombre="volver" size={16} /> Salir
                </button>
              </form>
            }
          />
        </div>
      </div>
    </header>
  );
}
