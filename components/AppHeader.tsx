import Image from "next/image";
import { signOut } from "@/auth";

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Image
          className="app-header__logo"
          src="/brand/mindlin-logo.png"
          alt="Mindlin Developers"
          width={631}
          height={219}
          priority
        />
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
